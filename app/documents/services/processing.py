"""
app/documents/services/processing.py
--------------------------------------
ProcessingService — background worker.
Runs AFTER the HTTP response has already been returned to the client.

Extraction flow (primary → fallback):
  1. Gemini Vision/Text  — LLM-powered, best accuracy
  2. PyMuPDF + regex     — local fallback, always works

Database commits are minimised:
  Commit #1 — PROCESSING  (for UI polling visibility)
  Commit #2 — READY / MANUAL_REVIEW_REQUIRED / FAILED  (final state + all data)
"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import SessionLocal
from app.documents.models import Document, DocumentContent
from app.documents.services.audit import audit_service
from app.documents.services.classifier import classify
from app.documents.services.gemini_extractor import gemini_extractor
from app.documents.services.ocr_service import ocr_service
from app.documents.services.parser import parse, PARSER_VERSION
from app.documents.services.storage import storage_provider

logger = logging.getLogger(__name__)


async def run_processing(document_id: int, actor_id: int, tenant_id: str) -> None:
    """
    Entry point called by FastAPI BackgroundTasks.
    Opens its own DB session independent from the request session.
    """
    async with SessionLocal() as db:
        res = await db.execute(select(Document).filter(Document.id == document_id))
        doc = res.scalars().first()
        if not doc:
            logger.error("Processing: document %d not found", document_id)
            return

        await audit_service.log(
            db, document_id=document_id, actor_id=actor_id,
            tenant_id=tenant_id, action="processing_started",
        )

        try:
            # ── Commit #1: visible status for polling ─────────────────────
            doc.status = "PROCESSING"
            db.add(doc)
            await db.commit()

            file_bytes = await storage_provider.read_bytes(doc.storage_path)

            # ── Path A: Gemini primary ────────────────────────────────────
            structured = None
            ocr_engine_used = "none"
            raw_text = ""
            confidence = None
            doc_type = doc.document_type or "misc"

            logger.info("Gemini extraction start [doc=%d]", document_id)
            structured = await asyncio.get_event_loop().run_in_executor(
                None,
                gemini_extractor.extract,
                file_bytes,
                doc.mime_type,
                doc.original_filename,
            )

            if structured:
                ocr_engine_used = (
                    structured.get("parser_metadata", {}).get("engine", "gemini")
                )
                extracted_type = structured.get("document_type", "misc")
                if extracted_type and extracted_type != "misc":
                    doc_type = extracted_type
                confidence = structured.get("parser_metadata", {}).get("confidence")
                # Preserve a small human-readable summary for UI while keeping
                # the full structured JSON returned by Gemini. If Gemini missed
                # common header fields (e.g. encounter.report_date) try a
                # local regex parse on extracted PDF text and merge missing
                # patient/provider/encounter fields so the UI shows correct data.
                raw_text = (
                    f"[Gemini] {doc_type}: "
                    f"{len(structured.get('tests', []))} tests, "
                    f"{len(structured.get('medications', []))} medications extracted"
                )

                # If essential header fields are missing, attempt to extract
                # PDF text locally and merge parser-derived header fields.
                try:
                    need_merge = False
                    enc = structured.get("encounter") or {}
                    if not enc.get("report_date") or not structured.get("patient"):
                        need_merge = True

                    if need_merge and doc.mime_type == "application/pdf":
                        # Local text extraction via PyMuPDF for header fallback
                        try:
                            import fitz
                            doc_pdf = fitz.open(stream=file_bytes, filetype="pdf")
                            pages_text = [p.get_text() for p in doc_pdf]
                            doc_pdf.close()
                            full_text = "\n".join(pages_text).strip()
                            if full_text:
                                fallback = await asyncio.get_event_loop().run_in_executor(
                                    None,
                                    parse,
                                    doc_type,
                                    full_text,
                                    confidence,
                                )
                                if fallback:
                                    # Merge patient/provider/encounter fields if missing
                                    for sec in ("patient", "provider", "encounter"):
                                        if not structured.get(sec) and fallback.get(sec):
                                            structured[sec] = fallback.get(sec)
                                        elif structured.get(sec) and fallback.get(sec):
                                            # Fill missing subkeys
                                            for k, v in (fallback.get(sec) or {}).items():
                                                if not structured[sec].get(k) and v is not None:
                                                    structured[sec][k] = v
                        except Exception:
                            # Non-fatal: best-effort fallback only
                            logger.debug("Local PDF fallback parse failed for doc=%d", document_id)
                except Exception:
                    logger.debug("Post-Gemini merge step failed for doc=%d", document_id)
                logger.info(
                    "Gemini extraction complete [doc=%d type=%s tests=%d]",
                    document_id, doc_type,
                    len(structured.get("tests", [])),
                )
            else:
                # ── Path B: OCR + regex fallback ──────────────────────────
                logger.info("Gemini unavailable — using OCR+regex [doc=%d]", document_id)
                ocr_result = await asyncio.get_event_loop().run_in_executor(
                    None,
                    ocr_service.extract,
                    file_bytes,
                    doc.mime_type,
                    doc.original_filename,
                )
                raw_text = ocr_result.raw_text
                ocr_engine_used = ocr_result.engine
                confidence = ocr_result.confidence

                # Handwritten documents — store as-is, no parsing
                if ocr_result.is_handwritten:
                    logger.info("Handwritten document [doc=%d]", document_id)
                    doc.status = "MANUAL_REVIEW_REQUIRED"
                    db.add(doc)
                    db.add(DocumentContent(
                        document_id=document_id,
                        raw_text=raw_text or "",
                        structured_json=None,
                        ocr_engine=ocr_engine_used,
                        ocr_status="done",
                        parsed_at=datetime.utcnow(),
                    ))
                    await db.commit()
                    await audit_service.log(
                        db, document_id=document_id, actor_id=actor_id,
                        tenant_id=tenant_id, action="processing_manual_review",
                    )
                    return

                detected_type, confidence = classify(raw_text)
                if detected_type and detected_type != "misc" and confidence >= 0.3:
                    doc_type = detected_type
                structured = parse(doc_type, raw_text, confidence)
                logger.info(
                    "Regex fallback complete [doc=%d type=%s]",
                    document_id, doc_type,
                )

            # ── Update doc type if improved ───────────────────────────────
            if doc_type != "misc" and doc.document_type == "misc":
                doc.document_type = doc_type

            # ── Commit #2: all results + final status ─────────────────────
            doc.status = "READY"
            db.add(doc)
            db.add(DocumentContent(
                document_id=document_id,
                raw_text=raw_text,
                structured_json=structured,
                ocr_engine=ocr_engine_used,
                ocr_status="done",
                classified_as=doc_type,
                confidence=confidence,
                parser_version=PARSER_VERSION,
                parsed_at=datetime.utcnow(),
            ))
            await db.commit()

            await audit_service.log(
                db, document_id=document_id, actor_id=actor_id,
                tenant_id=tenant_id, action="processing_completed",
                meta={"engine": ocr_engine_used, "doc_type": doc_type},
            )
            logger.info("Processing complete [doc=%d status=READY]", document_id)

        except Exception as exc:
            logger.exception("Processing failed [doc=%d]: %s", document_id, exc)
            try:
                doc.status = "FAILED"
                db.add(doc)
                await db.commit()
                await audit_service.log(
                    db, document_id=document_id, actor_id=actor_id,
                    tenant_id=tenant_id, action="processing_failed",
                    meta={"error": str(exc)},
                )
            except Exception:
                pass
