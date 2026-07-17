from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator


def _strip_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def _validate_required_text(value: str) -> str:
    if value is None:
        raise ValueError("Value is required.")
    value = value.strip()
    if not value:
        raise ValueError("Value cannot be empty or whitespace.")
    return value


class ProductCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class ProductCategoryCreate(ProductCategoryBase):
    pass


class ProductCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class ProductCategoryOut(ProductCategoryBase):
    id: int
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnitOfMeasureBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class UnitOfMeasureCreate(UnitOfMeasureBase):
    pass


class UnitOfMeasureUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class UnitOfMeasureOut(UnitOfMeasureBase):
    id: int
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ManufacturerBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class ManufacturerCreate(ManufacturerBase):
    pass


class ManufacturerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class ManufacturerOut(ManufacturerBase):
    id: int
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BrandBase(BaseModel):
    name: str
    manufacturer_id: int
    description: Optional[str] = None
    status: Optional[str] = "active"

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class BrandCreate(BrandBase):
    pass


class BrandUpdate(BaseModel):
    name: Optional[str] = None
    manufacturer_id: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class BrandOut(BrandBase):
    id: int
    tenant_id: str
    manufacturer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplierBase(BaseModel):
    name: str
    company_name: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license_number: Optional[str] = None
    email: Optional[str] = None
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    contact_person: Optional[str] = None
    status: Optional[str] = "active"
    remarks: Optional[str] = None

    @field_validator("name", "phone", mode="before")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        return _validate_required_text(value)

    @field_validator(
        "company_name", "gst_number", "drug_license_number", "email",
        "address", "city", "state", "country", "postal_code",
        "contact_person", "remarks",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    """Update schema for Supplier. Uses `remarks` as the canonical notes field."""
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    drug_license_number: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None  # canonical field — `notes` column migrated to this

    @field_validator("name", "phone", mode="before")
    @classmethod
    def validate_required_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_required_text(value)

    @field_validator(
        "contact_person", "email", "gst_number", "drug_license_number",
        "company_name", "address", "city", "state", "country", "postal_code", "remarks",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class SupplierOut(SupplierBase):
    id: int
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StorageLocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class StorageLocationCreate(StorageLocationBase):
    pass


class StorageLocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_required_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class StorageLocationOut(StorageLocationBase):
    id: int
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    product_code: str
    name: str
    generic_name: Optional[str] = None
    category_id: int
    brand_id: int
    manufacturer_id: int
    unit_id: int
    default_supplier_id: int
    storage_location_id: int
    minimum_stock: float = 0.0
    maximum_stock: float = 0.0
    reorder_level: float = 0.0
    hsn_code: Optional[str] = None
    gst_percent: float = 0.0
    description: Optional[str] = None
    status: Optional[str] = "active"

    @field_validator(
        "name",
        mode="before",
    )
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_required_text(value)

    @field_validator("generic_name", "hsn_code", "description", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    category_id: Optional[int] = None
    brand_id: Optional[int] = None
    manufacturer_id: Optional[int] = None
    unit_id: Optional[int] = None
    default_supplier_id: Optional[int] = None
    storage_location_id: Optional[int] = None
    minimum_stock: Optional[float] = None
    maximum_stock: Optional[float] = None
    reorder_level: Optional[float] = None
    hsn_code: Optional[str] = None
    gst_percent: Optional[float] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_required_text(value)

    @field_validator("generic_name", "hsn_code", "description", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return _strip_text(value)


class ProductOut(ProductBase):
    id: int
    tenant_id: str
    product_code: str
    is_deleted: bool
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    category_name: Optional[str] = None
    brand_name: Optional[str] = None
    manufacturer_name: Optional[str] = None
    unit_name: Optional[str] = None
    default_supplier_name: Optional[str] = None
    storage_location_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class ProductPageOut(BaseModel):
    data: List[ProductOut]
    meta: PageMeta


class StockTransactionCreate(BaseModel):
    product_id: int
    transaction_type: str
    quantity: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    batch_number: Optional[str] = None

    @field_validator("quantity", mode="before")
    @classmethod
    def validate_quantity(cls, value: float) -> float:
        if value is None or value <= 0:
            raise ValueError("Quantity must be greater than zero.")
        return value

    @field_validator("transaction_type")
    @classmethod
    def validate_transaction_type(cls, value: str) -> str:
        allowed = {"issue", "consume", "reserve", "release"}
        if value not in allowed:
            raise ValueError(f"Transaction type must be one of: {', '.join(sorted(allowed))}.")
        return value


class InventoryStockOut(BaseModel):
    id: int
    tenant_id: str
    product_id: int
    available_quantity: float
    total_quantity: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryStockPageOut(BaseModel):
    data: List[InventoryStockOut]
    meta: PageMeta


class InventoryLedgerEntryOut(BaseModel):
    id: int
    tenant_id: str
    product_id: int
    transaction_type: str
    quantity: float
    before_quantity: float
    after_quantity: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    goods_receipt_id: Optional[int] = None
    user_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryLedgerPageOut(BaseModel):
    data: List[InventoryLedgerEntryOut]
    meta: PageMeta
