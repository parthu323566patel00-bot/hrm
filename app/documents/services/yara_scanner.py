"""
app/documents/services/yara_scanner.py
----------------------------------------
YARA-based malware scanner for the document upload pipeline.

Key design decisions:
  - Rules are compiled ONCE at application startup via lifespan event.
  - Each scan reuses the compiled ruleset — no per-request compilation.
  - Rule loading is fault-tolerant: a syntax error in one .yar file
    logs the error, skips that file, and continues with the rest.
  - Scanning is disabled if YARA_ENABLED=false (defaults to true).
  - Never exposes filesystem paths or raw YARA objects in API responses.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
_YARA_ENABLED   = os.environ.get("YARA_ENABLED", "true").lower() == "true"
_YARA_RULES_DIR = os.environ.get(
    "YARA_RULES_PATH",
    str(Path(__file__).resolve().parents[3] / "app" / "security" / "yara_rules"),
)


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class ScanResult:
    is_clean:      bool
    matched_rules: List[str]           = field(default_factory=list)
    matched_tags:  List[str]           = field(default_factory=list)
    matched_meta:  List[dict]          = field(default_factory=list)
    scan_duration: float               = 0.0   # seconds
    error:         Optional[str]       = None


# ── YARA Scanner ─────────────────────────────────────────────────────────────

class YaraScanner:
    """
    Thread-safe YARA scanner.
    Rules are compiled once; `initialize()` is called during app startup.
    """

    def __init__(self) -> None:
        self._rules    = None   # compiled yara.Rules object
        self._enabled  = _YARA_ENABLED
        self._rules_dir = _YARA_RULES_DIR

    # ── Startup ────────────────────────────────────────────────────────────

    def initialize(self) -> None:
        """
        Compile all .yar / .yara files in the rules directory.
        Called once during FastAPI lifespan startup.
        Logs errors for bad rules but never raises — app must start.
        """
        if not self._enabled:
            logger.info("YARA scanning is DISABLED (YARA_ENABLED=false).")
            return

        try:
            import yara
        except ImportError:
            logger.error(
                "yara-python not installed. "
                "Install it with: pip install yara-python. "
                "YARA scanning will be skipped."
            )
            self._enabled = False
            return

        rules_path = Path(self._rules_dir)
        if not rules_path.is_dir():
            logger.warning(
                "YARA rules directory not found: %s — scanning disabled.",
                self._rules_dir,
            )
            self._enabled = False
            return

        rule_files = sorted(
            p for p in rules_path.iterdir()
            if p.suffix.lower() in (".yar", ".yara") and p.is_file()
        )

        if not rule_files:
            logger.warning(
                "No YARA rule files found in %s — scanning disabled.",
                self._rules_dir,
            )
            self._enabled = False
            return

        # Compile each file individually so one bad rule doesn't block the rest
        filepaths: dict[str, str] = {}
        skipped = 0
        for rule_file in rule_files:
            ns = rule_file.stem   # namespace = filename without extension
            try:
                yara.compile(filepath=str(rule_file))   # syntax check only
                filepaths[ns] = str(rule_file)
                logger.debug("YARA rule loaded: %s", rule_file.name)
            except yara.SyntaxError as exc:
                logger.error(
                    "YARA rule syntax error in %s — skipping: %s",
                    rule_file.name, exc,
                )
                skipped += 1
            except Exception as exc:
                logger.error(
                    "Failed to load YARA rule %s — skipping: %s",
                    rule_file.name, exc,
                )
                skipped += 1

        if not filepaths:
            logger.error(
                "All %d YARA rule file(s) failed to compile — "
                "scanning disabled.",
                skipped,
            )
            self._enabled = False
            return

        # Compile validated files into a single ruleset
        try:
            self._rules = yara.compile(filepaths=filepaths)
            logger.info(
                "YARA scanner initialised: %d rule file(s) compiled "
                "(%d skipped due to errors).",
                len(filepaths), skipped,
            )
        except Exception as exc:
            logger.error("YARA rules final compilation failed: %s — scanning disabled.", exc)
            self._enabled = False

    # ── Scan ──────────────────────────────────────────────────────────────

    def scan_bytes(self, data: bytes, filename: str = "<upload>") -> ScanResult:
        """
        Scan raw bytes against the compiled ruleset.

        Returns a ScanResult — never raises.
        If YARA is disabled or rules failed to load, returns clean=True
        so the upload proceeds (fail-open, not fail-closed).
        """
        if not self._enabled or self._rules is None:
            return ScanResult(is_clean=True)

        try:
            import yara
        except ImportError:
            return ScanResult(is_clean=True)

        logger.info("YARA scan started [file=%s size=%d bytes]", filename, len(data))
        t0 = time.perf_counter()

        try:
            matches = self._rules.match(data=data)
            duration = time.perf_counter() - t0

            if not matches:
                logger.info(
                    "YARA scan clean [file=%s duration=%.3fs]",
                    filename, duration,
                )
                return ScanResult(is_clean=True, scan_duration=duration)

            # Malware detected — collect details without exposing raw objects
            rule_names = [m.rule for m in matches]
            tags        = [tag for m in matches for tag in m.tags]
            meta        = [dict(m.meta) for m in matches if m.meta]

            logger.warning(
                "YARA malware detected [file=%s rules=%s duration=%.3fs]",
                filename, rule_names, duration,
            )
            return ScanResult(
                is_clean=False,
                matched_rules=rule_names,
                matched_tags=tags,
                matched_meta=meta,
                scan_duration=duration,
            )

        except Exception as exc:
            duration = time.perf_counter() - t0
            logger.exception(
                "YARA scan error [file=%s duration=%.3fs]: %s",
                filename, duration, exc,
            )
            return ScanResult(
                is_clean=False,
                error=str(exc),
                scan_duration=duration,
            )


# ── Module-level singleton ────────────────────────────────────────────────────
# `initialize()` is called from app/main.py lifespan startup.
yara_scanner = YaraScanner()
