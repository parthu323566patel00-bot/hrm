"""
app/schemas/inventory_requisition.py
--------------------------------------
Purchase Requisition schemas.
Reuses PageMeta from app.schemas.inventory (single source of truth).
"""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.inventory import PageMeta  # noqa: F401 — re-exported


# ---------------------------------------------------------------------------
# Requisition Item schemas
# ---------------------------------------------------------------------------

class PurchaseRequisitionItemCreate(BaseModel):
    product_id: int
    requested_quantity: float
    estimated_unit_price: float = 0.0
    remarks: Optional[str] = None

    @field_validator("requested_quantity", mode="before")
    @classmethod
    def validate_quantity(cls, v: float) -> float:
        if v is None or v <= 0:
            raise ValueError("Requested quantity must be greater than zero.")
        return v

    @field_validator("estimated_unit_price", mode="before")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v is None or v < 0:
            raise ValueError("Estimated unit price must be zero or positive.")
        return v


class PurchaseRequisitionItemOut(BaseModel):
    id: int
    requisition_id: int
    product_id: int
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    requested_quantity: float
    estimated_unit_price: float
    estimated_total: float
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Requisition schemas
# ---------------------------------------------------------------------------

VALID_STATUSES = {"draft", "pending", "approved", "rejected", "cancelled", "converted"}
VALID_PRIORITIES = {"low", "normal", "high", "urgent"}


class PurchaseRequisitionCreate(BaseModel):
    requested_date: date
    required_date: Optional[date] = None
    department_id: Optional[int] = None
    supplier_id: Optional[int] = None
    priority: str = "normal"
    remarks: Optional[str] = None
    items: List[PurchaseRequisitionItemCreate]

    @field_validator("priority", mode="before")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        if v not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}.")
        return v

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: List[PurchaseRequisitionItemCreate]) -> List[PurchaseRequisitionItemCreate]:
        if not v:
            raise ValueError("Requisition must contain at least one item.")
        return v


class PurchaseRequisitionUpdate(BaseModel):
    """Only allowed while status is draft."""
    required_date: Optional[date] = None
    department_id: Optional[int] = None
    supplier_id: Optional[int] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[PurchaseRequisitionItemCreate]] = None

    @field_validator("priority", mode="before")
    @classmethod
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}.")
        return v


class PurchaseRequisitionApprove(BaseModel):
    remarks: Optional[str] = None


class PurchaseRequisitionReject(BaseModel):
    remarks: str

    @field_validator("remarks", mode="before")
    @classmethod
    def validate_remarks(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Rejection reason is required.")
        return v.strip()


class PurchaseRequisitionConvert(BaseModel):
    """Convert approved requisition to Purchase Order."""
    supplier_id: int
    purchase_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    remarks: Optional[str] = None


class PurchaseRequisitionOut(BaseModel):
    id: int
    tenant_id: str
    requisition_number: str
    requested_by: int
    requested_by_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    status: str
    priority: str
    remarks: Optional[str] = None
    requested_date: date
    required_date: Optional[date] = None
    approved_by: Optional[int] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    converted_po_id: Optional[int] = None
    total_estimated_amount: float
    is_deleted: bool
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseRequisitionItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class PurchaseRequisitionPageOut(BaseModel):
    data: List[PurchaseRequisitionOut]
    meta: PageMeta
