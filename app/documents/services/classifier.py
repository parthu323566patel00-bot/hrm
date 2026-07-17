"""
app/documents/services/classifier.py
--------------------------------------
Keyword + heuristic document type classification.
Works on raw OCR text. No ML model needed.
"""

import re
from typing import Tuple

# (document_type, keywords, score_weight)
RULES = [
    ("lab_report", [
        "laboratory", "lab report", "blood test", "haemoglobin", "hemoglobin",
        "wbc", "rbc", "platelets", "serum", "plasma", "creatinine", "glucose",
        "hba1c", "lipid", "cholesterol", "triglyceride", "urine", "urinalysis",
        "complete blood count", "cbc", "lft", "kft", "thyroid", "tsh", "t3", "t4",
    ], 3),
    ("radiology", [
        "radiology", "x-ray", "xray", "mri", "ct scan", "ultrasound", "sonography",
        "imaging", "radiograph", "echocardiogram", "mammography", "pet scan",
        "impression:", "findings:", "technique:", "contrast", "no acute",
    ], 3),
    ("prescription", [
        "prescription", "rx", "medication", "tablet", "capsule", "mg", "ml",
        "dosage", "dose", "twice daily", "once daily", "three times", "tds", "bd",
        "od", "sos", "syrup", "injection", "inj", "sig:", "refill",
    ], 2),
    ("discharge_summary", [
        "discharge summary", "discharge", "admitted", "admission date",
        "discharge date", "diagnosis on discharge", "follow up", "follow-up",
        "hospital course", "procedures performed", "condition on discharge",
    ], 3),
    ("insurance", [
        "insurance", "claim", "policy number", "insurer", "beneficiary",
        "pre-authorization", "authorization", "tpa", "cashless",
        "reimbursement", "copay", "deductible",
    ], 3),
    ("referral", [
        "referral", "referred to", "refer", "specialist", "consultation requested",
        "please see", "for further management", "opinion requested",
    ], 2),
    ("consent", [
        "consent", "informed consent", "i hereby consent", "patient consent",
        "voluntary consent", "signature", "witness", "agree to",
    ], 2),
    ("id_proof", [
        "aadhar", "aadhaar", "passport", "driving license", "voter id",
        "pan card", "date of birth", "dob", "nationality", "government of india",
        "identity card",
    ], 3),
    ("billing", [
        "invoice", "bill", "receipt", "payment", "amount due", "total amount",
        "hospital charges", "bed charges", "consultation fee", "tax invoice",
        "gst", "paid", "balance due",
    ], 2),
]


def classify(raw_text: str) -> Tuple[str, float]:
    """
    Returns (document_type, confidence 0.0-1.0).
    Falls back to 'misc' with 0.0 confidence if no match.
    """
    if not raw_text or len(raw_text.strip()) < 10:
        return "misc", 0.0

    lower = raw_text.lower()
    scores: dict[str, int] = {}

    for doc_type, keywords, weight in RULES:
        score = sum(weight for kw in keywords if kw in lower)
        if score > 0:
            scores[doc_type] = score

    if not scores:
        return "misc", 0.0

    best_type = max(scores, key=lambda k: scores[k])
    total     = sum(scores.values())
    confidence = min(scores[best_type] / max(total, 1), 1.0)

    return best_type, round(confidence, 3)
