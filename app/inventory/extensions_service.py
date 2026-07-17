from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.inventory.repository import InventoryRepository
from app.inventory.service import InventoryStockService
from app.models.inventory_batch import InventoryBatch
from app.models.inventory_ledger_entry import InventoryLedgerEntry
from app.models.inventory_stock import InventoryStock
from app.models.inventory_transfer import InventoryTransfer
from app.models.inventory_transfer_item import InventoryTransferItem
from app.models.stock_adjustment import StockAdjustment
from app.models.stock_adjustment_item import StockAdjustmentItem
from app.models.stock_reservation import StockReservation
from app.models.product import Product
from app.models.storage_location import StorageLocation
from app.models.department import Department
from app.models.patient import Patient
from app.models.purchase_order import PurchaseOrder
from app.models.goods_receipt import GoodsReceipt
from app.models.supplier import Supplier


class InventoryExtensionsService:
    def __init__(self):
        self.repo = InventoryRepository()
        self.stock_service = InventoryStockService()

    async def _get_product_stock(self, db: AsyncSession, tenant_id: str, product_id: int) -> InventoryStock:
        stock = await self.repo.get_inventory_stock(db, product_id, tenant_id, for_update=True)
        if not stock:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory stock not found.")
        return stock

    async def _get_location(self, db: AsyncSession, tenant_id: str, location_id: int) -> StorageLocation:
        location = await self.repo.get_storage_location(db, location_id, tenant_id)
        if not location:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Storage location not found.")
        return location

    async def _get_product(self, db: AsyncSession, tenant_id: str, product_id: int) -> Product:
        product = await self.repo.get_product(db, product_id, tenant_id)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
        return product

    async def _get_batch(self, db: AsyncSession, tenant_id: str, product_id: int, batch_number: Optional[str]) -> Optional[InventoryBatch]:
        if not batch_number:
            return None
        return await self.repo.get_inventory_batch(db, tenant_id, product_id, batch_number, for_update=True)

    async def create_transfer(self, db: AsyncSession, tenant_id: str, user_id: int, payload: dict) -> InventoryTransfer:
        if payload.get("from_location_id") == payload.get("to_location_id"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer source and destination cannot be the same location.")
        from_location = await self._get_location(db, tenant_id, payload["from_location_id"])
        to_location = await self._get_location(db, tenant_id, payload["to_location_id"])
        if from_location.status != "active" or to_location.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer locations must be active.")

        transfer = InventoryTransfer(
            tenant_id=tenant_id,
            transfer_number=f"TRF-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            from_location_id=payload["from_location_id"],
            to_location_id=payload["to_location_id"],
            requested_by=user_id,
            status="draft",
            remarks=payload.get("remarks"),
        )
        db.add(transfer)
        await db.flush()

        for item_payload in payload.get("items", []):
            product = await self._get_product(db, tenant_id, item_payload["product_id"])
            if product.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product {product.name} is inactive.")
            stock = await self._get_product_stock(db, tenant_id, product.id)
            if stock.available_quantity < item_payload["quantity"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for product {product.name}.")
            transfer_item = InventoryTransferItem(
                tenant_id=tenant_id,
                transfer_id=transfer.id,
                product_id=product.id,
                batch_number=item_payload.get("batch_number"),
                quantity=item_payload["quantity"],
                remarks=item_payload.get("remarks"),
            )
            db.add(transfer_item)
        await db.flush()
        return transfer

    async def get_transfer(self, db: AsyncSession, tenant_id: str, transfer_id: int) -> Optional[InventoryTransfer]:
        return await self.repo.get_transfer(db, transfer_id, tenant_id)

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
        return await self.repo.list_transfers(
            db,
            tenant_id,
            query=query,
            status=status,
            from_location_id=from_location_id,
            to_location_id=to_location_id,
            skip=skip,
            limit=limit,
        )

    async def approve_transfer(self, db: AsyncSession, tenant_id: str, user_id: int, transfer: InventoryTransfer) -> InventoryTransfer:
        if transfer.status != "draft":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft transfers can be approved.")
        transfer.status = "approved"
        transfer.approved_by = user_id
        transfer.updated_at = datetime.utcnow()
        db.add(transfer)
        await db.flush()
        return transfer

    async def complete_transfer(self, db: AsyncSession, tenant_id: str, transfer: InventoryTransfer) -> InventoryTransfer:
        if transfer.status != "approved":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only approved transfers can be completed.")
        items = await self.repo.list_transfer_items(db, transfer.id, tenant_id)
        for item in items:
            product = await self._get_product(db, tenant_id, item.product_id)
            stock = await self._get_product_stock(db, tenant_id, product.id)
            if stock.available_quantity < item.quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for transfer of {product.name}.")
            before_quantity = stock.available_quantity
            after_quantity = stock.available_quantity
            await self._log_transfer_entry(
                db,
                tenant_id,
                product.id,
                item.quantity,
                transfer.id,
                transfer.from_location_id,
                transfer.to_location_id,
                before_quantity,
                after_quantity,
                transaction_type="transfer_out",
            )
            await self._log_transfer_entry(
                db,
                tenant_id,
                product.id,
                item.quantity,
                transfer.id,
                transfer.from_location_id,
                transfer.to_location_id,
                before_quantity,
                after_quantity,
                transaction_type="transfer_in",
            )
        transfer.status = "completed"
        transfer.updated_at = datetime.utcnow()
        db.add(transfer)
        await db.flush()
        return transfer

    async def cancel_transfer(self, db: AsyncSession, tenant_id: str, transfer: InventoryTransfer) -> InventoryTransfer:
        if transfer.status in {"completed", "cancelled"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This transfer cannot be cancelled.")
        transfer.status = "cancelled"
        transfer.updated_at = datetime.utcnow()
        db.add(transfer)
        await db.flush()
        return transfer

    async def _log_transfer_entry(
        self,
        db: AsyncSession,
        tenant_id: str,
        product_id: int,
        quantity: float,
        transfer_id: int,
        from_location_id: int,
        to_location_id: int,
        before_quantity: float,
        after_quantity: float,
        transaction_type: str = "transfer",
    ) -> None:
        entry = InventoryLedgerEntry(
            tenant_id=tenant_id,
            product_id=product_id,
            transaction_type=transaction_type,
            quantity=quantity,
            before_quantity=before_quantity,
            after_quantity=after_quantity,
            reference_type="inventory_transfer",
            reference_id=transfer_id,
            user_id=None,
        )
        db.add(entry)

    async def _log_adjustment_entry(
        self,
        db: AsyncSession,
        tenant_id: str,
        product_id: int,
        quantity: float,
        before_quantity: float,
        after_quantity: float,
        adjustment_id: int,
        transaction_type: str,
    ) -> None:
        entry = InventoryLedgerEntry(
            tenant_id=tenant_id,
            product_id=product_id,
            transaction_type=transaction_type,
            quantity=quantity,
            before_quantity=before_quantity,
            after_quantity=after_quantity,
            reference_type="stock_adjustment",
            reference_id=adjustment_id,
            user_id=None,
        )
        db.add(entry)

    async def _log_reservation_entry(
        self,
        db: AsyncSession,
        tenant_id: str,
        product_id: int,
        quantity: float,
        before_quantity: float,
        after_quantity: float,
        reservation_id: int,
        transaction_type: str,
    ) -> None:
        entry = InventoryLedgerEntry(
            tenant_id=tenant_id,
            product_id=product_id,
            transaction_type=transaction_type,
            quantity=quantity,
            before_quantity=before_quantity,
            after_quantity=after_quantity,
            reference_type="stock_reservation",
            reference_id=reservation_id,
            user_id=None,
        )
        db.add(entry)

    async def create_adjustment(self, db: AsyncSession, tenant_id: str, user_id: int, payload: dict) -> StockAdjustment:
        adjustment = StockAdjustment(
            tenant_id=tenant_id,
            adjustment_number=f"ADJ-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            reason=payload["reason"],
            status="draft",
            remarks=payload.get("remarks"),
            requested_by=user_id,
        )
        db.add(adjustment)
        await db.flush()

        for item_payload in payload.get("items", []):
            product = await self._get_product(db, tenant_id, item_payload["product_id"])
            if product.status != "active":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product {product.name} is inactive.")
            adjustment_item = StockAdjustmentItem(
                tenant_id=tenant_id,
                adjustment_id=adjustment.id,
                product_id=product.id,
                batch_number=item_payload.get("batch_number"),
                quantity=item_payload["quantity"],
                unit_cost=item_payload.get("unit_cost", 0.0),
                remarks=item_payload.get("remarks"),
            )
            db.add(adjustment_item)
        await db.flush()
        return adjustment

    async def get_adjustment(self, db: AsyncSession, tenant_id: str, adjustment_id: int) -> Optional[StockAdjustment]:
        return await self.repo.get_adjustment(db, adjustment_id, tenant_id)

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
        return await self.repo.list_adjustments(
            db,
            tenant_id,
            query=query,
            status=status,
            skip=skip,
            limit=limit,
        )

    async def approve_adjustment(self, db: AsyncSession, tenant_id: str, user_id: int, adjustment: StockAdjustment) -> StockAdjustment:
        if adjustment.status != "draft":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft adjustments can be approved.")
        items = await self.repo.list_adjustment_items(db, adjustment.id, tenant_id)
        for item in items:
            stock = await self._get_product_stock(db, tenant_id, item.product_id)
            before_quantity = stock.available_quantity
            if adjustment.reason == "Manual Increase":
                stock.available_quantity = stock.available_quantity + item.quantity
                stock.total_quantity = stock.total_quantity + item.quantity
                transaction_type = "adjustment_increase"
            elif adjustment.reason == "Manual Decrease":
                if stock.available_quantity < item.quantity:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient stock for manual decrease.")
                stock.available_quantity = stock.available_quantity - item.quantity
                stock.total_quantity = stock.total_quantity - item.quantity
                transaction_type = "adjustment_decrease"
            else:
                stock.available_quantity = stock.available_quantity + item.quantity
                stock.total_quantity = stock.total_quantity + item.quantity
                transaction_type = "adjustment_increase"
            db.add(stock)
            await self._log_adjustment_entry(
                db,
                tenant_id,
                item.product_id,
                item.quantity,
                before_quantity,
                stock.available_quantity,
                adjustment.id,
                transaction_type,
            )
        adjustment.status = "approved"
        adjustment.approved_by = user_id
        adjustment.updated_at = datetime.utcnow()
        db.add(adjustment)
        await db.flush()
        return adjustment

    async def cancel_adjustment(self, db: AsyncSession, tenant_id: str, adjustment: StockAdjustment) -> StockAdjustment:
        if adjustment.status in {"approved", "cancelled"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This adjustment cannot be cancelled.")
        adjustment.status = "cancelled"
        adjustment.updated_at = datetime.utcnow()
        db.add(adjustment)
        await db.flush()
        return adjustment

    async def create_reservation(self, db: AsyncSession, tenant_id: str, payload: dict) -> StockReservation:
        product = await self._get_product(db, tenant_id, payload["product_id"])
        reservation = StockReservation(
            tenant_id=tenant_id,
            patient_id=payload.get("patient_id"),
            department_id=payload.get("department_id"),
            product_id=product.id,
            batch_number=payload.get("batch_number"),
            quantity=payload["quantity"],
            expiry_datetime=payload.get("expiry_datetime"),
            status="active",
            remarks=payload.get("remarks"),
        )
        db.add(reservation)
        await db.flush()
        await self.stock_service.change_stock(
            db,
            tenant_id,
            product.id,
            "reserve",
            payload["quantity"],
            user_id=None,
            reference_type="stock_reservation",
            reference_id=reservation.id,
            batch_number=payload.get("batch_number"),
        )
        return reservation

    async def get_reservation(self, db: AsyncSession, tenant_id: str, reservation_id: int) -> Optional[StockReservation]:
        return await self.repo.get_reservation(db, reservation_id, tenant_id)

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
        return await self.repo.list_reservations(
            db,
            tenant_id,
            query=query,
            status=status,
            product_id=product_id,
            patient_id=patient_id,
            department_id=department_id,
            skip=skip,
            limit=limit,
        )

    async def release_reservation(self, db: AsyncSession, tenant_id: str, reservation: StockReservation) -> StockReservation:
        if reservation.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only active reservations can be released.")
        await self.stock_service.change_stock(
            db,
            tenant_id,
            reservation.product_id,
            "release",
            reservation.quantity,
            user_id=None,
            reference_type="stock_reservation",
            reference_id=reservation.id,
            batch_number=reservation.batch_number,
        )
        reservation.status = "released"
        db.add(reservation)
        await db.flush()
        return reservation

    async def consume_reservation(self, db: AsyncSession, tenant_id: str, reservation: StockReservation) -> StockReservation:
        if reservation.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only active reservations can be consumed.")

        stock = await self.repo.get_inventory_stock(db, reservation.product_id, tenant_id, for_update=True)
        if not stock:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory stock not found.")
        if stock.total_quantity < reservation.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient total stock to consume reservation.")

        before_quantity = stock.available_quantity
        stock.total_quantity = stock.total_quantity - reservation.quantity
        db.add(stock)

        if reservation.batch_number:
            batch = await self.repo.get_inventory_batch(db, tenant_id, reservation.product_id, reservation.batch_number, for_update=True)
            if batch:
                batch.quantity = max(0.0, batch.quantity - reservation.quantity)
                db.add(batch)

        reservation.status = "consumed"
        db.add(reservation)
        await self._log_reservation_entry(
            db,
            tenant_id,
            reservation.product_id,
            reservation.quantity,
            before_quantity,
            stock.available_quantity,
            reservation.id,
            transaction_type="reservation_consume",
        )
        await db.flush()
        return reservation

    async def list_dashboard(self, db: AsyncSession, tenant_id: str) -> dict:
        products = await db.scalar(select(func.count(Product.id)).filter(Product.tenant_id == tenant_id, Product.is_deleted == False)) or 0
        stock_rows = await db.execute(select(InventoryStock).filter(InventoryStock.tenant_id == tenant_id))
        stock_values = stock_rows.scalars().all()
        total_stock = sum(row.total_quantity for row in stock_values)
        batch_rows = await db.execute(select(InventoryBatch).filter(InventoryBatch.tenant_id == tenant_id))
        batch_values = batch_rows.scalars().all()
        total_inventory_value = sum((batch.available_quantity or 0.0) * (batch.unit_cost or 0.0) for batch in batch_values)
        pending_purchase_orders = await db.scalar(select(func.count()).select_from(PurchaseOrder).filter(PurchaseOrder.tenant_id == tenant_id, PurchaseOrder.status == 'pending')) or 0
        today_goods_receipts = await db.scalar(select(func.count()).select_from(GoodsReceipt).filter(GoodsReceipt.tenant_id == tenant_id, func.date(GoodsReceipt.created_at) == date.today())) or 0
        low_stock_count = await db.scalar(
            select(func.count(Product.id))
            .join(InventoryStock, InventoryStock.product_id == Product.id)
            .filter(
                Product.tenant_id == tenant_id,
                Product.is_deleted == False,
                Product.minimum_stock > 0,
                InventoryStock.available_quantity <= Product.minimum_stock,
            )
        ) or 0
        near_expiry_count = await db.scalar(
            select(func.count(InventoryBatch.id)).filter(
                InventoryBatch.tenant_id == tenant_id,
                InventoryBatch.available_quantity > 0,
                InventoryBatch.expiry_date >= date.today(),
                InventoryBatch.expiry_date <= date.today() + timedelta(days=30),
            )
        ) or 0
        expired_count = await db.scalar(
            select(func.count(InventoryBatch.id)).filter(
                InventoryBatch.tenant_id == tenant_id,
                InventoryBatch.available_quantity > 0,
                InventoryBatch.expiry_date < date.today(),
            )
        ) or 0
        dead_stock_count = await db.scalar(
            select(func.count(InventoryBatch.id)).filter(
                InventoryBatch.tenant_id == tenant_id,
                InventoryBatch.available_quantity > 0,
                InventoryBatch.expiry_date < date.today() - timedelta(days=30),
            )
        ) or 0
        suppliers = await db.scalar(select(func.count()).select_from(Supplier).filter(Supplier.tenant_id == tenant_id)) or 0
        return {
            "total_products": products,
            "total_stock": round(total_stock, 2),
            "total_inventory_value": round(total_inventory_value, 2),
            "pending_purchase_orders": pending_purchase_orders,
            "todays_goods_receipts": today_goods_receipts,
            "low_stock_count": low_stock_count,
            "near_expiry_count": near_expiry_count,
            "expired_count": expired_count,
            "dead_stock_count": dead_stock_count,
            "total_suppliers": suppliers,
        }

    async def list_alerts(self, db: AsyncSession, tenant_id: str, reason: Optional[str] = None) -> List[dict]:
        alerts: List[dict] = []
        today = date.today()
        low_stock_rows = await db.execute(
            select(Product, InventoryStock)
            .join(InventoryStock, InventoryStock.product_id == Product.id)
            .filter(
                Product.tenant_id == tenant_id,
                Product.is_deleted == False,
                Product.minimum_stock > 0,
                InventoryStock.available_quantity <= Product.minimum_stock,
            )
        )
        for product, stock in low_stock_rows.all():
            alerts.append({
                "type": "low_stock",
                "product_id": product.id,
                "product_name": product.name,
                "quantity": stock.available_quantity,
            })

        near_expiry_rows = await db.execute(
            select(InventoryBatch)
            .filter(
                InventoryBatch.tenant_id == tenant_id,
                InventoryBatch.available_quantity > 0,
                InventoryBatch.expiry_date >= today,
                InventoryBatch.expiry_date <= today + timedelta(days=30),
            )
        )
        for batch in near_expiry_rows.scalars().all():
            product = await self.repo.get_product(db, batch.product_id, tenant_id)
            alerts.append({
                "type": "near_expiry",
                "product_id": batch.product_id,
                "product_name": product.name if product else None,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "quantity": batch.available_quantity,
            })

        expired_rows = await db.execute(
            select(InventoryBatch)
            .filter(
                InventoryBatch.tenant_id == tenant_id,
                InventoryBatch.available_quantity > 0,
                InventoryBatch.expiry_date < today,
            )
        )
        for batch in expired_rows.scalars().all():
            product = await self.repo.get_product(db, batch.product_id, tenant_id)
            alerts.append({
                "type": "expired_stock",
                "product_id": batch.product_id,
                "product_name": product.name if product else None,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "quantity": batch.available_quantity,
            })

        dead_stock_rows = await db.execute(
            select(InventoryBatch)
            .filter(
                InventoryBatch.tenant_id == tenant_id,
                InventoryBatch.available_quantity > 0,
                InventoryBatch.expiry_date < today - timedelta(days=30),
            )
        )
        for batch in dead_stock_rows.scalars().all():
            product = await self.repo.get_product(db, batch.product_id, tenant_id)
            alerts.append({
                "type": "dead_stock",
                "product_id": batch.product_id,
                "product_name": product.name if product else None,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "quantity": batch.available_quantity,
            })

        overstock_rows = await db.execute(
            select(Product, InventoryStock)
            .join(InventoryStock, InventoryStock.product_id == Product.id)
            .filter(
                Product.tenant_id == tenant_id,
                Product.is_deleted == False,
                Product.maximum_stock > 0,
                InventoryStock.total_quantity > Product.maximum_stock,
            )
        )
        for product, stock in overstock_rows.all():
            alerts.append({
                "type": "overstock",
                "product_id": product.id,
                "product_name": product.name,
                "quantity": stock.total_quantity,
                "maximum_stock": product.maximum_stock,
            })

        if reason:
            alerts = [alert for alert in alerts if alert["type"] == reason]
        return alerts

    async def list_reports(self, db: AsyncSession, tenant_id: str, report_type: str, filters: Optional[dict] = None, page: int = 1, limit: int = 25) -> dict:
        filters = filters or {}
        skip = (page - 1) * limit
        if report_type == "inventory_stock":
            result = await db.execute(
                select(InventoryStock)
                .filter(InventoryStock.tenant_id == tenant_id)
                .order_by(InventoryStock.updated_at.desc())
                .offset(skip)
                .limit(limit)
            )
            rows = result.scalars().all()
            data = []
            for row in rows:
                product = await self.repo.get_product(db, row.product_id, tenant_id)
                data.append({
                    "product_id": row.product_id,
                    "product_name": product.name if product else None,
                    "available_quantity": row.available_quantity,
                    "total_quantity": row.total_quantity,
                    "last_updated": row.updated_at,
                })
            total = await db.scalar(select(func.count(InventoryStock.id)).filter(InventoryStock.tenant_id == tenant_id)) or 0
            return {"data": data, "meta": {"page": page, "page_size": limit, "total": total}}

        if report_type == "transfers":
            result = await db.execute(
                select(InventoryTransfer)
                .filter(InventoryTransfer.tenant_id == tenant_id)
                .order_by(InventoryTransfer.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            rows = result.scalars().all()
            data = []
            for row in rows:
                items = await self.repo.get_transfer_items(db, row.id, tenant_id)
                data.append({
                    "id": row.id,
                    "transfer_number": row.transfer_number,
                    "status": row.status,
                    "from_location_id": row.from_location_id,
                    "to_location_id": row.to_location_id,
                    "item_count": len(items),
                    "remarks": row.remarks,
                    "created_at": row.created_at,
                    "updated_at": row.updated_at,
                })
            total = await db.scalar(select(func.count(InventoryTransfer.id)).filter(InventoryTransfer.tenant_id == tenant_id)) or 0
            return {"data": data, "meta": {"page": page, "page_size": limit, "total": total}}

        if report_type == "adjustments":
            result = await db.execute(
                select(StockAdjustment)
                .filter(StockAdjustment.tenant_id == tenant_id)
                .order_by(StockAdjustment.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            rows = result.scalars().all()
            data = [{
                "id": row.id,
                "adjustment_number": row.adjustment_number,
                "status": row.status,
                "reason": row.reason,
                "remarks": row.remarks,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            } for row in rows]
            total = await db.scalar(select(func.count(StockAdjustment.id)).filter(StockAdjustment.tenant_id == tenant_id)) or 0
            return {"data": data, "meta": {"page": page, "page_size": limit, "total": total}}

        if report_type == "reservations":
            result = await db.execute(
                select(StockReservation)
                .filter(StockReservation.tenant_id == tenant_id)
                .order_by(StockReservation.created_at.desc())
                .offset(skip)
                .limit(limit)
            )
            rows = result.scalars().all()
            data = [{
                "id": row.id,
                "product_id": row.product_id,
                "batch_number": row.batch_number,
                "quantity": row.quantity,
                "status": row.status,
                "expiry_datetime": row.expiry_datetime,
                "remarks": row.remarks,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            } for row in rows]
            total = await db.scalar(select(func.count(StockReservation.id)).filter(StockReservation.tenant_id == tenant_id)) or 0
            return {"data": data, "meta": {"page": page, "page_size": limit, "total": total}}

        return {"data": [], "meta": {"page": page, "page_size": limit, "total": 0}}
