"""
app/documents/services/gemini_extractor.py
--------------------------------------------
Gemini-based medical document extraction service.

Primary path:
  - Image files  → Gemini Vision (raw bytes sent directly — no OCR needed)
  - Digital PDF  → PyMuPDF extracts text → Gemini understands text
  - Scanned PDF  → PyMuPDF renders page images → Gemini Vision

Fallback (when Gemini unavailable / quota exceeded):
  - PyMuPDF text extraction + existing regex parser

Returns the same normalized clinical schema as the regex parser
so the rest of the pipeline is completely unchanged.
"""

from __future__ import annotations

import base64
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ── Gemini system prompt ──────────────────────────────────────────────────────
_SYSTEM_PROMPT = """You are a medical document parser for a Hospital Management System.
Extract ALL information from this medical document and return ONLY a valid JSON object.

Required JSON structure:
{
  "document_type": "lab_report" | "prescription" | "radiology" | "discharge_summary" | "misc",
  "patient": {
    "name": "string or null",
    "age": "string or null",
    "gender": "string or null",
    "id": "string or null",
    "dob": "string or null",
    "phone": "string or null"
  },
  "provider": {
    "doctor": "string or null",
    "lab_name": "string or null",
    "hospital": "string or null"
  },
  "encounter": {
    "date": "string or null",
    "report_date": "string or null",
    "report_number": "string or null"
  },
  "tests": [
    {
      "name": "exact test name",
      "result": "value as string",
      "unit": "unit or null",
      "reference": "reference range or null",
      "status": "normal" | "high" | "low" | "critical" | "borderline" | "unknown"
    }
  ],
  "medications": [
    {
      "name": "medication name",
      "dosage": "dosage or null",
      "frequency": "frequency or null",
      "duration": "duration or null",
      "route": "route or null",
      "instructions": "special instructions or null"
    }
  ],
  "diagnosis": [
    {
      "code": "ICD code or null",
      "description": "diagnosis description",
      "severity": "mild" | "moderate" | "severe" | null
    }
  ],
  "findings": "radiology findings text or null",
  "impression": "radiology impression or null",
  "recommendations": "follow-up recommendations or null",
  "remarks": "general remarks or clinical notes or null",
  "procedures": [],
  "allergies": [],
  "observations": [],
  "additional_fields": {}
}

Rules:
- Return ONLY the JSON object. No explanation text before or after.
- Extract EVERY test result visible in the document.
- For test status: compare result against reference range if available.
- For missing fields use null, for empty lists use [].
- Never invent data. Only extract what is visibly present.
- Normalize test names (e.g. "HB", "Hgb", "Haemoglobin" all → "Hemoglobin").
- Include ALL medication details visible on the document.
"""


class GeminiExtractor:
    """
    Gemini-powered document extraction.
    Initialized lazily — no startup cost if key is not configured.
    """

    def __init__(self) -> None:
        self._initialized = False
        self._client = None
        self._model_name: str = "gemini-1.5-flash"

    def _ensure_init(self) -> bool:
        if self._initialized:
            return self._client is not None
        self._initialized = True

        from app.core.config import settings
        key = settings.GEMINI_API_KEY.strip()
        if not key:
            logger.info("GEMINI_API_KEY not set — Gemini extraction disabled.")
            return False

        try:
            import google.generativeai as genai
            genai.configure(api_key=key)
            self._model_name = settings.GEMINI_MODEL or "gemini-1.5-flash"
            self._client = genai
            logger.info("Gemini extractor ready [model=%s]", self._model_name)
            return True
        except Exception as exc:
            logger.error("Gemini init failed: %s", exc)
            return False

    # ── Public entry point ────────────────────────────────────────────────

    def extract(
        self,
        file_bytes: bytes,
        mime_type: str,
        filename: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Extract structured clinical JSON from a document.
        Returns None on failure (caller should use regex fallback).
        """
        if not self._ensure_init():
            return None

        t0 = time.perf_counter()
        try:
            result = self._call_gemini(file_bytes, mime_type)
            duration = time.perf_counter() - t0
            if result:
                result.setdefault("parser_metadata", {}).update({
                    "version":    "gemini-1.0",
                    "engine":     self._model_name,
                    "parsed_at":  datetime.utcnow().isoformat(),
                    "duration_s": round(duration, 2),
                })
                logger.info(
                    "Gemini extraction complete [file=%s duration=%.2fs tests=%d]",
                    filename, duration, len(result.get("tests", [])),
                )
            return result
        except Exception as exc:
            logger.error("Gemini extraction failed [file=%s]: %s", filename, exc)
            return None

    # ── Internal call ─────────────────────────────────────────────────────

    def _call_gemini(
        self, file_bytes: bytes, mime_type: str
    ) -> Optional[Dict[str, Any]]:
        import google.generativeai as genai

        # Try models in fallback order
        models_to_try = [
            self._model_name,
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-pro-vision",
        ]
        # Deduplicate while preserving order
        seen = set()
        models_to_try = [m for m in models_to_try if not (m in seen or seen.add(m))]

        parts = self._pdf_parts(file_bytes) if mime_type == "application/pdf" else [
            {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(file_bytes).decode()}},
            "Extract all medical data from this document and return as JSON.",
        ]

        last_error = None
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=_SYSTEM_PROMPT,
                )
                response = model.generate_content(
                    parts,
                    generation_config=genai.GenerationConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                    ),
                )
                text = response.text.strip()
                result = self._parse_response(text)
                if result:
                    logger.info("Gemini success [model=%s]", model_name)
                    self._model_name = model_name  # remember the working model
                    return result
            except Exception as exc:
                last_error = exc
                logger.warning("Gemini model %s failed: %s — trying next", model_name, exc)
                continue

        logger.error("All Gemini models failed. Last error: %s", last_error)
        return None

    def _pdf_parts(self, pdf_bytes: bytes) -> list:
        """For PDFs: try text first (fast), fall back to rendering first page as image."""
        try:
            import fitz
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pages_text = []
            for page in doc:
                pages_text.append(page.get_text())
            doc.close()
            full_text = "\n".join(pages_text).strip()

            if len(full_text) >= 100:
                # Digital PDF — send as text
                return [
                    f"Medical document text extracted from PDF:\n\n{full_text[:8000]}\n\nExtract all medical data and return as JSON.",
                ]
            else:
                # Scanned PDF — render first page as image and send to Vision
                import fitz
                doc2 = fitz.open(stream=pdf_bytes, filetype="pdf")
                page = doc2[0]
                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                doc2.close()
                return [
                    {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(img_bytes).decode()}},
                    "This is a scanned medical document. Extract all medical data and return as JSON.",
                ]
        except Exception as exc:
            logger.warning("PDF processing for Gemini failed: %s", exc)
            return [
                f"Medical document (PDF, {len(pdf_bytes)} bytes). Extract any available medical data and return as JSON.",
            ]

    def _parse_response(self, text: str) -> Optional[Dict[str, Any]]:
        """Parse Gemini's JSON response with three recovery strategies."""
        # Strategy 1: direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 2: extract JSON block
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass

        # Strategy 3: bracket repair
        try:
            repaired = text
            open_b = repaired.count('{') - repaired.count('}')
            open_a = repaired.count('[') - repaired.count(']')
            repaired += ']' * max(0, open_a) + '}' * max(0, open_b)
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        logger.warning("Could not parse Gemini response as JSON")
        return None


# Module-level singleton
gemini_extractor = GeminiExtractor()
