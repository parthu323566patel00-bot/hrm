"""
app/api/v1/endpoints/inventory.py
---------------------------------
Inventory master data, product management, and procurement endpoints.

This module implements inventory features including:
- master data CRUD for categories, units, manufacturers, brands, suppliers, storage locations
- product master CRUD and product search/list
- purchase order creation, tracking, update and cancellation
- goods receipt creation, stock updates, batch tracking, and inventory ledger entries
"""

from datetime import datetime
import uuid
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.auth_utils import has_permission
from app.core.database import get_db
from app.inventory.audit import inventory_audit_service
from app.inventory.extensions_service import InventoryExtensionsService
from app.inventory.repository import InventoryRepository
from app.models.brand import Brand
from app.models.goods_receipt_item import GoodsReceiptItem
from app.models.inventory_batch import InventoryBatch
from app.models.inventory_ledger_entry import InventoryLedgerEntry
from app.models.inventory_stock import InventoryStock
from app.models.manufacturer import Manufacturer
from app.models.product import Product
from app.models.product_category import ProductCategory
from app.models.purchase_order_item import PurchaseOrderItem
from app.models.purchase_order import PurchaseOrder
from app.models.goods_receipt import GoodsReceipt
from app.models.inventory_transfer import InventoryTransfer
from app.models.inventory_transfer_item import InventoryTransferItem
from app.models.stock_adjustment import StockAdjustment
from app.models.stock_adjustment_item import StockAdjustmentItem
from app.models.stock_reservation import StockReservation
from app.models.storage_location import StorageLocation
from app.models.supplier import Supplier
from app.models.department import Department
from app.models.unit_of_measure import UnitOfMeasure
from app.models.user import User
from app.schemas.inventory import (
    BrandCreate,
    BrandOut,
    BrandUpdate,
    InventoryLedgerEntryOut,
    InventoryLedgerPageOut,
    InventoryStockOut,
    InventoryStockPageOut,
    ManufacturerCreate,
    ManufacturerOut,
    ManufacturerUpdate,
    ProductCategoryCreate,
    ProductCategoryOut,
    ProductCategoryUpdate,
    ProductCreate,
    ProductOut,
    ProductPageOut,
    ProductUpdate,
    StockTransactionCreate,
    StorageLocationCreate,
    StorageLocationOut,
    StorageLocationUpdate,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
    UnitOfMeasureCreate,
    UnitOfMeasureOut,
    UnitOfMeasureUpdate,
)
from app.schemas.inventory_procurement import (
    GoodsReceiptCreate,
    GoodsReceiptOut,
    GoodsReceiptPageOut,
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderPageOut,
    PurchaseOrderUpdate,
)
from app.schemas.inventory_extensions import (
    InventoryTransferCreate,
    InventoryTransferOut,
    InventoryTransferPageOut,
    InventoryTransferItemOut,
    InventoryTransferUpdate,
    StockAdjustmentCreate,
    StockAdjustmentOut,
    StockAdjustmentPageOut,
    StockAdjustmentUpdate,
    StockReservationCreate,
    StockReservationOut,
    StockReservationPageOut,
)
from app.schemas.inventory_requisition import (
    PurchaseRequisitionCreate,
    PurchaseRequisitionUpdate,
    PurchaseRequisitionApprove,
    PurchaseRequisitionReject,
    PurchaseRequisitionConvert,
    PurchaseRequisitionOut,
    PurchaseRequisitionItemOut,
    PurchaseRequisitionPageOut,
)
from app.models.purchase_requisition import PurchaseRequisition
from app.models.purchase_requisition_item import PurchaseRequisitionItem
from app.inventory.service import InventoryStockService

router = APIRouter()
repo = InventoryRepository()
stock_service = InventoryStockService()
extensions_service = InventoryExtensionsService()

PAGE_SIZE_DEFAULT = 10
PAGE_SIZE_MAX = 100


def _client_ip(request: Optional[Request]) -> Optional[str]:
    """Extract client IP from request, respecting X-Forwarded-For proxy header."""
    if request is None:
        return None
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


async def _get_master_or_404(
    db: AsyncSession,
    model,
    record_id: int,
    tenant_id: str,
    entity_name: str,
):
    result = await db.execute(
        select(model).filter(
            model.id == record_id,
            model.tenant_id == tenant_id,
        )
    )
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_name} not found.")
    return record


