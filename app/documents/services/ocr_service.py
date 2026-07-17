"""
app/documents/services/ocr_service.py
---------------------------------------
Hybrid OCR pipeline:
  1. PDF with embedded text  → PyMuPDF (milliseconds, no AI)
  2. Scanned PDF / image     → PaddleOCR
  3. Handwritten detected    → raw text only, flag MANUAL_REVIEW_REQUIRED

PaddleOCR is imported lazily so startup is fast even if not installed.
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

HANDWRITTEN_KEYWORDS = [
    "handwritten", "handwriting", "cursive",
]

# Minimum character count from PyMuPDF to consider a PDF "digital"
MIN_DIGITAL_CHARS = 50


@dataclass
class OCRResult:
    raw_text: str
    engine: str                  # "pymupdf" | "paddleocr" | "none"
    is_handwritten: bool = False
    confidence: Optional[float] = None


class OCRService:

    def extract(self, file_bytes: bytes, mime_type: str, filename: str) -> OCRResult:
        """
        Synchronous extraction — called from background worker (runs in threadpool).
        Returns OCRResult with raw_text and engine used.
        """
        ext = os.path.splitext(filename)[1].lower()

        if mime_type == "application/pdf" or ext == ".pdf":
            return self._handle_pdf(file_bytes)
        else:
            return self._handle_image(file_bytes, mime_type)

    # ── PDF handling ──────────────────────────────────────────────────────────

    def _handle_pdf(self, data: bytes) -> OCRResult:
        text = self._pymupdf_extract(data)

        if len(text.strip()) >= MIN_DIGITAL_CHARS:
            logger.debug("PDF has embedded text (%d chars) — skipping OCR", len(text))
            return OCRResult(raw_text=text, engine="pymupdf")

        # Scanned PDF — try PaddleOCR on each page rendered as image
        logger.debug("PDF appears scanned — running PaddleOCR")
        return self._paddleocr_from_pdf(data)

    def _pymupdf_extract(self, data: bytes) -> str:
        try:
            import fitz  # pymupdf
            doc = fitz.open(stream=data, filetype="pdf")
            pages = [page.get_text() for page in doc]
            doc.close()
            return "\n".join(pages)
        except Exception as exc:
            logger.warning("PyMuPDF extraction failed: %s", exc)
            return ""

    def _paddleocr_from_pdf(self, data: bytes) -> OCRResult:
        try:
            import fitz
            doc = fitz.open(stream=data, filetype="pdf")
            all_text = []
            for page in doc:
                mat = fitz.Matrix(2, 2)          # 2x zoom for better OCR quality
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                result = self._run_paddleocr_on_image(img_bytes)
                all_text.append(result.raw_text)
            doc.close()
            combined = "\n".join(all_text)
            if self._is_handwritten(combined):
                return OCRResult(raw_text=combined, engine="paddleocr", is_handwritten=True)
            return OCRResult(raw_text=combined, engine="paddleocr")
        except Exception as exc:
            logger.error("PaddleOCR on PDF failed: %s", exc)
            return OCRResult(raw_text="", engine="none")

    # ── Image handling ────────────────────────────────────────────────────────

    def _handle_image(self, data: bytes, mime_type: str) -> OCRResult:
        result = self._run_paddleocr_on_image(data)
        if self._is_handwritten(result.raw_text):
            result.is_handwritten = True
        return result

    def _run_paddleocr_on_image(self, img_bytes: bytes) -> OCRResult:
        try:
            from paddleocr import PaddleOCR  # pip install paddleocr
            import numpy as np
            import cv2

            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            result = ocr.ocr(img, cls=True)

            lines = []
            confidences = []
            if result and result[0]:
                for line in result[0]:
                    text, conf = line[1]
                    lines.append(text)
                    confidences.append(conf)

            avg_conf = sum(confidences) / len(confidences) if confidences else None
            return OCRResult(
                raw_text="\n".join(lines),
                engine="paddleocr",
                confidence=avg_conf,
            )
        except ImportError:
            logger.warning("PaddleOCR not installed — falling back to Tesseract")
            return self._run_tesseract(img_bytes)
        except Exception as exc:
            logger.error("PaddleOCR failed: %s", exc)
            return OCRResult(raw_text="", engine="none")

    def _run_tesseract(self, img_bytes: bytes) -> OCRResult:
        """Fallback if PaddleOCR not installed."""
        try:
            from PIL import Image
            import pytesseract
            import io
            img = Image.open(io.BytesIO(img_bytes))
            text = pytesseract.image_to_string(img)
            return OCRResult(raw_text=text, engine="tesseract")
        except Exception as exc:
            logger.error("Tesseract fallback failed: %s", exc)
            return OCRResult(raw_text="", engine="none")

    # ── Handwriting detection ─────────────────────────────────────────────────

    def _is_handwritten(self, text: str) -> bool:
        """
        Heuristic: very short OCR output on a document that likely has content
        suggests handwriting (OCR produces garbage on cursive).
        Also checks for explicit handwriting markers.
        """
        if not text:
            return False
        lower = text.lower()
        if any(kw in lower for kw in HANDWRITTEN_KEYWORDS):
            return True
        # If OCR produced very little coherent text (< 20 chars) treat as handwritten
        words = [w for w in text.split() if len(w) > 2]
        return len(words) < 5


ocr_service = OCRService()
