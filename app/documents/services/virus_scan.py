"""
app/documents/services/virus_scan.py
--------------------------------------
Malware scanning shim — delegates to YARA.

This module preserves the original upload interface while the
backend uses yara-python and a dedicated startup-initialized scanner.

`virus_scanner.scan(file_path, filename)` returns a VirusScanResult with:
  - is_clean     : bool
  - threat       : str  (rule names or generic error)
  - error        : Optional[str]
  - matched_rules: List[str]
  - matched_tags : List[str]
  - matched_meta : List[dict]
  - scan_duration: float
"""

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from app.documents.services.yara_scanner import yara_scanner

logger = logging.getLogger(__name__)


@dataclass
class VirusScanResult:
    is_clean: bool
    threat: str = ""
    error: Optional[str] = None
    matched_rules: List[str] = field(default_factory=list)
    matched_tags: List[str] = field(default_factory=list)
    matched_meta: List[dict] = field(default_factory=list)
    scan_duration: float = 0.0


class VirusScannerService:
    """
    Thin adapter that wraps the shared YARA scanner and preserves the
    existing async scan interface for upload.py.
    """

    async def scan(self, file_path: str, filename: str) -> VirusScanResult:
        try:
            with open(file_path, "rb") as fp:
                data = fp.read()
        except Exception as exc:
            logger.exception("Failed to read temporary upload file for scanning: %s", exc)
            return VirusScanResult(
                is_clean=False,
                threat="Scanner error",
                error=str(exc),
            )

        result = yara_scanner.scan_bytes(data, filename)

        if result.error:
            return VirusScanResult(
                is_clean=False,
                threat="Scanner error",
                error=result.error,
                scan_duration=result.scan_duration,
            )

        if not result.is_clean:
            threat = ", ".join(result.matched_rules) or "malware detected"
            return VirusScanResult(
                is_clean=False,
                threat=threat,
                matched_rules=result.matched_rules,
                matched_tags=result.matched_tags,
                matched_meta=result.matched_meta,
                scan_duration=result.scan_duration,
            )

        return VirusScanResult(is_clean=True, scan_duration=result.scan_duration)


# Singleton — same name as before so upload.py import is unchanged
virus_scanner = VirusScannerService()