async def _validate_inventory_foreign_keys(
    db: AsyncSession,
    tenant_id: str,
    category_id: int,
    brand_id: int,
    manufacturer_id: int,
    unit_id: int,
    default_supplier_id: int,
    storage_location_id: int,
):
    missing = []
    if not await repo.get_category(db, category_id, tenant_id):
        missing.append("category")
    if not await repo.get_brand(db, brand_id, tenant_id):
        missing.append("brand")
    if not await repo.get_manufacturer(db, manufacturer_id, tenant_id):
        missing.append("manufacturer")
    if not await repo.get_unit(db, unit_id, tenant_id):
        missing.append("unit")
    if not await repo.get_supplier(db, default_supplier_id, tenant_id):
        missing.append("supplier")
    if not await repo.get_storage_location(db, storage_location_id, tenant_id):
        missing.append("storage_location")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid inventory master reference(s): {', '.join(missing)}.",
        )


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
@router.post("/categories", response_model=ProductCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_in: ProductCategoryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductCategoryOut:
    if not await has_permission(db, current_user, "inventory:category:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create inventory categories.")

    existing = await repo.get_category_by_name(db, current_user.tenant_id, category_in.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name already exists.")

    category = ProductCategory(
        tenant_id=current_user.tenant_id,
        name=category_in.name,
        description=category_in.description,
        status=category_in.status,
    )
    db.add(category)
    try:
        await db.commit()
        await db.refresh(category)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="category",
            entity_id=category.id,
            ip_address=_client_ip(request),
            meta={"name": category.name},
        )
        return category
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create category: {str(exc)}")


@router.get("/categories", response_model=List[ProductCategoryOut])
async def list_categories(
    q: Optional[str] = Query(None, description="Search categories by name."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ProductCategoryOut]:
    if not await has_permission(db, current_user, "inventory:category:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory categories.")

    query = select(ProductCategory).filter(ProductCategory.tenant_id == current_user.tenant_id)
    if q:
        expr = f"%{q}%"
        query = query.filter(ProductCategory.name.ilike(expr))
    query = query.order_by(ProductCategory.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/categories/{category_id}", response_model=ProductCategoryOut)
async def get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductCategoryOut:
    if not await has_permission(db, current_user, "inventory:category:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory categories.")

    return await _get_master_or_404(db, ProductCategory, category_id, current_user.tenant_id, "Category")


@router.put("/categories/{category_id}", response_model=ProductCategoryOut)
async def update_category(
    category_id: int,
    category_in: ProductCategoryUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductCategoryOut:
    if not await has_permission(db, current_user, "inventory:category:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update inventory categories.")

    category = await _get_master_or_404(db, ProductCategory, category_id, current_user.tenant_id, "Category")
    update_data = category_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != category.name:
        duplicate = await repo.get_category_by_name(db, current_user.tenant_id, update_data["name"])
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name already exists.")

    for field, value in update_data.items():
        setattr(category, field, value)
    db.add(category)
    try:
        await db.commit()
        await db.refresh(category)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="category",
            entity_id=category.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return category
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update category: {str(exc)}")


# ---------------------------------------------------------------------------
# Units of Measure
# ---------------------------------------------------------------------------
@router.post("/units", response_model=UnitOfMeasureOut, status_code=status.HTTP_201_CREATED)
async def create_unit(
    unit_in: UnitOfMeasureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnitOfMeasureOut:
    if not await has_permission(db, current_user, "inventory:unit:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create units of measure.")

    existing = await repo.get_unit_by_name(db, current_user.tenant_id, unit_in.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unit name already exists.")

    unit = UnitOfMeasure(
        tenant_id=current_user.tenant_id,
        name=unit_in.name,
        description=unit_in.description,
        status=unit_in.status,
    )
    db.add(unit)
    try:
        await db.commit()
        await db.refresh(unit)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="unit",
            entity_id=unit.id,
            ip_address=_client_ip(request),
            meta={"name": unit.name},
        )
        return unit
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create unit: {str(exc)}")


@router.get("/units", response_model=List[UnitOfMeasureOut])
async def list_units(
    q: Optional[str] = Query(None, description="Search units by name."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[UnitOfMeasureOut]:
    if not await has_permission(db, current_user, "inventory:unit:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view units of measure.")

    query = select(UnitOfMeasure).filter(UnitOfMeasure.tenant_id == current_user.tenant_id)
    if q:
        expr = f"%{q}%"
        query = query.filter(UnitOfMeasure.name.ilike(expr))
    query = query.order_by(UnitOfMeasure.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/units/{unit_id}", response_model=UnitOfMeasureOut)
async def get_unit(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnitOfMeasureOut:
    if not await has_permission(db, current_user, "inventory:unit:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view units of measure.")

    return await _get_master_or_404(db, UnitOfMeasure, unit_id, current_user.tenant_id, "Unit")


@router.put("/units/{unit_id}", response_model=UnitOfMeasureOut)
async def update_unit(
    unit_id: int,
    unit_in: UnitOfMeasureUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnitOfMeasureOut:
    if not await has_permission(db, current_user, "inventory:unit:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update units of measure.")

    unit = await _get_master_or_404(db, UnitOfMeasure, unit_id, current_user.tenant_id, "Unit")
    update_data = unit_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != unit.name:
        duplicate = await repo.get_unit_by_name(db, current_user.tenant_id, update_data["name"])
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unit name already exists.")

    for field, value in update_data.items():
        setattr(unit, field, value)
    db.add(unit)
    try:
        await db.commit()
        await db.refresh(unit)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="unit",
            entity_id=unit.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return unit
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update unit: {str(exc)}")


# ---------------------------------------------------------------------------
# Manufacturers
# ---------------------------------------------------------------------------
@router.post("/manufacturers", response_model=ManufacturerOut, status_code=status.HTTP_201_CREATED)
async def create_manufacturer(
    manufacturer_in: ManufacturerCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ManufacturerOut:
    if not await has_permission(db, current_user, "inventory:manufacturer:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create manufacturers.")

    existing = await repo.get_manufacturer_by_name(db, current_user.tenant_id, manufacturer_in.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manufacturer name already exists.")

    manufacturer = Manufacturer(
        tenant_id=current_user.tenant_id,
        name=manufacturer_in.name,
        description=manufacturer_in.description,
        status=manufacturer_in.status,
    )
    db.add(manufacturer)
    try:
        await db.commit()
        await db.refresh(manufacturer)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="manufacturer",
            entity_id=manufacturer.id,
            ip_address=_client_ip(request),
            meta={"name": manufacturer.name},
        )
        return manufacturer
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create manufacturer: {str(exc)}")


@router.get("/manufacturers", response_model=List[ManufacturerOut])
async def list_manufacturers(
    q: Optional[str] = Query(None, description="Search manufacturers by name."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ManufacturerOut]:
    if not await has_permission(db, current_user, "inventory:manufacturer:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view manufacturers.")

    query = select(Manufacturer).filter(Manufacturer.tenant_id == current_user.tenant_id)
    if q:
        expr = f"%{q}%"
        query = query.filter(Manufacturer.name.ilike(expr))
    query = query.order_by(Manufacturer.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/manufacturers/{manufacturer_id}", response_model=ManufacturerOut)
async def get_manufacturer(
    manufacturer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ManufacturerOut:
    if not await has_permission(db, current_user, "inventory:manufacturer:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view manufacturers.")

    return await _get_master_or_404(db, Manufacturer, manufacturer_id, current_user.tenant_id, "Manufacturer")


@router.put("/manufacturers/{manufacturer_id}", response_model=ManufacturerOut)
async def update_manufacturer(
    manufacturer_id: int,
    manufacturer_in: ManufacturerUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ManufacturerOut:
    if not await has_permission(db, current_user, "inventory:manufacturer:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update manufacturers.")

    manufacturer = await _get_master_or_404(db, Manufacturer, manufacturer_id, current_user.tenant_id, "Manufacturer")
    update_data = manufacturer_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != manufacturer.name:
        duplicate = await repo.get_manufacturer_by_name(db, current_user.tenant_id, update_data["name"])
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manufacturer name already exists.")

    for field, value in update_data.items():
        setattr(manufacturer, field, value)
    db.add(manufacturer)
    try:
        await db.commit()
        await db.refresh(manufacturer)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="manufacturer",
            entity_id=manufacturer.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return manufacturer
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update manufacturer: {str(exc)}")


# ---------------------------------------------------------------------------
# Brands
# ---------------------------------------------------------------------------
@router.post("/brands", response_model=BrandOut, status_code=status.HTTP_201_CREATED)
async def create_brand(
    brand_in: BrandCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrandOut:
    if not await has_permission(db, current_user, "inventory:brand:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create brands.")

    if not await repo.get_manufacturer(db, brand_in.manufacturer_id, current_user.tenant_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manufacturer not found.")

    existing = await repo.get_brand_by_name(db, current_user.tenant_id, brand_in.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Brand name already exists.")

    brand = Brand(
        tenant_id=current_user.tenant_id,
        manufacturer_id=brand_in.manufacturer_id,
        name=brand_in.name,
        description=brand_in.description,
        status=brand_in.status,
    )
    db.add(brand)
    try:
        await db.commit()
        await db.refresh(brand)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="brand",
            entity_id=brand.id,
            ip_address=_client_ip(request),
            meta={"name": brand.name},
        )
        return brand
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create brand: {str(exc)}")


@router.get("/brands", response_model=List[BrandOut])
async def list_brands(
    q: Optional[str] = Query(None, description="Search brands by name."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[BrandOut]:
    if not await has_permission(db, current_user, "inventory:brand:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view brands.")

    query = select(Brand).filter(Brand.tenant_id == current_user.tenant_id)
    if q:
        expr = f"%{q}%"
        query = query.filter(Brand.name.ilike(expr))
    query = query.order_by(Brand.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/brands/{brand_id}", response_model=BrandOut)
async def get_brand(
    brand_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrandOut:
    if not await has_permission(db, current_user, "inventory:brand:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view brands.")

    return await _get_master_or_404(db, Brand, brand_id, current_user.tenant_id, "Brand")


@router.put("/brands/{brand_id}", response_model=BrandOut)
async def update_brand(
    brand_id: int,
    brand_in: BrandUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrandOut:
    if not await has_permission(db, current_user, "inventory:brand:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update brands.")

    brand = await _get_master_or_404(db, Brand, brand_id, current_user.tenant_id, "Brand")
    update_data = brand_in.model_dump(exclude_unset=True)
    if "manufacturer_id" in update_data and not await repo.get_manufacturer(db, update_data["manufacturer_id"], current_user.tenant_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manufacturer not found.")
    if "name" in update_data and update_data["name"] != brand.name:
        duplicate = await repo.get_brand_by_name(db, current_user.tenant_id, update_data["name"])
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Brand name already exists.")

    for field, value in update_data.items():
        setattr(brand, field, value)
    db.add(brand)
    try:
        await db.commit()
        await db.refresh(brand)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="brand",
            entity_id=brand.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return brand
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update brand: {str(exc)}")


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------
@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_in: SupplierCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupplierOut:
    if not await has_permission(db, current_user, "inventory:supplier:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create suppliers.")

    existing = await repo.get_supplier_by_name(db, current_user.tenant_id, supplier_in.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier name already exists.")

    supplier = Supplier(
        tenant_id=current_user.tenant_id,
        name=supplier_in.name,
        contact_person=supplier_in.contact_person,
        phone=supplier_in.phone,
        email=supplier_in.email,
        gst_number=supplier_in.gst_number,
        drug_license_number=getattr(supplier_in, "drug_license_number", None),
        company_name=getattr(supplier_in, "company_name", None),
        address=supplier_in.address,
        city=getattr(supplier_in, "city", None),
        state=getattr(supplier_in, "state", None),
        country=getattr(supplier_in, "country", None),
        postal_code=getattr(supplier_in, "postal_code", None),
        status=supplier_in.status,
        remarks=supplier_in.remarks,  # canonical field
    )
    db.add(supplier)
    try:
        await db.commit()
        await db.refresh(supplier)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="supplier",
            entity_id=supplier.id,
            ip_address=_client_ip(request),
            meta={"name": supplier.name},
        )
        return supplier
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create supplier: {str(exc)}")


@router.get("/suppliers", response_model=List[SupplierOut])
async def list_suppliers(
    q: Optional[str] = Query(None, description="Search suppliers by name."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SupplierOut]:
    if not await has_permission(db, current_user, "inventory:supplier:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view suppliers.")

    query = select(Supplier).filter(Supplier.tenant_id == current_user.tenant_id)
    if q:
        expr = f"%{q}%"
        query = query.filter(Supplier.name.ilike(expr))
    query = query.order_by(Supplier.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/suppliers/{supplier_id}", response_model=SupplierOut)
async def get_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupplierOut:
    if not await has_permission(db, current_user, "inventory:supplier:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view suppliers.")

    return await _get_master_or_404(db, Supplier, supplier_id, current_user.tenant_id, "Supplier")


@router.put("/suppliers/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: int,
    supplier_in: SupplierUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupplierOut:
    if not await has_permission(db, current_user, "inventory:supplier:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update suppliers.")

    supplier = await _get_master_or_404(db, Supplier, supplier_id, current_user.tenant_id, "Supplier")
    update_data = supplier_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != supplier.name:
        duplicate = await repo.get_supplier_by_name(db, current_user.tenant_id, update_data["name"])
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier name already exists.")

    for field, value in update_data.items():
        setattr(supplier, field, value)
    db.add(supplier)
    try:
        await db.commit()
        await db.refresh(supplier)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="supplier",
            entity_id=supplier.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return supplier
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update supplier: {str(exc)}")


# ---------------------------------------------------------------------------
# Storage Locations
# ---------------------------------------------------------------------------
@router.post("/locations", response_model=StorageLocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_in: StorageLocationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StorageLocationOut:
    if not await has_permission(db, current_user, "inventory:location:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create storage locations.")

    existing = await repo.get_storage_location_by_name(db, current_user.tenant_id, location_in.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Storage location name already exists.")

    location = StorageLocation(
        tenant_id=current_user.tenant_id,
        name=location_in.name,
        description=location_in.description,
        status=location_in.status,
    )
    db.add(location)
    try:
        await db.commit()
        await db.refresh(location)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="storage_location",
            entity_id=location.id,
            ip_address=_client_ip(request),
            meta={"name": location.name},
        )
        return location
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create storage location: {str(exc)}")


@router.get("/locations", response_model=List[StorageLocationOut])
async def list_locations(
    q: Optional[str] = Query(None, description="Search storage locations by name."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[StorageLocationOut]:
    if not await has_permission(db, current_user, "inventory:location:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view storage locations.")

    query = select(StorageLocation).filter(StorageLocation.tenant_id == current_user.tenant_id)
    if q:
        expr = f"%{q}%"
        query = query.filter(StorageLocation.name.ilike(expr))
    query = query.order_by(StorageLocation.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/locations/{location_id}", response_model=StorageLocationOut)
async def get_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StorageLocationOut:
    if not await has_permission(db, current_user, "inventory:location:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view storage locations.")

    return await _get_master_or_404(db, StorageLocation, location_id, current_user.tenant_id, "Storage location")


@router.put("/locations/{location_id}", response_model=StorageLocationOut)
async def update_location(
    location_id: int,
    location_in: StorageLocationUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StorageLocationOut:
    if not await has_permission(db, current_user, "inventory:location:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update storage locations.")

    location = await _get_master_or_404(db, StorageLocation, location_id, current_user.tenant_id, "Storage location")
    update_data = location_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != location.name:
        duplicate = await repo.get_storage_location_by_name(db, current_user.tenant_id, update_data["name"])
        if duplicate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Storage location name already exists.")

    for field, value in update_data.items():
        setattr(location, field, value)
    db.add(location)
    try:
        await db.commit()
        await db.refresh(location)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="storage_location",
            entity_id=location.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return location
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update storage location: {str(exc)}")


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


async def _enrich_products(db: AsyncSession, products: list) -> list:
    """Batch-load related names for a list of Product ORM objects. Returns the same objects with attrs set."""
    if not products:
        return products

    cat_ids  = list({p.category_id for p in products if p.category_id})
    brand_ids = list({p.brand_id for p in products if p.brand_id})
    mfr_ids  = list({p.manufacturer_id for p in products if p.manufacturer_id})
    unit_ids = list({p.unit_id for p in products if p.unit_id})
    sup_ids  = list({p.default_supplier_id for p in products if p.default_supplier_id})
    loc_ids  = list({p.storage_location_id for p in products if p.storage_location_id})

    async def _fetch(model, ids):
        if not ids:
            return {}
        r = await db.execute(select(model).filter(model.id.in_(ids)))
        return {obj.id: obj.name for obj in r.scalars().all()}

    cat_map  = await _fetch(ProductCategory, cat_ids)
    brand_map = await _fetch(Brand, brand_ids)
    mfr_map  = await _fetch(Manufacturer, mfr_ids)
    unit_map = await _fetch(UnitOfMeasure, unit_ids)
    sup_map  = await _fetch(Supplier, sup_ids)
    loc_map  = await _fetch(StorageLocation, loc_ids)

    for p in products:
        p.category_name           = cat_map.get(p.category_id)
        p.brand_name              = brand_map.get(p.brand_id)
        p.manufacturer_name       = mfr_map.get(p.manufacturer_id)
        p.unit_name               = unit_map.get(p.unit_id)
        p.default_supplier_name   = sup_map.get(p.default_supplier_id)
        p.storage_location_name   = loc_map.get(p.storage_location_id)
    return products


@router.get("/products/search")
async def search_products_for_po(
    q: Optional[str] = Query(None, description="Search by name, generic name, or code."),
    active_only: bool = Query(True, description="Only return active products."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Lightweight product search for Purchase Order dropdowns.
    Returns id, product_code, name, generic_name, unit_name, gst_percent, category_name.
    Only active, non-deleted products by default.
    Requires inventory:product:view or inventory:product:search permission.
    """
    can_search = await has_permission(db, current_user, "inventory:product:search")
    can_view   = await has_permission(db, current_user, "inventory:product:view")
    if not (can_search or can_view):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to search products.",
        )
    filters = [
        Product.tenant_id == current_user.tenant_id,
        Product.is_deleted == False,  # noqa: E712
    ]
    if active_only:
        filters.append(Product.status == "active")
    if q:
        expr = f"%{q}%"
        filters.append(
            or_(
                Product.name.ilike(expr),
                Product.generic_name.ilike(expr),
                Product.product_code.ilike(expr),
            )
        )
    result = await db.execute(
        select(Product).filter(*filters).order_by(Product.name.asc()).limit(100)
    )
    products_found = result.scalars().all()
    await _enrich_products(db, products_found)
    return [
        {
            "id": p.id,
            "product_code": p.product_code,
            "name": p.name,
            "generic_name": p.generic_name,
            "unit_name": p.unit_name,
            "unit_id": p.unit_id,
            "gst_percent": p.gst_percent,
            "category_name": p.category_name,
            "default_supplier_name": p.default_supplier_name,
            "status": p.status,
        }
        for p in products_found
    ]


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    if not await has_permission(db, current_user, "inventory:product:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create products.")

    existing_code = await db.execute(
        select(Product).filter(
            Product.product_code == product_in.product_code,
            Product.tenant_id == current_user.tenant_id,
        )
    )
    if existing_code.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product code already exists.")

    await _validate_inventory_foreign_keys(
        db,
        current_user.tenant_id,
        product_in.category_id,
        product_in.brand_id,
        product_in.manufacturer_id,
        product_in.unit_id,
        product_in.default_supplier_id,
        product_in.storage_location_id,
    )

    product = Product(
        tenant_id=current_user.tenant_id,
        product_code=product_in.product_code,
        name=product_in.name,
        generic_name=product_in.generic_name,
        category_id=product_in.category_id,
        brand_id=product_in.brand_id,
        manufacturer_id=product_in.manufacturer_id,
        unit_id=product_in.unit_id,
        default_supplier_id=product_in.default_supplier_id,
        storage_location_id=product_in.storage_location_id,
        minimum_stock=product_in.minimum_stock,
        maximum_stock=product_in.maximum_stock,
        reorder_level=product_in.reorder_level,
        hsn_code=product_in.hsn_code,
        gst_percent=product_in.gst_percent,
        description=product_in.description,
        status=product_in.status,
        is_deleted=False,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(product)
    try:
        await db.commit()
        await db.refresh(product)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="product",
            entity_id=product.id,
            ip_address=_client_ip(request),
            meta={"product_code": product.product_code, "name": product.name},
        )
        return product
    except IntegrityError as ie:
        await db.rollback()
        # Likely unique constraint violation (product name/code)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product with the same identifier already exists.")
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create product: {str(exc)}")


@router.get("/products", response_model=ProductPageOut)
async def list_products(
    q: Optional[str] = Query(None, description="Search products by name, generic name, or code."),
    category_id: Optional[int] = Query(None),
    brand_id: Optional[int] = Query(None),
    manufacturer_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    storage_location_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("created_at", description="Sort column"),
    sort_order: str = Query("desc", description="Sort order, asc or desc"),
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductPageOut:
    can_search = await has_permission(db, current_user, "inventory:product:search")
    can_view = await has_permission(db, current_user, "inventory:product:view")
    if not (can_search or can_view):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to list products.")

    products, total = await repo.list_products(
        db,
        current_user.tenant_id,
        query=q,
        category_id=category_id,
        brand_id=brand_id,
        manufacturer_id=manufacturer_id,
        supplier_id=supplier_id,
        status=status,
        storage_location_id=storage_location_id,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )

    total_pages = max(1, -(-total // page_size))
    await _enrich_products(db, products)
    return ProductPageOut(
        data=[ProductOut.model_validate(product) for product in products],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
    )


@router.get("/products/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    if not await has_permission(db, current_user, "inventory:product:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view products.")

    product = await repo.get_product(db, product_id, current_user.tenant_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    await _enrich_products(db, [product])
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    product_in: ProductUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProductOut:
    if not await has_permission(db, current_user, "inventory:product:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update products.")

    product = await repo.get_product(db, product_id, current_user.tenant_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    update_data = product_in.model_dump(exclude_unset=True)
    if "product_code" in update_data and update_data["product_code"] != product.product_code:
        duplicate = await db.execute(
            select(Product).filter(
                Product.product_code == update_data["product_code"],
                Product.tenant_id == current_user.tenant_id,
                Product.id != product_id,
            )
        )
        if duplicate.scalars().first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product code already exists.")

    if any(field in update_data for field in [
        "category_id", "brand_id", "manufacturer_id", "unit_id", "default_supplier_id", "storage_location_id"
    ]):
        await _validate_inventory_foreign_keys(
            db,
            current_user.tenant_id,
            update_data.get("category_id", product.category_id),
            update_data.get("brand_id", product.brand_id),
            update_data.get("manufacturer_id", product.manufacturer_id),
            update_data.get("unit_id", product.unit_id),
            update_data.get("default_supplier_id", product.default_supplier_id),
            update_data.get("storage_location_id", product.storage_location_id),
        )

    for field, value in update_data.items():
        setattr(product, field, value)
    product.updated_by = current_user.id
    db.add(product)
    try:
        await db.commit()
        await db.refresh(product)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="product",
            entity_id=product.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return product
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update product: {str(exc)}")


def _generate_reference(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


@router.patch("/products/{product_id}/deactivate", response_model=ProductOut)
async def deactivate_product(
    product_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Deactivate a product. Deactivated products cannot be used in new Purchase Orders."""
    if not await has_permission(db, current_user, "inventory:product:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to deactivate products.")
    product = await repo.get_product(db, product_id, current_user.tenant_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    product.status = "inactive"
    product.updated_by = current_user.id
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await _enrich_products(db, [product])
    return product


@router.patch("/products/{product_id}/activate", response_model=ProductOut)
async def activate_product(
    product_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Re-activate a previously deactivated product."""
    if not await has_permission(db, current_user, "inventory:product:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to activate products.")
    product = await repo.get_product(db, product_id, current_user.tenant_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    product.status = "active"
    product.updated_by = current_user.id
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await _enrich_products(db, [product])
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_200_OK)
async def soft_delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Soft-delete a product. Cannot delete if product has active PO items or existing stock.
    """
    if not await has_permission(db, current_user, "inventory:product:delete"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to delete products.")
    product = await repo.get_product(db, product_id, current_user.tenant_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    # Guard: cannot delete if stock exists
    stock = await repo.get_inventory_stock(db, product_id, current_user.tenant_id)
    if stock and stock.total_quantity > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete product with existing stock. Deactivate it instead.",
        )

    # Guard: cannot delete if used in open POs
    po_item_res = await db.execute(
        select(PurchaseOrderItem)
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .filter(
            PurchaseOrderItem.product_id == product_id,
            PurchaseOrder.tenant_id == current_user.tenant_id,
            PurchaseOrder.status.in_(["pending", "partially_received"]),
        )
    )
    if po_item_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete product referenced in open Purchase Orders.",
        )

    product.is_deleted = True
    product.status = "inactive"
    product.updated_by = current_user.id
    db.add(product)
    await db.commit()
    return {"message": "Product deleted.", "product_id": product_id}


async def _get_product_or_404(db: AsyncSession, product_id: int, tenant_id: str) -> Product:
    product = await repo.get_product(db, product_id, tenant_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    return product


async def _get_purchase_order_or_404(db: AsyncSession, purchase_order_id: int, tenant_id: str) -> PurchaseOrder:
    purchase_order = await repo.get_purchase_order(db, purchase_order_id, tenant_id)
    if not purchase_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found.")
    return purchase_order


def _calculate_item_total(quantity: float, unit_price: float, tax_percent: float, discount_percent: float) -> float:
    subtotal = quantity * unit_price
    tax_amount = subtotal * (tax_percent / 100.0)
    discount_amount = subtotal * (discount_percent / 100.0)
    return round(subtotal + tax_amount - discount_amount, 2)


def _resolve_purchase_order_status(existing_items: List[PurchaseOrderItem]) -> str:
    if not existing_items:
        return "pending"

    total_ordered = sum(item.quantity for item in existing_items)
    total_received = sum(item.received_quantity for item in existing_items)
    if total_received >= total_ordered and total_ordered > 0:
        return "completed"
    if total_received > 0:
        return "partially_received"
    return "pending"


async def _prepare_purchase_order_response(db: AsyncSession, purchase_order: PurchaseOrder) -> PurchaseOrderOut:
    items = await repo.get_purchase_order_items(db=db, purchase_order_id=purchase_order.id)
    supplier = await repo.get_supplier(db=db, supplier_id=purchase_order.supplier_id, tenant_id=purchase_order.tenant_id)
    # Batch load products to avoid N+1 queries
    product_ids = [item.product_id for item in items]
    products = await repo.get_products_by_ids(db=db, product_ids=product_ids, tenant_id=purchase_order.tenant_id)
    product_map = {p.id: p for p in products}
    for item in items:
        product = product_map.get(item.product_id)
        item.product_name = product.name if product else None
        item.product_code = product.product_code if product else None
    purchase_order.supplier_name = supplier.name if supplier else None
    purchase_order.items = items
    return PurchaseOrderOut.model_validate(purchase_order)


async def _prepare_requisition_response(db: AsyncSession, requisition: PurchaseRequisition) -> PurchaseRequisitionOut:
    items = await repo.get_requisition_items(db=db, requisition_id=requisition.id)
    product_ids = [item.product_id for item in items]
    products = await repo.get_products_by_ids(db=db, product_ids=product_ids, tenant_id=requisition.tenant_id)
    product_map = {p.id: p for p in products}
    for item in items:
        product = product_map.get(item.product_id)
        item.product_name = product.name if product else None
        item.product_code = product.product_code if product else None

    requester = await db.get(User, requisition.requested_by)
    approver = await db.get(User, requisition.approved_by) if requisition.approved_by else None
    department = await db.get(Department, requisition.department_id) if requisition.department_id else None
    supplier = await repo.get_supplier(db=db, supplier_id=requisition.supplier_id, tenant_id=requisition.tenant_id) if requisition.supplier_id else None

    requisition.requested_by_name = requester.full_name if requester else None
    requisition.approved_by_name = approver.full_name if approver else None
    requisition.department_name = department.name if department else None
    requisition.supplier_name = supplier.name if supplier else None
    requisition.items = items
    return PurchaseRequisitionOut.model_validate(requisition)


async def _prepare_goods_receipt_response(db: AsyncSession, goods_receipt: GoodsReceipt) -> GoodsReceiptOut:
    receipt_items_query = await repo.get_goods_receipt_items(db=db, goods_receipt_id=goods_receipt.id)
    purchase_order = await repo.get_purchase_order(db=db, purchase_order_id=goods_receipt.purchase_order_id, tenant_id=goods_receipt.tenant_id)
    supplier = await repo.get_supplier(db=db, supplier_id=goods_receipt.supplier_id, tenant_id=goods_receipt.tenant_id)
    # Batch load products for items
    product_ids = [item.product_id for item in receipt_items_query]
    products = await repo.get_products_by_ids(db=db, product_ids=product_ids, tenant_id=goods_receipt.tenant_id)
    product_map = {p.id: p for p in products}
    for item in receipt_items_query:
        product = product_map.get(item.product_id)
        item.product_name = product.name if product else None
        item.product_code = product.product_code if product else None
    goods_receipt.supplier_name = supplier.name if supplier else None
    goods_receipt.purchase_order_number = purchase_order.po_number if purchase_order else None
    goods_receipt.items = receipt_items_query
    return GoodsReceiptOut.model_validate(goods_receipt)


@router.post("/requisitions", response_model=PurchaseRequisitionOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_requisition(
    requisition_in: PurchaseRequisitionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseRequisitionOut:
    if not await has_permission(db, current_user, "inventory:requisition:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create purchase requisitions.")

    if requisition_in.supplier_id is not None:
        supplier = await repo.get_supplier(db, requisition_in.supplier_id, current_user.tenant_id)
        if not supplier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier not found.")

    if requisition_in.department_id is not None:
        department = await db.get(Department, requisition_in.department_id)
        if not department or department.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found.")

    total_estimated_amount = 0.0
    requisition = PurchaseRequisition(
        tenant_id=current_user.tenant_id,
        requisition_number=_generate_reference("REQ"),
        requested_by=current_user.id,
        department_id=requisition_in.department_id,
        status="draft",
        priority=requisition_in.priority,
        remarks=requisition_in.remarks,
        requested_date=requisition_in.requested_date,
        required_date=requisition_in.required_date,
        supplier_id=requisition_in.supplier_id,
        total_estimated_amount=0.0,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(requisition)
    await db.flush()

    for item_in in requisition_in.items:
        product = await _get_product_or_404(db, item_in.product_id, current_user.tenant_id)
        if product.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product '{product.name}' is inactive and cannot be requested.")
        estimated_total = round(item_in.requested_quantity * item_in.estimated_unit_price, 2)
        total_estimated_amount += estimated_total
        requisition_item = PurchaseRequisitionItem(
            requisition_id=requisition.id,
            product_id=item_in.product_id,
            requested_quantity=item_in.requested_quantity,
            estimated_unit_price=item_in.estimated_unit_price,
            estimated_total=estimated_total,
            remarks=item_in.remarks,
        )
        db.add(requisition_item)

    requisition.total_estimated_amount = round(total_estimated_amount, 2)
    try:
        await db.commit()
        await db.refresh(requisition)
        return await _prepare_requisition_response(db, requisition)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create purchase requisition: {str(exc)}")


@router.get("/requisitions", response_model=PurchaseRequisitionPageOut)
async def list_purchase_requisitions(
    q: Optional[str] = Query(None, description="Search requisitions by requisition number or remarks."),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    requested_by: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseRequisitionPageOut:
    if not await has_permission(db, current_user, "inventory:requisition:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view purchase requisitions.")

    skip = (page - 1) * page_size
    requisitions, total = await repo.list_requisitions(
        db,
        current_user.tenant_id,
        query=q,
        status=status,
        priority=priority,
        department_id=department_id,
        requested_by=requested_by,
        from_date=date_from.date().isoformat() if date_from else None,
        to_date=date_to.date().isoformat() if date_to else None,
        skip=skip,
        limit=page_size,
    )
    return PurchaseRequisitionPageOut(
        data=[await _prepare_requisition_response(db, requisition) for requisition in requisitions],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/requisitions/{requisition_id}", response_model=PurchaseRequisitionOut)
async def get_purchase_requisition(
    requisition_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseRequisitionOut:
    if not await has_permission(db, current_user, "inventory:requisition:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view purchase requisitions.")

    requisition = await repo.get_requisition(db, requisition_id, current_user.tenant_id)
    if not requisition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase requisition not found.")
    return await _prepare_requisition_response(db, requisition)


@router.put("/requisitions/{requisition_id}", response_model=PurchaseRequisitionOut)
async def update_purchase_requisition(
    requisition_id: int,
    requisition_in: PurchaseRequisitionUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseRequisitionOut:
    if not await has_permission(db, current_user, "inventory:requisition:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update purchase requisitions.")

    requisition = await repo.get_requisition(db, requisition_id, current_user.tenant_id)
    if not requisition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase requisition not found.")
    if requisition.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft requisitions can be updated.")

    if requisition_in.department_id is not None:
        department = await db.get(Department, requisition_in.department_id)
        if not department or department.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found.")
    if requisition_in.supplier_id is not None:
        supplier = await repo.get_supplier(db, requisition_in.supplier_id, current_user.tenant_id)
        if not supplier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier not found.")

    if requisition_in.priority is not None:
        requisition.priority = requisition_in.priority
    if requisition_in.required_date is not None:
        requisition.required_date = requisition_in.required_date
    if requisition_in.department_id is not None:
        requisition.department_id = requisition_in.department_id
    if requisition_in.supplier_id is not None:
        requisition.supplier_id = requisition_in.supplier_id
    if requisition_in.remarks is not None:
        requisition.remarks = requisition_in.remarks

    if requisition_in.items is not None:
        existing_items = await repo.get_requisition_items(db=db, requisition_id=requisition.id)
        for item in existing_items:
            await db.delete(item)
        total_estimated_amount = 0.0
        for item_in in requisition_in.items:
            product = await _get_product_or_404(db, item_in.product_id, current_user.tenant_id)
            if product.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product '{product.name}' is inactive and cannot be requested.")
            estimated_total = round(item_in.requested_quantity * item_in.estimated_unit_price, 2)
            total_estimated_amount += estimated_total
            new_item = PurchaseRequisitionItem(
                requisition_id=requisition.id,
                product_id=item_in.product_id,
                requested_quantity=item_in.requested_quantity,
                estimated_unit_price=item_in.estimated_unit_price,
                estimated_total=estimated_total,
                remarks=item_in.remarks,
            )
            db.add(new_item)
        requisition.total_estimated_amount = round(total_estimated_amount, 2)
    requisition.updated_by = current_user.id
    db.add(requisition)
    try:
        await db.commit()
        await db.refresh(requisition)
        return await _prepare_requisition_response(db, requisition)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update purchase requisition: {str(exc)}")


@router.patch("/requisitions/{requisition_id}/approve", response_model=PurchaseRequisitionOut)
async def approve_purchase_requisition(
    requisition_id: int,
    approval_in: PurchaseRequisitionApprove,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseRequisitionOut:
    if not await has_permission(db, current_user, "inventory:requisition:approve"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to approve purchase requisitions.")

    requisition = await repo.get_requisition(db, requisition_id, current_user.tenant_id)
    if not requisition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase requisition not found.")
    if requisition.status != "draft" and requisition.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft or pending requisitions can be approved.")

    requisition.status = "approved"
    requisition.approved_by = current_user.id
    requisition.approved_at = datetime.utcnow()
    if approval_in.remarks:
        requisition.remarks = approval_in.remarks
    requisition.updated_by = current_user.id
    db.add(requisition)
    try:
        await db.commit()
        await db.refresh(requisition)
        return await _prepare_requisition_response(db, requisition)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to approve purchase requisition: {str(exc)}")


@router.patch("/requisitions/{requisition_id}/reject", response_model=PurchaseRequisitionOut)
async def reject_purchase_requisition(
    requisition_id: int,
    rejection_in: PurchaseRequisitionReject,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseRequisitionOut:
    if not await has_permission(db, current_user, "inventory:requisition:approve"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to reject purchase requisitions.")

    requisition = await repo.get_requisition(db, requisition_id, current_user.tenant_id)
    if not requisition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase requisition not found.")
    if requisition.status not in {"draft", "pending", "approved"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft, pending, or approved requisitions can be rejected.")

    requisition.status = "rejected"
    requisition.approved_by = current_user.id
    requisition.approved_at = datetime.utcnow()
    requisition.remarks = f"{(requisition.remarks or '').strip()} | Rejected: {rejection_in.remarks}".strip(" |")
    requisition.updated_by = current_user.id
    db.add(requisition)
    try:
        await db.commit()
        await db.refresh(requisition)
        return await _prepare_requisition_response(db, requisition)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to reject purchase requisition: {str(exc)}")


@router.post("/requisitions/{requisition_id}/convert", response_model=PurchaseRequisitionOut)
async def convert_purchase_requisition_to_purchase_order(
    requisition_id: int,
    conversion_in: PurchaseRequisitionConvert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseRequisitionOut:
    if not await has_permission(db, current_user, "inventory:requisition:convert"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to convert requisitions to purchase orders.")

    requisition = await repo.get_requisition(db, requisition_id, current_user.tenant_id)
    if not requisition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase requisition not found.")
    if requisition.status != "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved requisitions can be converted to a purchase order.")
    if requisition.converted_po_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase requisition has already been converted.")

    supplier = await repo.get_supplier(db, conversion_in.supplier_id, current_user.tenant_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier not found.")

    purchase_order = PurchaseOrder(
        tenant_id=current_user.tenant_id,
        supplier_id=conversion_in.supplier_id,
        po_number=_generate_reference("PO"),
        purchase_date=conversion_in.purchase_date or datetime.utcnow(),
        expected_delivery_date=conversion_in.expected_delivery_date,
        status="pending",
        remarks=conversion_in.remarks or requisition.remarks,
        total_amount=0.0,
        requisition_id=requisition.id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(purchase_order)
    await db.flush()

    total_amount = 0.0
    items = await repo.get_requisition_items(db=db, requisition_id=requisition.id)
    for item in items:
        product = await _get_product_or_404(db, item.product_id, current_user.tenant_id)
        if product.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product '{product.name}' is inactive and cannot be ordered.")
        total = _calculate_item_total(item.requested_quantity, item.estimated_unit_price, 0.0, 0.0)
        total_amount += total
        po_item = PurchaseOrderItem(
            purchase_order_id=purchase_order.id,
            product_id=item.product_id,
            quantity=item.requested_quantity,
            received_quantity=0.0,
            expected_unit_price=item.estimated_unit_price,
            tax_percent=0.0,
            discount_percent=0.0,
            total_amount=total,
        )
        db.add(po_item)

    purchase_order.total_amount = round(total_amount, 2)
    requisition.status = "converted"
    requisition.converted_po_id = purchase_order.id
    requisition.updated_by = current_user.id
    db.add(requisition)
    db.add(purchase_order)
    try:
        await db.commit()
        await db.refresh(requisition)
        await db.refresh(purchase_order)
        return await _prepare_requisition_response(db, requisition)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to convert purchase requisition: {str(exc)}")


@router.post("/purchase-orders", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    purchase_order_in: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderOut:
    if not await has_permission(db, current_user, "inventory:purchase_order:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create purchase orders.")

    supplier = await repo.get_supplier(db, purchase_order_in.supplier_id, current_user.tenant_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier not found.")

    total_amount = 0.0
    purchase_order = PurchaseOrder(
        tenant_id=current_user.tenant_id,
        supplier_id=purchase_order_in.supplier_id,
        po_number=_generate_reference("PO"),
        purchase_date=purchase_order_in.purchase_date or datetime.utcnow(),
        expected_delivery_date=purchase_order_in.expected_delivery_date,
        status="pending",
        remarks=purchase_order_in.remarks,
        total_amount=0.0,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(purchase_order)
    await db.flush()

    items = []
    for item_in in purchase_order_in.items:
        product = await _get_product_or_404(db, item_in.product_id, current_user.tenant_id)
        # ── Business rule: inactive products cannot be ordered ────────────
        if product.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{product.name}' (code: {product.product_code}) is inactive and cannot be added to a Purchase Order.",
            )
        if item_in.quantity <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item quantity must be greater than zero.")

        total = _calculate_item_total(item_in.quantity, item_in.expected_unit_price, item_in.tax_percent, item_in.discount_percent)
        total_amount += total
        po_item = PurchaseOrderItem(
            purchase_order_id=purchase_order.id,
            product_id=item_in.product_id,
            quantity=item_in.quantity,
            received_quantity=0.0,
            expected_unit_price=item_in.expected_unit_price,
            tax_percent=item_in.tax_percent,
            discount_percent=item_in.discount_percent,
            total_amount=total,
        )
        db.add(po_item)
        items.append(po_item)

    purchase_order.total_amount = round(total_amount, 2)
    try:
        await db.commit()
        await db.refresh(purchase_order)
        return await _prepare_purchase_order_response(db, purchase_order)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create purchase order: {str(exc)}")


@router.get("/purchase-orders", response_model=PurchaseOrderPageOut)
async def list_purchase_orders(
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search purchase orders by PO number or remarks."),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderPageOut:
    can_view = await has_permission(db, current_user, "inventory:purchase_order:view")
    if not can_view:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view purchase orders.")

    skip = (page - 1) * page_size
    orders, total = await repo.list_purchase_orders(
        db,
        current_user.tenant_id,
        supplier_id=supplier_id,
        status=status,
        query=q,
        skip=skip,
        limit=page_size,
    )

    return PurchaseOrderPageOut(
        data=[await _prepare_purchase_order_response(db, order) for order in orders],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/purchase-orders/{purchase_order_id}", response_model=PurchaseOrderOut)
async def get_purchase_order(
    purchase_order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderOut:
    if not await has_permission(db, current_user, "inventory:purchase_order:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view purchase orders.")

    purchase_order = await _get_purchase_order_or_404(db, purchase_order_id, current_user.tenant_id)
    return await _prepare_purchase_order_response(db, purchase_order)


@router.put("/purchase-orders/{purchase_order_id}", response_model=PurchaseOrderOut)
async def update_purchase_order(
    purchase_order_id: int,
    purchase_order_in: PurchaseOrderUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PurchaseOrderOut:
    is_cancelling = purchase_order_in.status == "cancelled"

    # Cancellation requires its own permission; regular updates require the update permission
    if is_cancelling:
        if not await has_permission(db, current_user, "inventory:purchase_order:cancel"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to cancel purchase orders.",
            )
    else:
        if not await has_permission(db, current_user, "inventory:purchase_order:update"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update purchase orders.",
            )

    purchase_order = await _get_purchase_order_or_404(db, purchase_order_id, current_user.tenant_id)
    if purchase_order.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update a cancelled purchase order.")

    update_data = purchase_order_in.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] == "cancelled":
        purchase_order.status = "cancelled"
    if "expected_delivery_date" in update_data:
        purchase_order.expected_delivery_date = update_data["expected_delivery_date"]
    if "remarks" in update_data:
        purchase_order.remarks = update_data["remarks"]
    purchase_order.updated_by = current_user.id
    db.add(purchase_order)
    try:
        await db.commit()
        await db.refresh(purchase_order)
        return await _prepare_purchase_order_response(db, purchase_order)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update purchase order: {str(exc)}")


async def _get_goods_receipt_or_404(db: AsyncSession, goods_receipt_id: int, tenant_id: str) -> GoodsReceipt:
    goods_receipt = await repo.get_goods_receipt(db, goods_receipt_id, tenant_id)
    if not goods_receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goods receipt not found.")
    return goods_receipt


async def _get_purchase_order_items_map(db: AsyncSession, purchase_order_id: int) -> dict[int, PurchaseOrderItem]:
    items = await repo.get_purchase_order_items(db, purchase_order_id)
    return {item.id: item for item in items}


async def _get_inventory_stock(db: AsyncSession, product_id: int, tenant_id: str) -> Optional[InventoryStock]:
    result = await db.execute(
        select(InventoryStock).filter(
            InventoryStock.product_id == product_id,
            InventoryStock.tenant_id == tenant_id,
        )
    )
    return result.scalars().first()


async def _create_or_update_stock(db: AsyncSession, tenant_id: str, product_id: int, quantity: float) -> InventoryStock:
    stock = await _get_inventory_stock(db, product_id, tenant_id)
    if not stock:
        stock = InventoryStock(
            tenant_id=tenant_id,
            product_id=product_id,
            available_quantity=quantity,
            total_quantity=quantity,
        )
        db.add(stock)
    else:
        stock.available_quantity = max(0.0, stock.available_quantity + quantity)
        stock.total_quantity = max(0.0, stock.total_quantity + quantity)
        db.add(stock)
    await db.flush()
    return stock


async def _create_or_update_batch(
    db: AsyncSession,
    tenant_id: str,
    product_id: int,
    batch_number: str,
    manufacturing_date,
    expiry_date,
    quantity: float,
    unit_cost: float,
) -> InventoryBatch:
    result = await db.execute(
        select(InventoryBatch).filter(
            InventoryBatch.product_id == product_id,
            InventoryBatch.tenant_id == tenant_id,
            InventoryBatch.batch_number == batch_number,
        )
    )
    batch = result.scalars().first()
    if not batch:
        batch = InventoryBatch(
            tenant_id=tenant_id,
            product_id=product_id,
            batch_number=batch_number,
            manufacturing_date=manufacturing_date,
            expiry_date=expiry_date,
            quantity=quantity,
            available_quantity=quantity,
            unit_cost=unit_cost,
        )
        db.add(batch)
    else:
        batch.quantity = max(0.0, batch.quantity + quantity)
        batch.available_quantity = max(0.0, batch.available_quantity + quantity)
        batch.unit_cost = unit_cost
        db.add(batch)
    await db.flush()
    return batch


async def _create_inventory_ledger_entry(
    db: AsyncSession,
    tenant_id: str,
    product_id: int,
    quantity: float,
    before_quantity: float,
    after_quantity: float,
    reference_type: str,
    reference_id: int,
    purchase_order_id: int,
    goods_receipt_id: int,
    user_id: int,
) -> None:
    entry = InventoryLedgerEntry(
        tenant_id=tenant_id,
        product_id=product_id,
        transaction_type="goods_receipt",
        quantity=quantity,
        before_quantity=before_quantity,
        after_quantity=after_quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        purchase_order_id=purchase_order_id,
        goods_receipt_id=goods_receipt_id,
        user_id=user_id,
    )
    db.add(entry)


@router.post("/goods-receipts", response_model=GoodsReceiptOut, status_code=status.HTTP_201_CREATED)
async def create_goods_receipt(
    goods_receipt_in: GoodsReceiptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoodsReceiptOut:
    if not await has_permission(db, current_user, "inventory:goods_receipt:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create goods receipts.")

    purchase_order = await _get_purchase_order_or_404(db, goods_receipt_in.purchase_order_id, current_user.tenant_id)
    if purchase_order.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot receive goods for a cancelled purchase order.")

    po_items_map = await _get_purchase_order_items_map(db, purchase_order.id)
    if not po_items_map:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order has no items to receive.")

    total_amount = 0.0
    item_ids = [item.purchase_order_item_id for item in goods_receipt_in.items]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Goods receipt contains duplicate purchase order items.",
        )

    goods_receipt = GoodsReceipt(
        tenant_id=current_user.tenant_id,
        purchase_order_id=purchase_order.id,
        supplier_id=purchase_order.supplier_id,
        receipt_number=_generate_reference("GR"),
        received_date=goods_receipt_in.received_date or datetime.utcnow(),
        remarks=goods_receipt_in.remarks,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(goods_receipt)
    await db.flush()

    for item_in in goods_receipt_in.items:
        po_item = po_items_map.get(item_in.purchase_order_item_id)
        if not po_item:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Purchase order item {item_in.purchase_order_item_id} not found.")
        if po_item.product_id != item_in.product_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Goods receipt item product does not match purchase order item.")
        remaining_qty = po_item.quantity - po_item.received_quantity
        if item_in.received_quantity > remaining_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Received quantity for item {item_in.purchase_order_item_id} exceeds remaining ordered quantity.",
            )

        product = await _get_product_or_404(db, item_in.product_id, current_user.tenant_id)
        total = _calculate_item_total(item_in.received_quantity, item_in.unit_cost, item_in.tax_percent, item_in.discount_percent)
        total_amount += total

        receipt_item = GoodsReceiptItem(
            goods_receipt_id=goods_receipt.id,
            purchase_order_item_id=po_item.id,
            product_id=item_in.product_id,
            received_quantity=item_in.received_quantity,
            unit_cost=item_in.unit_cost,
            batch_number=item_in.batch_number,
            manufacturing_date=item_in.manufacturing_date,
            expiry_date=item_in.expiry_date,
            tax_percent=item_in.tax_percent,
            discount_percent=item_in.discount_percent,
            total_amount=total,
        )
        db.add(receipt_item)

        before_stock = 0.0
        stock = await _get_inventory_stock(db, product.id, current_user.tenant_id)
        if stock:
            before_stock = stock.available_quantity
        stock = await _create_or_update_stock(db, current_user.tenant_id, product.id, item_in.received_quantity)
        await _create_or_update_batch(
            db,
            current_user.tenant_id,
            product.id,
            item_in.batch_number,
            item_in.manufacturing_date,
            item_in.expiry_date,
            item_in.received_quantity,
            item_in.unit_cost,
        )
        await _create_inventory_ledger_entry(
            db,
            current_user.tenant_id,
            product.id,
            item_in.received_quantity,
            before_stock,
            stock.available_quantity,
            reference_type="goods_receipt",
            reference_id=goods_receipt.id,
            purchase_order_id=purchase_order.id,
            goods_receipt_id=goods_receipt.id,
            user_id=current_user.id,
        )

        po_item.received_quantity = po_item.received_quantity + item_in.received_quantity
        db.add(po_item)

    purchase_order.status = _resolve_purchase_order_status(po_items_map.values())
    purchase_order.updated_by = current_user.id
    db.add(purchase_order)

    try:
        await db.commit()
        await db.refresh(goods_receipt)
        return await _prepare_goods_receipt_response(db, goods_receipt)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create goods receipt: {str(exc)}")


@router.get("/goods-receipts", response_model=GoodsReceiptPageOut)
async def list_goods_receipts(
    supplier_id: Optional[int] = Query(None),
    purchase_order_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="Search goods receipts by receipt number, purchase order number, or remarks."),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoodsReceiptPageOut:
    if not await has_permission(db, current_user, "inventory:goods_receipt:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view goods receipts.")

    skip = (page - 1) * page_size
    receipts, total = await repo.list_goods_receipts(
        db,
        current_user.tenant_id,
        supplier_id=supplier_id,
        purchase_order_id=purchase_order_id,
        query=q,
        skip=skip,
        limit=page_size,
    )
    return GoodsReceiptPageOut(
        data=[await _prepare_goods_receipt_response(db, receipt) for receipt in receipts],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/goods-receipts/{goods_receipt_id}", response_model=GoodsReceiptOut)
async def get_goods_receipt(
    goods_receipt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoodsReceiptOut:
    if not await has_permission(db, current_user, "inventory:goods_receipt:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view goods receipts.")

    goods_receipt = await _get_goods_receipt_or_404(db, goods_receipt_id, current_user.tenant_id)
    return await _prepare_goods_receipt_response(db, goods_receipt)


@router.get("/stock", response_model=InventoryStockPageOut)
async def list_inventory_stock(
    product_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryStockPageOut:
    if not await has_permission(db, current_user, "inventory:stock:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory stock.")

    skip = (page - 1) * page_size
    stock_rows, total = await stock_service.list_stock(
        db,
        current_user.tenant_id,
        product_id=product_id,
        skip=skip,
        limit=page_size,
    )
    return InventoryStockPageOut(
        data=stock_rows,
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/stock/ledger", response_model=InventoryLedgerPageOut)
async def list_inventory_ledger(
    product_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    reference_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search ledger entries by reference or transaction type."),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryLedgerPageOut:
    if not await has_permission(db, current_user, "inventory:ledger:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory ledger entries.")

    skip = (page - 1) * page_size
    entries, total = await stock_service.list_ledger_entries(
        db=db,
        tenant_id=current_user.tenant_id,
        product_id=product_id,
        transaction_type=transaction_type,
        reference_type=reference_type,
        query=q,
        skip=skip,
        limit=page_size,
    )
    return InventoryLedgerPageOut(
        data=entries,
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/stock/{product_id}", response_model=InventoryStockOut)
async def get_inventory_stock(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryStockOut:
    if not await has_permission(db, current_user, "inventory:stock:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory stock.")

    stock = await stock_service.get_stock(db, current_user.tenant_id, product_id)
    if not stock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory stock not found.")
    return stock


@router.post("/stock/transactions", response_model=InventoryLedgerEntryOut, status_code=status.HTTP_201_CREATED)
async def create_stock_transaction(
    transaction_in: StockTransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryLedgerEntryOut:
    if not await has_permission(db, current_user, "inventory:stock:change"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to change inventory stock.")

    entry = await stock_service.change_stock(
        db=db,
        tenant_id=current_user.tenant_id,
        product_id=transaction_in.product_id,
        transaction_type=transaction_in.transaction_type,
        quantity=transaction_in.quantity,
        user_id=current_user.id,
        reference_type=transaction_in.reference_type,
        reference_id=transaction_in.reference_id,
        batch_number=transaction_in.batch_number,
    )
    try:
        await db.commit()
        await db.refresh(entry)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create stock transaction: {str(exc)}")
    return entry


async def _prepare_transfer_response(db: AsyncSession, transfer: InventoryTransfer) -> InventoryTransferOut:
    items = await repo.get_transfer_items(db=db, transfer_id=transfer.id, tenant_id=transfer.tenant_id)
    product_ids = [item.product_id for item in items]
    products = await repo.get_products_by_ids(db=db, product_ids=product_ids, tenant_id=transfer.tenant_id)
    product_map = {product.id: product for product in products}
    for item in items:
        product = product_map.get(item.product_id)
        if product:
            item.product_name = product.name
            item.product_code = product.product_code
    transfer.items = items
    return InventoryTransferOut.model_validate(transfer)


async def _prepare_adjustment_response(db: AsyncSession, adjustment: StockAdjustment) -> StockAdjustmentOut:
    items = await repo.get_adjustment_items(db=db, adjustment_id=adjustment.id, tenant_id=adjustment.tenant_id)
    adjustment.items = items
    return StockAdjustmentOut.model_validate(adjustment)


async def _prepare_reservation_response(db: AsyncSession, reservation: StockReservation) -> StockReservationOut:
    return StockReservationOut.model_validate(reservation)


@router.post("/transfers", response_model=InventoryTransferOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_transfer(
    transfer_in: InventoryTransferCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryTransferOut:
    if not await has_permission(db, current_user, "inventory:transfer:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create inventory transfers.")

    transfer = await extensions_service.create_transfer(db, current_user.tenant_id, current_user.id, transfer_in.model_dump())
    try:
        await db.commit()
        await db.refresh(transfer)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="inventory_transfer",
            entity_id=transfer.id,
            ip_address=_client_ip(request),
            meta={"transfer_number": transfer.transfer_number},
        )
        return await _prepare_transfer_response(db, transfer)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create inventory transfer: {str(exc)}")


@router.get("/transfers", response_model=InventoryTransferPageOut)
async def list_inventory_transfers(
    q: Optional[str] = Query(None, description="Search transfers by transfer number or remarks."),
    status: Optional[str] = Query(None),
    from_location_id: Optional[int] = Query(None),
    to_location_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryTransferPageOut:
    if not await has_permission(db, current_user, "inventory:transfer:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory transfers.")

    skip = (page - 1) * page_size
    transfers, total = await extensions_service.list_transfers(
        db,
        current_user.tenant_id,
        query=q,
        status=status,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        skip=skip,
        limit=page_size,
    )
    return InventoryTransferPageOut(
        data=[await _prepare_transfer_response(db, transfer) for transfer in transfers],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/transfers/{transfer_id}", response_model=InventoryTransferOut)
async def get_inventory_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryTransferOut:
    if not await has_permission(db, current_user, "inventory:transfer:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory transfers.")

    transfer = await extensions_service.get_transfer(db, current_user.tenant_id, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory transfer not found.")
    return await _prepare_transfer_response(db, transfer)


@router.put("/transfers/{transfer_id}", response_model=InventoryTransferOut)
async def update_inventory_transfer(
    transfer_id: int,
    transfer_in: InventoryTransferUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryTransferOut:
    if not await has_permission(db, current_user, "inventory:transfer:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update inventory transfers.")

    transfer = await extensions_service.get_transfer(db, current_user.tenant_id, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory transfer not found.")
    if transfer.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft transfers can be updated.")

    update_data = transfer_in.model_dump(exclude_unset=True)
    if "from_location_id" in update_data:
        transfer.from_location_id = update_data["from_location_id"]
    if "to_location_id" in update_data:
        transfer.to_location_id = update_data["to_location_id"]
    if transfer.from_location_id == transfer.to_location_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer source and destination cannot be the same location.")
    if "remarks" in update_data:
        transfer.remarks = update_data["remarks"]

    if "items" in update_data and update_data["items"] is not None:
        existing_items = await repo.get_transfer_items(db=db, transfer_id=transfer.id, tenant_id=transfer.tenant_id)
        for existing_item in existing_items:
            await db.delete(existing_item)
        for item_payload in update_data["items"]:
            product = await repo.get_product(db, item_payload["product_id"], current_user.tenant_id)
            if not product or product.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or inactive product in transfer item.")
            transfer_item = InventoryTransferItem(
                tenant_id=current_user.tenant_id,
                transfer_id=transfer.id,
                product_id=item_payload["product_id"],
                batch_number=item_payload.get("batch_number"),
                quantity=item_payload["quantity"],
                remarks=item_payload.get("remarks"),
            )
            db.add(transfer_item)

    transfer.updated_at = datetime.utcnow()
    db.add(transfer)
    try:
        await db.commit()
        await db.refresh(transfer)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="inventory_transfer",
            entity_id=transfer.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return await _prepare_transfer_response(db, transfer)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update inventory transfer: {str(exc)}")


@router.patch("/transfers/{transfer_id}/approve", response_model=InventoryTransferOut)
async def approve_inventory_transfer(
    transfer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryTransferOut:
    if not await has_permission(db, current_user, "inventory:transfer:approve"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to approve inventory transfers.")

    transfer = await extensions_service.get_transfer(db, current_user.tenant_id, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory transfer not found.")
    transfer = await extensions_service.approve_transfer(db, current_user.tenant_id, current_user.id, transfer)
    try:
        await db.commit()
        await db.refresh(transfer)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="approved",
            entity="inventory_transfer",
            entity_id=transfer.id,
            ip_address=_client_ip(request),
        )
        return await _prepare_transfer_response(db, transfer)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to approve inventory transfer: {str(exc)}")


@router.patch("/transfers/{transfer_id}/complete", response_model=InventoryTransferOut)
async def complete_inventory_transfer(
    transfer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryTransferOut:
    if not await has_permission(db, current_user, "inventory:transfer:complete"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to complete inventory transfers.")

    transfer = await extensions_service.get_transfer(db, current_user.tenant_id, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory transfer not found.")
    transfer = await extensions_service.complete_transfer(db, current_user.tenant_id, transfer)
    try:
        await db.commit()
        await db.refresh(transfer)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="completed",
            entity="inventory_transfer",
            entity_id=transfer.id,
            ip_address=_client_ip(request),
        )
        return await _prepare_transfer_response(db, transfer)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to complete inventory transfer: {str(exc)}")


@router.patch("/transfers/{transfer_id}/cancel", response_model=InventoryTransferOut)
async def cancel_inventory_transfer(
    transfer_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryTransferOut:
    if not await has_permission(db, current_user, "inventory:transfer:cancel"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to cancel inventory transfers.")

    transfer = await extensions_service.get_transfer(db, current_user.tenant_id, transfer_id)
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory transfer not found.")
    transfer = await extensions_service.cancel_transfer(db, current_user.tenant_id, transfer)
    try:
        await db.commit()
        await db.refresh(transfer)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="cancelled",
            entity="inventory_transfer",
            entity_id=transfer.id,
            ip_address=_client_ip(request),
        )
        return await _prepare_transfer_response(db, transfer)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to cancel inventory transfer: {str(exc)}")


@router.post("/adjustments", response_model=StockAdjustmentOut, status_code=status.HTTP_201_CREATED)
async def create_stock_adjustment(
    adjustment_in: StockAdjustmentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockAdjustmentOut:
    if not await has_permission(db, current_user, "inventory:adjustment:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create stock adjustments.")

    adjustment = await extensions_service.create_adjustment(db, current_user.tenant_id, current_user.id, adjustment_in.model_dump())
    try:
        await db.commit()
        await db.refresh(adjustment)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="stock_adjustment",
            entity_id=adjustment.id,
            ip_address=_client_ip(request),
            meta={"adjustment_number": adjustment.adjustment_number},
        )
        return await _prepare_adjustment_response(db, adjustment)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create stock adjustment: {str(exc)}")


@router.get("/adjustments", response_model=StockAdjustmentPageOut)
async def list_stock_adjustments(
    q: Optional[str] = Query(None, description="Search adjustments by adjustment number or remarks."),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockAdjustmentPageOut:
    if not await has_permission(db, current_user, "inventory:adjustment:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view stock adjustments.")

    skip = (page - 1) * page_size
    adjustments, total = await extensions_service.list_adjustments(
        db,
        current_user.tenant_id,
        query=q,
        status=status,
        skip=skip,
        limit=page_size,
    )
    return StockAdjustmentPageOut(
        data=[await _prepare_adjustment_response(db, adjustment) for adjustment in adjustments],
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/adjustments/{adjustment_id}", response_model=StockAdjustmentOut)
async def get_stock_adjustment(
    adjustment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockAdjustmentOut:
    if not await has_permission(db, current_user, "inventory:adjustment:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view stock adjustments.")

    adjustment = await extensions_service.get_adjustment(db, current_user.tenant_id, adjustment_id)
    if not adjustment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock adjustment not found.")
    return await _prepare_adjustment_response(db, adjustment)


@router.put("/adjustments/{adjustment_id}", response_model=StockAdjustmentOut)
async def update_stock_adjustment(
    adjustment_id: int,
    adjustment_in: StockAdjustmentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockAdjustmentOut:
    if not await has_permission(db, current_user, "inventory:adjustment:update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update stock adjustments.")

    adjustment = await extensions_service.get_adjustment(db, current_user.tenant_id, adjustment_id)
    if not adjustment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock adjustment not found.")
    if adjustment.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft adjustments can be updated.")

    update_data = adjustment_in.model_dump(exclude_unset=True)
    if "reason" in update_data:
        adjustment.reason = update_data["reason"]
    if "remarks" in update_data:
        adjustment.remarks = update_data["remarks"]

    if "items" in update_data and update_data["items"] is not None:
        existing_items = await repo.get_adjustment_items(db=db, adjustment_id=adjustment.id, tenant_id=adjustment.tenant_id)
        for existing_item in existing_items:
            await db.delete(existing_item)
        for item_payload in update_data["items"]:
            product = await repo.get_product(db, item_payload["product_id"], current_user.tenant_id)
            if not product or product.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or inactive product in adjustment item.")
            adjustment_item = StockAdjustmentItem(
                tenant_id=current_user.tenant_id,
                adjustment_id=adjustment.id,
                product_id=item_payload["product_id"],
                batch_number=item_payload.get("batch_number"),
                quantity=item_payload["quantity"],
                unit_cost=item_payload.get("unit_cost", 0.0),
                remarks=item_payload.get("remarks"),
            )
            db.add(adjustment_item)

    adjustment.updated_at = datetime.utcnow()
    db.add(adjustment)
    try:
        await db.commit()
        await db.refresh(adjustment)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="updated",
            entity="stock_adjustment",
            entity_id=adjustment.id,
            ip_address=_client_ip(request),
            meta=update_data,
        )
        return await _prepare_adjustment_response(db, adjustment)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update stock adjustment: {str(exc)}")


@router.patch("/adjustments/{adjustment_id}/approve", response_model=StockAdjustmentOut)
async def approve_stock_adjustment(
    adjustment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockAdjustmentOut:
    if not await has_permission(db, current_user, "inventory:adjustment:approve"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to approve stock adjustments.")

    adjustment = await extensions_service.get_adjustment(db, current_user.tenant_id, adjustment_id)
    if not adjustment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock adjustment not found.")
    adjustment = await extensions_service.approve_adjustment(db, current_user.tenant_id, current_user.id, adjustment)
    try:
        await db.commit()
        await db.refresh(adjustment)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="approved",
            entity="stock_adjustment",
            entity_id=adjustment.id,
            ip_address=_client_ip(request),
        )
        return await _prepare_adjustment_response(db, adjustment)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to approve stock adjustment: {str(exc)}")


@router.patch("/adjustments/{adjustment_id}/cancel", response_model=StockAdjustmentOut)
async def cancel_stock_adjustment(
    adjustment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockAdjustmentOut:
    if not await has_permission(db, current_user, "inventory:adjustment:cancel"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to cancel stock adjustments.")

    adjustment = await extensions_service.get_adjustment(db, current_user.tenant_id, adjustment_id)
    if not adjustment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock adjustment not found.")
    adjustment = await extensions_service.cancel_adjustment(db, current_user.tenant_id, adjustment)
    try:
        await db.commit()
        await db.refresh(adjustment)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="cancelled",
            entity="stock_adjustment",
            entity_id=adjustment.id,
            ip_address=_client_ip(request),
        )
        return await _prepare_adjustment_response(db, adjustment)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to cancel stock adjustment: {str(exc)}")


@router.post("/reservations", response_model=StockReservationOut, status_code=status.HTTP_201_CREATED)
async def create_stock_reservation(
    reservation_in: StockReservationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockReservationOut:
    if not await has_permission(db, current_user, "inventory:reservation:create"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to create stock reservations.")

    reservation = await extensions_service.create_reservation(db, current_user.tenant_id, reservation_in.model_dump())
    try:
        await db.commit()
        await db.refresh(reservation)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="created",
            entity="stock_reservation",
            entity_id=reservation.id,
            ip_address=_client_ip(request),
            meta={"product_id": reservation.product_id, "quantity": reservation.quantity},
        )
        return await _prepare_reservation_response(db, reservation)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create stock reservation: {str(exc)}")


@router.get("/reservations", response_model=StockReservationPageOut)
async def list_stock_reservations(
    q: Optional[str] = Query(None, description="Search reservations by batch number or remarks."),
    status: Optional[str] = Query(None),
    product_id: Optional[int] = Query(None),
    patient_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockReservationPageOut:
    if not await has_permission(db, current_user, "inventory:reservation:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view stock reservations.")

    skip = (page - 1) * page_size
    reservations, total = await extensions_service.list_reservations(
        db,
        current_user.tenant_id,
        query=q,
        status=status,
        product_id=product_id,
        patient_id=patient_id,
        department_id=department_id,
        skip=skip,
        limit=page_size,
    )
    return StockReservationPageOut(
        data=reservations,
        meta={
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, -(-total // page_size)),
        },
    )


@router.get("/reservations/{reservation_id}", response_model=StockReservationOut)
async def get_stock_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockReservationOut:
    if not await has_permission(db, current_user, "inventory:reservation:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view stock reservations.")

    reservation = await extensions_service.get_reservation(db, current_user.tenant_id, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock reservation not found.")
    return await _prepare_reservation_response(db, reservation)


@router.patch("/reservations/{reservation_id}/release", response_model=StockReservationOut)
async def release_stock_reservation(
    reservation_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockReservationOut:
    if not await has_permission(db, current_user, "inventory:reservation:change"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to release stock reservations.")

    reservation = await extensions_service.get_reservation(db, current_user.tenant_id, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock reservation not found.")
    reservation = await extensions_service.release_reservation(db, current_user.tenant_id, reservation)
    try:
        await db.commit()
        await db.refresh(reservation)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="released",
            entity="stock_reservation",
            entity_id=reservation.id,
            ip_address=_client_ip(request),
        )
        return await _prepare_reservation_response(db, reservation)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to release stock reservation: {str(exc)}")


@router.patch("/reservations/{reservation_id}/consume", response_model=StockReservationOut)
async def consume_stock_reservation(
    reservation_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StockReservationOut:
    if not await has_permission(db, current_user, "inventory:reservation:change"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to consume stock reservations.")

    reservation = await extensions_service.get_reservation(db, current_user.tenant_id, reservation_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock reservation not found.")
    reservation = await extensions_service.consume_reservation(db, current_user.tenant_id, reservation)
    try:
        await db.commit()
        await db.refresh(reservation)
        await inventory_audit_service.log(
            db,
            tenant_id=current_user.tenant_id,
            actor_id=current_user.id,
            action="consumed",
            entity="stock_reservation",
            entity_id=reservation.id,
            ip_address=_client_ip(request),
        )
        return await _prepare_reservation_response(db, reservation)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to consume stock reservation: {str(exc)}")


@router.get("/dashboard")
async def get_inventory_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not await has_permission(db, current_user, "inventory:dashboard:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory dashboard metrics.")
    return await extensions_service.list_dashboard(db, current_user.tenant_id)


@router.get("/alerts")
async def list_inventory_alerts(
    reason: Optional[str] = Query(None, description="Optional alert reason filter."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[dict]:
    if not await has_permission(db, current_user, "inventory:alerts:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory alerts.")
    return await extensions_service.list_alerts(db, current_user.tenant_id, reason=reason)


@router.get("/reports")
async def get_inventory_reports(
    report_type: str = Query(..., description="Report type to generate."),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not await has_permission(db, current_user, "inventory:reports:view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view inventory reports.")
    return await extensions_service.list_reports(db, current_user.tenant_id, report_type, page=page, limit=page_size)
