"""
app/schemas/inventory_procurement.py
--------------------------------------
Procurement schemas: Purchase Orders and Goods Receipts.

Supplier schemas are imported from app.schemas.inventory (single source of truth).
PageMeta is imported from app.schemas.inventory (single source of truth).
"""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator, ValidationInfo

# Re-export from canonical location — no duplication
from app.schemas.inventory import PageMeta, SupplierCreate, SupplierOut, SupplierUpdate  # noqa: F401


# ---------------------------------------------------------------------------
# Purchase Order schemas
# ---------------------------------------------------------------------------

class PurchaseOrderItemBase(BaseModel):
    product_id: int
    quantity: float
    expected_unit_price: float
    tax_percent: float = 0.0
    discount_percent: float = 0.0

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_quantity(cls, value: float) -> float:
        if value is None or value <= 0:
            raise ValueError("Quantity must be greater than zero.")
        return value

    @field_validator("expected_unit_price", "tax_percent", "discount_percent", mode="before")
    @classmethod
    def validate_non_negative(cls, value: float) -> float:
        if value is None or value < 0:
            raise ValueError("Value must be zero or positive.")
        return value


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass


class PurchaseOrderItemOut(PurchaseOrderItemBase):
    id: int
    total_amount: float
    received_quantity: float
    created_at: datetime
    updated_at: datetime
    product_name: Optional[str] = None
    product_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    purchase_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    remarks: Optional[str] = None
    items: List[PurchaseOrderItemCreate]

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: List[PurchaseOrderItemCreate]) -> List[PurchaseOrderItemCreate]:
        if not value:
            raise ValueError("Purchase order must contain at least one item.")
        return value


class PurchaseOrderUpdate(BaseModel):
    expected_delivery_date: Optional[datetime] = None
    remarks: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        allowed = {"draft", "pending", "partially_received", "completed", "cancelled"}
        if value not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(sorted(allowed))}.")
        return value


class PurchaseOrderOut(BaseModel):
    id: int
    supplier_id: int
    po_number: str
    purchase_date: datetime
    expected_delivery_date: Optional[datetime] = None
    status: str
    remarks: Optional[str] = None
    total_amount: float
    requisition_id: Optional[int] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    supplier_name: Optional[str] = None
    items: List[PurchaseOrderItemOut]

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderPageOut(BaseModel):
    data: List[PurchaseOrderOut]
    meta: PageMeta


# ---------------------------------------------------------------------------
# Goods Receipt schemas
# ---------------------------------------------------------------------------

class GoodsReceiptItemBase(BaseModel):
    purchase_order_item_id: int
    product_id: int
    received_quantity: float
    unit_cost: float
    batch_number: str
    manufacturing_date: date
    expiry_date: date
    tax_percent: float = 0.0
    discount_percent: float = 0.0

    @field_validator("received_quantity", mode="before")
    @classmethod
    def validate_received_quantity(cls, value: float) -> float:
        if value is None or value <= 0:
            raise ValueError("Received quantity must be greater than zero.")
        return value

    @field_validator("unit_cost", "tax_percent", "discount_percent", mode="before")
    @classmethod
    def validate_non_negative(cls, value: float) -> float:
        if value is None or value < 0:
            raise ValueError("Value must be zero or positive.")
        return value

    @field_validator("batch_number", mode="before")
    @classmethod
    def validate_batch_number(cls, value: str) -> str:
        if value is None:
            raise ValueError("Batch number is required.")
        value = value.strip()
        if not value:
            raise ValueError("Batch number cannot be empty.")
        return value

    @field_validator("expiry_date")
    @classmethod
    def validate_dates(cls, value: date, info: ValidationInfo) -> date:
        mfg = info.data.get("manufacturing_date")
        if mfg and value and mfg > value:
            raise ValueError("Expiry date must be after manufacturing date.")
        return value


class GoodsReceiptItemCreate(GoodsReceiptItemBase):
    pass


class GoodsReceiptItemOut(GoodsReceiptItemBase):
    id: int
    total_amount: float
    created_at: datetime
    updated_at: datetime
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    purchase_order_item_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class GoodsReceiptCreate(BaseModel):
    purchase_order_id: int
    received_date: Optional[datetime] = None
    remarks: Optional[str] = None
    items: List[GoodsReceiptItemCreate]

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: List[GoodsReceiptItemCreate]) -> List[GoodsReceiptItemCreate]:
        if not value:
            raise ValueError("Goods receipt must contain at least one item.")
        return value


class GoodsReceiptOut(BaseModel):
    id: int
    purchase_order_id: int
    supplier_id: int
    receipt_number: str
    received_date: datetime
    remarks: Optional[str] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    supplier_name: Optional[str] = None
    purchase_order_number: Optional[str] = None
    items: List[GoodsReceiptItemOut]

    model_config = ConfigDict(from_attributes=True)


class GoodsReceiptPageOut(BaseModel):
    data: List[GoodsReceiptOut]
    meta: PageMeta
