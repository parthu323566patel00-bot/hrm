"""
app/documents/schemas.py
-------------------------
Pydantic schemas for the Document Management Pipeline.
"""

from typing import Any, Dict, Optional
from datetime import datetime
from pydantic import BaseModel


class DocumentStatusOut(BaseModel):
    id: int
    status: str
    document_type: str
    original_filename: str

    class Config:
        from_attributes = True


class DocumentMetaOut(BaseModel):
    id: int
    tenant_id: str
    patient_id: int
    visit_id: Optional[int]
    uploaded_by: int
    document_type: str
    original_filename: str
    file_size: int
    mime_type: str
    status: str
    is_duplicate: bool
    uploaded_at: datetime

    class Config:
        from_attributes = True


class DocumentContentOut(BaseModel):
    document_id: int
    raw_text: Optional[str]
    structured_json: Optional[Dict[str, Any]]
    ocr_engine: Optional[str]
    ocr_status: str
    classified_as: Optional[str]
    confidence: Optional[float]
    parsed_at: Optional[datetime]

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    document_id: int
    status: str
    is_duplicate: bool
    message: str
