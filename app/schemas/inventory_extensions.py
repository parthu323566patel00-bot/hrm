from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator


def _strip_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def _validate_quantity(value: float) -> float:
    if value is None or value <= 0:
        raise ValueError("Quantity must be greater than zero.")
    return value


class InventoryTransferItemCreate(BaseModel):
    product_id: int
    batch_number: Optional[str] = None
    quantity: float
    remarks: Optional[str] = None

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_quantity(cls, value: float) -> float:
        return _validate_quantity(value)


class InventoryTransferCreate(BaseModel):
    from_location_id: int
    to_location_id: int
    remarks: Optional[str] = None
    items: List[InventoryTransferItemCreate]

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: List[InventoryTransferItemCreate]) -> List[InventoryTransferItemCreate]:
        if not value:
            raise ValueError("At least one transfer item is required.")
        return value


class InventoryTransferUpdate(BaseModel):
    from_location_id: Optional[int] = None
    to_location_id: Optional[int] = None
    remarks: Optional[str] = None
    items: Optional[List[InventoryTransferItemCreate]] = None


class InventoryTransferItemOut(BaseModel):
    id: int
    product_id: int
    batch_number: Optional[str] = None
    quantity: float
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryTransferOut(BaseModel):
    id: int
    tenant_id: str
    transfer_number: str
    from_location_id: int
    to_location_id: int
    requested_by: Optional[int] = None
    approved_by: Optional[int] = None
    status: str
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[InventoryTransferItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class InventoryTransferPageOut(BaseModel):
    data: List[InventoryTransferOut]
    meta: dict


class StockAdjustmentItemCreate(BaseModel):
    product_id: int
    batch_number: Optional[str] = None
    quantity: float
    unit_cost: Optional[float] = 0.0
    remarks: Optional[str] = None

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_quantity(cls, value: float) -> float:
        return _validate_quantity(value)


class StockAdjustmentCreate(BaseModel):
    reason: str
    remarks: Optional[str] = None
    items: List[StockAdjustmentItemCreate]

    @field_validator("reason", mode="before")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        if value is None:
            raise ValueError("Reason is required.")
        text = value.strip()
        if not text:
            raise ValueError("Reason cannot be empty.")
        return text

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: List[StockAdjustmentItemCreate]) -> List[StockAdjustmentItemCreate]:
        if not value:
            raise ValueError("At least one adjustment item is required.")
        return value


class StockAdjustmentUpdate(BaseModel):
    reason: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[StockAdjustmentItemCreate]] = None


class StockAdjustmentItemOut(BaseModel):
    id: int
    product_id: int
    batch_number: Optional[str] = None
    quantity: float
    unit_cost: Optional[float] = 0.0
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockAdjustmentOut(BaseModel):
    id: int
    tenant_id: str
    adjustment_number: str
    reason: str
    status: str
    remarks: Optional[str] = None
    requested_by: Optional[int] = None
    approved_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    items: List[StockAdjustmentItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class StockAdjustmentPageOut(BaseModel):
    data: List[StockAdjustmentOut]
    meta: dict


class StockReservationCreate(BaseModel):
    patient_id: Optional[int] = None
    department_id: Optional[int] = None
    product_id: int
    batch_number: Optional[str] = None
    quantity: float
    expiry_datetime: Optional[datetime] = None
    remarks: Optional[str] = None

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_quantity(cls, value: float) -> float:
        return _validate_quantity(value)


class StockReservationOut(BaseModel):
    id: int
    tenant_id: str
    patient_id: Optional[int] = None
    department_id: Optional[int] = None
    product_id: int
    batch_number: Optional[str] = None
    quantity: float
    expiry_datetime: Optional[datetime] = None
    status: str
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockReservationPageOut(BaseModel):
    data: List[StockReservationOut]
    meta: dict
