"""
app/documents/services/parser.py
----------------------------------
Normalized clinical document parser.

Produces a canonical clinical schema regardless of report layout variations.
All document types normalize to the same top-level envelope:

{
  "document_type": "...",
  "patient":       { name, age, gender, dob, id, phone, address },
  "provider":      { doctor, lab_name, hospital, address, contact },
  "encounter":     { date, report_date, report_number, accession },
  "tests":         [ { name, result, unit, reference, status } ],
  "medications":   [ { name, dosage, frequency, duration, route, instructions } ],
  "diagnosis":     [ { code, description, severity } ],
  "procedures":    [ ... ],
  "observations":  [ { key, value } ],
  "allergies":     [ ... ],
  "remarks":       "...",
  "findings":      "...",
  "impression":    "...",
  "recommendations": "...",
  "parser_metadata": { version, parsed_at, confidence, engine },
  "additional_fields": { ... }  <- never discard extracted data
}
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

PARSER_VERSION = "2.0.0"

# ── Test name aliases for normalization ───────────────────────────────────────
_TEST_ALIASES: Dict[str, str] = {
    # Haematology
    "hb": "Hemoglobin", "hgb": "Hemoglobin", "haemoglobin": "Hemoglobin",
    "hct": "Hematocrit", "pcv": "Hematocrit",
    "wbc": "White Blood Cell Count", "tlc": "White Blood Cell Count",
    "rbc": "Red Blood Cell Count",
    "plt": "Platelets", "platelet": "Platelets", "thrombocytes": "Platelets",
    "mcv": "MCV", "mch": "MCH", "mchc": "MCHC",
    "esr": "ESR",
    # Biochemistry
    "glu": "Glucose", "fbs": "Fasting Blood Sugar", "rbs": "Random Blood Sugar",
    "hba1c": "HbA1c", "glycated haemoglobin": "HbA1c",
    "cr": "Creatinine", "scr": "Creatinine",
    "bun": "Blood Urea Nitrogen", "urea": "Blood Urea",
    "na": "Sodium", "sodium": "Sodium",
    "k": "Potassium", "potassium": "Potassium",
    "cl": "Chloride",
    "tsh": "TSH", "t3": "T3", "t4": "T4",
    "alt": "ALT (SGPT)", "sgpt": "ALT (SGPT)",
    "ast": "AST (SGOT)", "sgot": "AST (SGOT)",
    "alp": "Alkaline Phosphatase",
    "bil": "Bilirubin", "tbil": "Total Bilirubin", "dbil": "Direct Bilirubin",
    "chol": "Cholesterol", "tc": "Total Cholesterol",
    "tg": "Triglycerides", "hdl": "HDL Cholesterol", "ldl": "LDL Cholesterol",
}


def _normalize_test_name(raw: str) -> str:
    key = raw.strip().lower()
    return _TEST_ALIASES.get(key, raw.strip().title())


def _classify_result(value_str: str, ref: Optional[str]) -> str:
    """
    Returns 'normal' | 'high' | 'low' | 'critical' | 'borderline' | 'unknown'.
    """
    if not ref or not value_str:
        return "unknown"
    try:
        val = float(re.sub(r"[^\d.\-]", "", value_str))
        m = re.search(r"([\d.]+)\s*[-–]\s*([\d.]+)", ref)
        if m:
            low, high = float(m.group(1)), float(m.group(2))
            margin = (high - low) * 0.1
            if val < low - margin:
                return "low"
            if val > high + margin:
                return "high"
            if val < low or val > high:
                return "borderline"
            return "normal"
    except (ValueError, AttributeError):
        pass
    return "unknown"


def _extract_field(text: str, labels: List[str]) -> Optional[str]:
    """Extract text after a label on the same line."""
    for label in labels:
        pattern = rf"(?i){re.escape(label)}\s*[:\-]?\s*(.+)"
        m = re.search(pattern, text)
        if m:
            return m.group(1).strip()
    return None


def _extract_section(text: str, headers: List[str]) -> Optional[str]:
    """Extract a section block after a header."""
    lower = text.lower()
    for header in headers:
        idx = lower.find(header.lower())
        if idx == -1:
            continue
        start = idx + len(header)
        segment = text[start:start + 600].strip()
        lines = []
        for line in segment.splitlines():
            if not line.strip():
                break
            lines.append(line.strip())
        if lines:
            return " ".join(lines)
    return None


def _build_patient(text: str) -> dict:
    return {
        "name":    _extract_field(text, ["patient name", "patient", "name"]),
        "age":     _extract_field(text, ["age"]),
        "gender":  _extract_field(text, ["gender", "sex"]),
        "dob":     _extract_field(text, ["date of birth", "dob", "d.o.b"]),
        "id":      _extract_field(text, ["patient id", "uhid", "mr no", "mrn"]),
        "phone":   _extract_field(text, ["mobile", "phone", "contact"]),
        "address": _extract_field(text, ["address"]),
    }


def _build_provider(text: str) -> dict:
    return {
        "doctor":    _extract_field(text, ["referring doctor", "doctor", "dr.", "physician", "consultant"]),
        "lab_name":  _extract_field(text, ["laboratory", "lab name", "centre"]),
        "hospital":  _extract_field(text, ["hospital", "clinic", "institute"]),
        "address":   _extract_field(text, ["lab address"]),
        "contact":   _extract_field(text, ["lab contact", "lab phone"]),
    }


def _build_encounter(text: str) -> dict:
    return {
        "date":          _extract_field(text, ["sample date", "collection date", "date of collection", "visit date"]),
        "report_date":   _extract_field(text, ["report date", "reported on", "reporting date"]),
        "report_number": _extract_field(text, ["report no", "report number", "accession no"]),
        "accession":     _extract_field(text, ["accession", "lab ref", "sample id"]),
    }


def _meta(confidence: Optional[float] = None, ocr_engine: str = "") -> dict:
    return {
        "version":    PARSER_VERSION,
        "parsed_at":  datetime.utcnow().isoformat(),
        "confidence": confidence,
        "engine":     ocr_engine,
    }


# ── Per-type parsers ──────────────────────────────────────────────────────────

_LAB_LINE = re.compile(
    r"([A-Za-z][A-Za-z\s\(\)/\-]{1,50}?)\s+"
    r"([\d.,]+)\s*"
    r"([a-zA-Z%/µ°\^]+)?\s*"
    r"([\d.,\-–]+\s*[-–]\s*[\d.,]+)?",
    re.IGNORECASE,
)


def _parse_lab_report(text: str, conf: Optional[float]) -> Dict[str, Any]:
    tests = []
    for line in text.splitlines():
        m = _LAB_LINE.search(line)
        if not m:
            continue
        name_raw, value_str, unit, ref = m.groups()
        name_raw = name_raw.strip()
        if len(name_raw) < 2:
            continue
        try:
            float(value_str.replace(",", ""))
        except ValueError:
            continue
        normalized_name = _normalize_test_name(name_raw)
        status = _classify_result(value_str, ref)
        tests.append({
            "name":      normalized_name,
            "raw_name":  name_raw,
            "result":    value_str.strip(),
            "unit":      unit.strip() if unit else None,
            "reference": ref.strip() if ref else None,
            "status":    status,
        })

    abnormal = [t for t in tests if t["status"] in ("high", "low", "critical")]

    return {
        "document_type":   "lab_report",
        "patient":         _build_patient(text),
        "provider":        _build_provider(text),
        "encounter":       _build_encounter(text),
        "tests":           tests,
        "medications":     [],
        "diagnosis":       [],
        "procedures":      [],
        "observations":    [{"key": "Abnormal Count", "value": str(len(abnormal))}],
        "allergies":       [],
        "remarks":         _extract_section(text, ["remarks", "comment", "interpretation", "note"]),
        "findings":        None,
        "impression":      None,
        "recommendations": None,
        "parser_metadata": _meta(conf),
        "additional_fields": {},
    }


_DOSE_RE = re.compile(r"(\d+\s*mg|\d+\s*ml|\d+\s*mcg|\d+\s*g)", re.IGNORECASE)
_FREQ_RE = re.compile(r"\b(once|twice|thrice|tds|bd|od|sos|daily|weekly|morning|night)\b", re.IGNORECASE)


def _parse_prescription(text: str, conf: Optional[float]) -> Dict[str, Any]:
    medications = []
    for line in text.splitlines():
        line = line.strip()
        if len(line) < 5:
            continue
        dose_m = _DOSE_RE.search(line)
        freq_m = _FREQ_RE.search(line)
        if dose_m or freq_m:
            medications.append({
                "name":         line[:60],
                "dosage":       dose_m.group(0) if dose_m else None,
                "frequency":    freq_m.group(0) if freq_m else None,
                "duration":     None,
                "route":        None,
                "instructions": None,
            })
    return {
        "document_type":   "prescription",
        "patient":         _build_patient(text),
        "provider":        _build_provider(text),
        "encounter":       _build_encounter(text),
        "tests":           [],
        "medications":     medications,
        "diagnosis":       [],
        "procedures":      [],
        "observations":    [],
        "allergies":       [],
        "remarks":         _extract_section(text, ["remarks", "notes", "advice"]),
        "findings":        None,
        "impression":      None,
        "recommendations": None,
        "parser_metadata": _meta(conf),
        "additional_fields": {},
    }


def _parse_radiology(text: str, conf: Optional[float]) -> Dict[str, Any]:
    return {
        "document_type":   "radiology",
        "patient":         _build_patient(text),
        "provider":        _build_provider(text),
        "encounter":       _build_encounter(text),
        "tests":           [],
        "medications":     [],
        "diagnosis":       [],
        "procedures":      [],
        "observations":    [],
        "allergies":       [],
        "remarks":         _extract_section(text, ["remarks", "note"]),
        "findings":        _extract_section(text, ["findings:", "finding:"]),
        "impression":      _extract_section(text, ["impression:", "conclusion:"]),
        "recommendations": _extract_section(text, ["recommendation:", "advice:"]),
        "parser_metadata": _meta(conf),
        "additional_fields": {
            "technique":  _extract_section(text, ["technique:", "method:"]),
        },
    }


def _parse_discharge(text: str, conf: Optional[float]) -> Dict[str, Any]:
    diag_text = _extract_section(text, ["diagnosis:", "final diagnosis:", "discharge diagnosis:"])
    diag = [{"code": None, "description": diag_text, "severity": None}] if diag_text else []
    return {
        "document_type":   "discharge_summary",
        "patient":         _build_patient(text),
        "provider":        _build_provider(text),
        "encounter":       {
            **_build_encounter(text),
            "admission_date": _extract_field(text, ["admission date", "date of admission"]),
            "discharge_date": _extract_field(text, ["discharge date", "date of discharge"]),
        },
        "tests":           [],
        "medications":     [],
        "diagnosis":       diag,
        "procedures":      [{"description": _extract_section(text, ["procedures:", "procedure performed:"])}]
                           if _extract_section(text, ["procedures:", "procedure performed:"]) else [],
        "observations":    [],
        "allergies":       [],
        "remarks":         _extract_section(text, ["advice:", "instructions:", "follow up:"]),
        "findings":        None,
        "impression":      None,
        "recommendations": _extract_section(text, ["follow up:", "follow-up:"]),
        "parser_metadata": _meta(conf),
        "additional_fields": {
            "condition_on_discharge": _extract_section(text, ["condition on discharge:"]),
        },
    }


def _parse_unknown(text: str, conf: Optional[float]) -> Dict[str, Any]:
    return {
        "document_type":   "unknown",
        "patient":         _build_patient(text),
        "provider":        _build_provider(text),
        "encounter":       _build_encounter(text),
        "tests":           [],
        "medications":     [],
        "diagnosis":       [],
        "procedures":      [],
        "observations":    [],
        "allergies":       [],
        "remarks":         text[:500] if text else None,
        "findings":        None,
        "impression":      None,
        "recommendations": None,
        "parser_metadata": _meta(conf),
        "additional_fields": {"raw_text_preview": text[:1000]},
    }


# ── Public entry point ────────────────────────────────────────────────────────

def parse(
    document_type: str,
    raw_text: str,
    confidence: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """
    Parse raw OCR text into a normalized clinical JSON schema.
    Returns None only if raw_text is empty.
    Never raises — on any error returns the unknown fallback.
    """
    if not raw_text or len(raw_text.strip()) < 10:
        return None

    parsers = {
        "lab_report":       _parse_lab_report,
        "prescription":     _parse_prescription,
        "radiology":        _parse_radiology,
        "discharge_summary": _parse_discharge,
    }

    fn = parsers.get(document_type, _parse_unknown)
    try:
        result = fn(raw_text, confidence)
        # Strip all-None patient/provider sub-keys to keep JSON clean
        for section in ("patient", "provider", "encounter"):
            if section in result:
                result[section] = {k: v for k, v in result[section].items() if v is not None}
        return result
    except Exception as exc:
        logger.exception("Parser failed for %s: %s", document_type, exc)
        return _parse_unknown(raw_text, confidence)
