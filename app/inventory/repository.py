from typing import Any, Dict, List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.product_category import ProductCategory
from app.models.brand import Brand
from app.models.manufacturer import Manufacturer
from app.models.unit_of_measure import UnitOfMeasure
from app.models.supplier import Supplier
from app.models.storage_location import StorageLocation
from app.models.purchase_order import PurchaseOrder
from app.models.purchase_order_item import PurchaseOrderItem
from app.models.goods_receipt import GoodsReceipt
from app.models.goods_receipt_item import GoodsReceiptItem
from app.models.inventory_stock import InventoryStock
from app.models.inventory_batch import InventoryBatch
from app.models.inventory_ledger_entry import InventoryLedgerEntry
from app.models.inventory_transfer import InventoryTransfer
from app.models.inventory_transfer_item import InventoryTransferItem
from app.models.stock_adjustment import StockAdjustment
from app.models.stock_adjustment_item import StockAdjustmentItem
from app.models.stock_reservation import StockReservation


class InventoryRepository:

    async def get_product(self, db: AsyncSession, product_id: int, tenant_id: str) -> Optional[Product]:
        result = await db.execute(
            select(Product).filter(
                Product.id == product_id,
                Product.tenant_id == tenant_id,
                Product.is_deleted == False,  # noqa: E712
            )
        )
        return result.scalars().first()

    async def get_category(self, db: AsyncSession, category_id: int, tenant_id: str) -> Optional[ProductCategory]:
        result = await db.execute(
            select(ProductCategory).filter(
                ProductCategory.id == category_id,
                ProductCategory.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_brand(self, db: AsyncSession, brand_id: int, tenant_id: str) -> Optional[Brand]:
        result = await db.execute(
            select(Brand).filter(
                Brand.id == brand_id,
                Brand.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_manufacturer(self, db: AsyncSession, manufacturer_id: int, tenant_id: str) -> Optional[Manufacturer]:
        result = await db.execute(
            select(Manufacturer).filter(
                Manufacturer.id == manufacturer_id,
                Manufacturer.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_unit(self, db: AsyncSession, unit_id: int, tenant_id: str) -> Optional[UnitOfMeasure]:
        result = await db.execute(
            select(UnitOfMeasure).filter(
                UnitOfMeasure.id == unit_id,
                UnitOfMeasure.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_supplier(self, db: AsyncSession, supplier_id: int, tenant_id: str) -> Optional[Supplier]:
        result = await db.execute(
            select(Supplier).filter(
                Supplier.id == supplier_id,
                Supplier.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_storage_location(self, db: AsyncSession, storage_location_id: int, tenant_id: str) -> Optional[StorageLocation]:
        result = await db.execute(
            select(StorageLocation).filter(
                StorageLocation.id == storage_location_id,
                StorageLocation.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_category_by_name(self, db: AsyncSession, tenant_id: str, name: str):
        result = await db.execute(
            select(ProductCategory).filter(
                ProductCategory.tenant_id == tenant_id,
                ProductCategory.name == name,
            )
        )
        return result.scalars().first()

    async def get_brand_by_name(self, db: AsyncSession, tenant_id: str, name: str):
        result = await db.execute(
            select(Brand).filter(
                Brand.tenant_id == tenant_id,
                Brand.name == name,
            )
        )
        return result.scalars().first()

    async def get_manufacturer_by_name(self, db: AsyncSession, tenant_id: str, name: str):
        result = await db.execute(
            select(Manufacturer).filter(
                Manufacturer.tenant_id == tenant_id,
                Manufacturer.name == name,
            )
        )
        return result.scalars().first()

    async def get_unit_by_name(self, db: AsyncSession, tenant_id: str, name: str):
        result = await db.execute(
            select(UnitOfMeasure).filter(
                UnitOfMeasure.tenant_id == tenant_id,
                UnitOfMeasure.name == name,
            )
        )
        return result.scalars().first()

    async def get_supplier_by_name(self, db: AsyncSession, tenant_id: str, name: str):
        result = await db.execute(
            select(Supplier).filter(
                Supplier.tenant_id == tenant_id,
                Supplier.name == name,
            )
        )
        return result.scalars().first()

    async def get_storage_location_by_name(self, db: AsyncSession, tenant_id: str, name: str):
        result = await db.execute(
            select(StorageLocation).filter(
                StorageLocation.tenant_id == tenant_id,
                StorageLocation.name == name,
            )
        )
        return result.scalars().first()

    async def list_products(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        query: Optional[str] = None,
        category_id: Optional[int] = None,
        brand_id: Optional[int] = None,
        manufacturer_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None,
        storage_location_id: Optional[int] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 25,
    ):
        filters = [
            Product.tenant_id == tenant_id,
            Product.is_deleted == False,  # noqa: E712
        ]
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    Product.name.ilike(expr),
                    Product.generic_name.ilike(expr),
                    Product.product_code.ilike(expr),
                )
            )
        if category_id is not None:
            filters.append(Product.category_id == category_id)
        if brand_id is not None:
            filters.append(Product.brand_id == brand_id)
        if manufacturer_id is not None:
            filters.append(Product.manufacturer_id == manufacturer_id)
        if supplier_id is not None:
            filters.append(Product.default_supplier_id == supplier_id)
        if status is not None:
            filters.append(Product.status == status)
        if storage_location_id is not None:
            filters.append(Product.storage_location_id == storage_location_id)

        valid_sort_columns = {
            "created_at": Product.created_at,
            "name": Product.name,
            "product_code": Product.product_code,
            "status": Product.status,
        }
        sort_column = valid_sort_columns.get(sort_by, Product.created_at)
        if sort_order.lower() == "asc":
            order_clause = sort_column.asc()
        else:
            order_clause = sort_column.desc()

        count_query = select(func.count(Product.id)).filter(*filters)
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        skip = (page - 1) * page_size
        result = await db.execute(
            select(Product)
            .filter(*filters)
            .order_by(order_clause)
            .offset(skip)
            .limit(page_size)
        )
        return result.scalars().all(), total

    async def get_purchase_order(self, db: AsyncSession, purchase_order_id: int, tenant_id: str) -> Optional[PurchaseOrder]:
        result = await db.execute(
            select(PurchaseOrder).filter(
                PurchaseOrder.id == purchase_order_id,
                PurchaseOrder.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_purchase_order_item(self, db: AsyncSession, item_id: int, tenant_id: str) -> Optional[PurchaseOrderItem]:
        result = await db.execute(
            select(PurchaseOrderItem)
            .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
            .filter(
                PurchaseOrderItem.id == item_id,
                PurchaseOrder.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def get_purchase_order_items(self, db: AsyncSession, purchase_order_id: int) -> List[PurchaseOrderItem]:
        result = await db.execute(
            select(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == purchase_order_id)
        )
        return result.scalars().all()

    async def get_products_by_ids(self, db: AsyncSession, product_ids: list[int], tenant_id: str) -> List[Product]:
        if not product_ids:
            return []
        result = await db.execute(
            select(Product).filter(
                Product.id.in_(product_ids),
                Product.tenant_id == tenant_id,
                Product.is_deleted == False,  # noqa: E712
            )
        )
        return result.scalars().all()

    async def get_product_by_name_and_category(
        self,
        db: AsyncSession,
        tenant_id: str,
        name: str,
        category_id: int,
        exclude_id: Optional[int] = None,
    ) -> Optional[Product]:
        query = select(Product).filter(
            Product.tenant_id == tenant_id,
            Product.category_id == category_id,
            Product.name == name,
        )
        if exclude_id is not None:
            query = query.filter(Product.id != exclude_id)
        result = await db.execute(query)
        return result.scalars().first()

    async def get_inventory_stock(
        self,
        db: AsyncSession,
        product_id: int,
        tenant_id: str,
        for_update: bool = False,
    ) -> Optional[InventoryStock]:
        query = select(InventoryStock).filter(
            InventoryStock.product_id == product_id,
            InventoryStock.tenant_id == tenant_id,
        )
        if for_update:
            query = query.with_for_update()
        result = await db.execute(query)
        return result.scalars().first()

    async def get_inventory_batch(
        self,
        db: AsyncSession,
        tenant_id: str,
        product_id: int,
        batch_number: str,
        for_update: bool = False,
    ) -> Optional[InventoryBatch]:
        query = select(InventoryBatch).filter(
            InventoryBatch.tenant_id == tenant_id,
            InventoryBatch.product_id == product_id,
            InventoryBatch.batch_number == batch_number,
        )
        if for_update:
            query = query.with_for_update()
        result = await db.execute(query)
        return result.scalars().first()

    async def list_inventory_batches(self, db: AsyncSession, tenant_id: str, product_id: int) -> List[InventoryBatch]:
        result = await db.execute(
            select(InventoryBatch)
            .filter(
                InventoryBatch.tenant_id == tenant_id,
                InventoryBatch.product_id == product_id,
            )
            .order_by(InventoryBatch.expiry_date.asc(), InventoryBatch.created_at.asc())
        )
        return result.scalars().all()

    async def list_inventory_stock(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        product_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        filters = [InventoryStock.tenant_id == tenant_id]
        if product_id is not None:
            filters.append(InventoryStock.product_id == product_id)

        count_result = await db.execute(select(func.count(InventoryStock.id)).filter(*filters))
        total = count_result.scalar() or 0

        result = await db.execute(
            select(InventoryStock)
            .filter(*filters)
            .order_by(InventoryStock.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def list_inventory_ledger_entries(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        product_id: Optional[int] = None,
        transaction_type: Optional[str] = None,
        reference_type: Optional[str] = None,
        query: Optional[str] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        filters = [InventoryLedgerEntry.tenant_id == tenant_id]
        if product_id is not None:
            filters.append(InventoryLedgerEntry.product_id == product_id)
        if transaction_type is not None:
            filters.append(InventoryLedgerEntry.transaction_type == transaction_type)
        if reference_type is not None:
            filters.append(InventoryLedgerEntry.reference_type == reference_type)
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    InventoryLedgerEntry.reference_type.ilike(expr),
                    InventoryLedgerEntry.transaction_type.ilike(expr),
                )
            )

        count_result = await db.execute(select(func.count(InventoryLedgerEntry.id)).filter(*filters))
        total = count_result.scalar() or 0

        result = await db.execute(
            select(InventoryLedgerEntry)
            .filter(*filters)
            .order_by(InventoryLedgerEntry.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def get_transfer(
        self,
        db: AsyncSession,
        transfer_id: int,
        tenant_id: str,
    ):
        result = await db.execute(
            select(InventoryTransfer).filter(
                InventoryTransfer.id == transfer_id,
                InventoryTransfer.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def list_transfer_items(
        self,
        db: AsyncSession,
        transfer_id: int,
        tenant_id: str,
    ) -> List[InventoryTransferItem]:
        result = await db.execute(
            select(InventoryTransferItem).filter(
                InventoryTransferItem.transfer_id == transfer_id,
                InventoryTransferItem.tenant_id == tenant_id,
            )
        )
        return result.scalars().all()

    async def get_transfer_items(
        self,
        db: AsyncSession,
        transfer_id: int,
        tenant_id: str,
    ) -> List[InventoryTransferItem]:
        result = await db.execute(
            select(InventoryTransferItem).filter(
                InventoryTransferItem.transfer_id == transfer_id,
                InventoryTransferItem.tenant_id == tenant_id,
            )
        )
        return result.scalars().all()

    async def list_transfers(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        query: Optional[str] = None,
        status: Optional[str] = None,
        from_location_id: Optional[int] = None,
        to_location_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        filters = [InventoryTransfer.tenant_id == tenant_id]
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    InventoryTransfer.transfer_number.ilike(expr),
                    InventoryTransfer.remarks.ilike(expr),
                )
            )
        if status is not None:
            filters.append(InventoryTransfer.status == status)
        if from_location_id is not None:
            filters.append(InventoryTransfer.from_location_id == from_location_id)
        if to_location_id is not None:
            filters.append(InventoryTransfer.to_location_id == to_location_id)

        count_result = await db.execute(select(func.count(InventoryTransfer.id)).filter(*filters))
        total = count_result.scalar() or 0

        result = await db.execute(
            select(InventoryTransfer)
            .filter(*filters)
            .order_by(InventoryTransfer.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def get_adjustment(
        self,
        db: AsyncSession,
        adjustment_id: int,
        tenant_id: str,
    ):
        result = await db.execute(
            select(StockAdjustment).filter(
                StockAdjustment.id == adjustment_id,
                StockAdjustment.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def list_adjustment_items(
        self,
        db: AsyncSession,
        adjustment_id: int,
        tenant_id: str,
    ) -> List[StockAdjustmentItem]:
        result = await db.execute(
            select(StockAdjustmentItem).filter(
                StockAdjustmentItem.adjustment_id == adjustment_id,
                StockAdjustmentItem.tenant_id == tenant_id,
            )
        )
        return result.scalars().all()

    async def get_adjustment_items(
        self,
        db: AsyncSession,
        adjustment_id: int,
        tenant_id: str,
    ) -> List[StockAdjustmentItem]:
        result = await db.execute(
            select(StockAdjustmentItem).filter(
                StockAdjustmentItem.adjustment_id == adjustment_id,
                StockAdjustmentItem.tenant_id == tenant_id,
            )
        )
        return result.scalars().all()

    async def list_adjustments(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        query: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        filters = [StockAdjustment.tenant_id == tenant_id]
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    StockAdjustment.adjustment_number.ilike(expr),
                    StockAdjustment.remarks.ilike(expr),
                )
            )
        if status is not None:
            filters.append(StockAdjustment.status == status)

        count_result = await db.execute(select(func.count(StockAdjustment.id)).filter(*filters))
        total = count_result.scalar() or 0

        result = await db.execute(
            select(StockAdjustment)
            .filter(*filters)
            .order_by(StockAdjustment.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def get_reservation(
        self,
        db: AsyncSession,
        reservation_id: int,
        tenant_id: str,
    ):
        result = await db.execute(
            select(StockReservation).filter(
                StockReservation.id == reservation_id,
                StockReservation.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def list_reservations(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        query: Optional[str] = None,
        status: Optional[str] = None,
        product_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        department_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        filters = [StockReservation.tenant_id == tenant_id]
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    StockReservation.batch_number.ilike(expr),
                    StockReservation.remarks.ilike(expr),
                )
            )
        if status is not None:
            filters.append(StockReservation.status == status)
        if product_id is not None:
            filters.append(StockReservation.product_id == product_id)
        if patient_id is not None:
            filters.append(StockReservation.patient_id == patient_id)
        if department_id is not None:
            filters.append(StockReservation.department_id == department_id)

        count_result = await db.execute(select(func.count(StockReservation.id)).filter(*filters))
        total = count_result.scalar() or 0

        result = await db.execute(
            select(StockReservation)
            .filter(*filters)
            .order_by(StockReservation.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all(), total

    async def list_purchase_orders(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        supplier_id: Optional[int] = None,
        status: Optional[str] = None,
        query: Optional[str] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        filters = [PurchaseOrder.tenant_id == tenant_id]
        if supplier_id is not None:
            filters.append(PurchaseOrder.supplier_id == supplier_id)
        if status is not None:
            filters.append(PurchaseOrder.status == status)
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    PurchaseOrder.po_number.ilike(expr),
                    PurchaseOrder.remarks.ilike(expr),
                )
            )

        count_query = select(func.count(PurchaseOrder.id)).filter(*filters)
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        order_query = (
            select(PurchaseOrder)
            .filter(*filters)
            .order_by(PurchaseOrder.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(order_query)
        return result.scalars().all(), total

    async def get_goods_receipt(self, db: AsyncSession, goods_receipt_id: int, tenant_id: str) -> Optional[GoodsReceipt]:
        result = await db.execute(
            select(GoodsReceipt).filter(
                GoodsReceipt.id == goods_receipt_id,
                GoodsReceipt.tenant_id == tenant_id,
            )
        )
        return result.scalars().first()

    async def list_goods_receipts(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        supplier_id: Optional[int] = None,
        purchase_order_id: Optional[int] = None,
        query: Optional[str] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        filters = [GoodsReceipt.tenant_id == tenant_id]
        if supplier_id is not None:
            filters.append(GoodsReceipt.supplier_id == supplier_id)
        if purchase_order_id is not None:
            filters.append(GoodsReceipt.purchase_order_id == purchase_order_id)
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    GoodsReceipt.receipt_number.ilike(expr),
                    GoodsReceipt.remarks.ilike(expr),
                    PurchaseOrder.po_number.ilike(expr),
                )
            )

        base_query = select(GoodsReceipt).select_from(GoodsReceipt).join(
            PurchaseOrder,
            GoodsReceipt.purchase_order_id == PurchaseOrder.id,
            isouter=True,
        )

        count_query = (
            select(func.count(GoodsReceipt.id))
            .select_from(GoodsReceipt)
            .join(PurchaseOrder, GoodsReceipt.purchase_order_id == PurchaseOrder.id, isouter=True)
            .filter(*filters)
        )
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        receipt_query = (
            base_query
            .filter(*filters)
            .order_by(GoodsReceipt.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(receipt_query)
        return result.scalars().all(), total

    async def get_goods_receipt_items(self, db: AsyncSession, goods_receipt_id: int) -> List[GoodsReceiptItem]:
        result = await db.execute(
            select(GoodsReceiptItem).filter(GoodsReceiptItem.goods_receipt_id == goods_receipt_id)
        )
        return result.scalars().all()

    # ── Purchase Requisition ─────────────────────────────────────────────────

    async def get_requisition(
        self,
        db: AsyncSession,
        requisition_id: int,
        tenant_id: str,
    ) -> Optional["PurchaseRequisition"]:
        from app.models.purchase_requisition import PurchaseRequisition
        result = await db.execute(
            select(PurchaseRequisition).filter(
                PurchaseRequisition.id == requisition_id,
                PurchaseRequisition.tenant_id == tenant_id,
                PurchaseRequisition.is_deleted == False,  # noqa: E712
            )
        )
        return result.scalars().first()

    async def get_requisition_items(
        self,
        db: AsyncSession,
        requisition_id: int,
    ) -> List["PurchaseRequisitionItem"]:
        from app.models.purchase_requisition_item import PurchaseRequisitionItem
        result = await db.execute(
            select(PurchaseRequisitionItem).filter(
                PurchaseRequisitionItem.requisition_id == requisition_id,
            )
        )
        return result.scalars().all()

    async def list_requisitions(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        query: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        department_id: Optional[int] = None,
        requested_by: Optional[int] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        skip: int = 0,
        limit: int = 25,
    ):
        from app.models.purchase_requisition import PurchaseRequisition
        filters = [
            PurchaseRequisition.tenant_id == tenant_id,
            PurchaseRequisition.is_deleted == False,  # noqa: E712
        ]
        if query:
            expr = f"%{query}%"
            filters.append(PurchaseRequisition.requisition_number.ilike(expr))
        if status:
            filters.append(PurchaseRequisition.status == status)
        if priority:
            filters.append(PurchaseRequisition.priority == priority)
        if department_id is not None:
            filters.append(PurchaseRequisition.department_id == department_id)
        if requested_by is not None:
            filters.append(PurchaseRequisition.requested_by == requested_by)
        if from_date:
            filters.append(PurchaseRequisition.requested_date >= from_date)
        if to_date:
            filters.append(PurchaseRequisition.requested_date <= to_date)

        count_result = await db.execute(
            select(func.count(PurchaseRequisition.id)).filter(*filters)
        )
        total = count_result.scalar() or 0

        result = await db.execute(
            select(PurchaseRequisition)
            .filter(*filters)
            .order_by(PurchaseRequisition.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all(), total

    # ── Purchase Requisition methods ─────────────────────────────────────────

    async def get_requisition(
        self, db: AsyncSession, requisition_id: int, tenant_id: str
    ):
        from app.models.purchase_requisition import PurchaseRequisition
        result = await db.execute(
            select(PurchaseRequisition).filter(
                PurchaseRequisition.id == requisition_id,
                PurchaseRequisition.tenant_id == tenant_id,
                PurchaseRequisition.is_deleted == False,  # noqa: E712
            )
        )
        return result.scalars().first()

    async def get_requisition_items(self, db: AsyncSession, requisition_id: int):
        from app.models.purchase_requisition_item import PurchaseRequisitionItem
        result = await db.execute(
            select(PurchaseRequisitionItem).filter(
                PurchaseRequisitionItem.requisition_id == requisition_id
            )
        )
        return result.scalars().all()

    async def list_requisitions(
        self,
        db: AsyncSession,
        tenant_id: str,
        *,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        department_id: Optional[int] = None,
        requested_by: Optional[int] = None,
        query: Optional[str] = None,
        date_from=None,
        date_to=None,
        skip: int = 0,
        limit: int = 25,
    ):
        from app.models.purchase_requisition import PurchaseRequisition
        filters = [
            PurchaseRequisition.tenant_id == tenant_id,
            PurchaseRequisition.is_deleted == False,  # noqa: E712
        ]
        if status:
            filters.append(PurchaseRequisition.status == status)
        if priority:
            filters.append(PurchaseRequisition.priority == priority)
        if department_id is not None:
            filters.append(PurchaseRequisition.department_id == department_id)
        if requested_by is not None:
            filters.append(PurchaseRequisition.requested_by == requested_by)
        if query:
            expr = f"%{query}%"
            filters.append(
                or_(
                    PurchaseRequisition.requisition_number.ilike(expr),
                    PurchaseRequisition.remarks.ilike(expr),
                )
            )
        if date_from:
            filters.append(PurchaseRequisition.requested_date >= date_from)
        if date_to:
            filters.append(PurchaseRequisition.requested_date <= date_to)

        count_result = await db.execute(
            select(func.count(PurchaseRequisition.id)).filter(*filters)
        )
        total = count_result.scalar() or 0

        result = await db.execute(
            select(PurchaseRequisition)
            .filter(*filters)
            .order_by(PurchaseRequisition.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all(), total
