from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.inventory.repository import InventoryRepository
from app.models.inventory_batch import InventoryBatch
from app.models.inventory_ledger_entry import InventoryLedgerEntry
from app.models.inventory_stock import InventoryStock


class InventoryStockService:
    def __init__(self):
        self.repo = InventoryRepository()

    async def get_stock(self, db: AsyncSession, tenant_id: str, product_id: int) -> Optional[InventoryStock]:
        return await self.repo.get_inventory_stock(db, product_id, tenant_id)

    async def list_stock(self, db: AsyncSession, tenant_id: str, product_id: Optional[int] = None, skip: int = 0, limit: int = 25):
        return await self.repo.list_inventory_stock(db, tenant_id, product_id=product_id, skip=skip, limit=limit)

    async def list_ledger_entries(
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
        return await self.repo.list_inventory_ledger_entries(
            db,
            tenant_id,
            product_id=product_id,
            transaction_type=transaction_type,
            reference_type=reference_type,
            query=query,
            skip=skip,
            limit=limit,
        )

    async def change_stock(
        self,
        db: AsyncSession,
        tenant_id: str,
        product_id: int,
        transaction_type: str,
        quantity: float,
        user_id: int,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        batch_number: Optional[str] = None,
    ) -> InventoryLedgerEntry:
        if quantity is None or quantity <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be greater than zero.")

        if transaction_type not in {"issue", "consume", "reserve", "release"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid transaction type.")

        stock = await self.repo.get_inventory_stock(db, product_id, tenant_id, for_update=True)
        if not stock:
            if transaction_type in {"issue", "consume", "reserve", "release"}:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product stock record not found.")

        before_quantity = stock.available_quantity
        if transaction_type in {"issue", "consume"}:
            new_available = stock.available_quantity - quantity
            new_total = stock.total_quantity - quantity
        elif transaction_type == "reserve":
            new_available = stock.available_quantity - quantity
            new_total = stock.total_quantity
        else:  # release
            new_available = stock.available_quantity + quantity
            new_total = stock.total_quantity

        if new_available < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient available stock.")
        if new_total < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient total stock.")

        stock.available_quantity = new_available
        stock.total_quantity = new_total
        db.add(stock)
        await db.flush()

        await self._allocate_batch_quantity(
            db,
            tenant_id,
            product_id,
            quantity,
            transaction_type,
            batch_number=batch_number,
        )

        entry = InventoryLedgerEntry(
            tenant_id=tenant_id,
            product_id=product_id,
            transaction_type=transaction_type,
            quantity=quantity,
            before_quantity=before_quantity,
            after_quantity=new_available,
            reference_type=reference_type or transaction_type,
            reference_id=reference_id,
            user_id=user_id,
            created_at=datetime.utcnow(),
        )
        db.add(entry)
        await db.flush()
        return entry

    async def _allocate_batch_quantity(
        self,
        db: AsyncSession,
        tenant_id: str,
        product_id: int,
        quantity: float,
        transaction_type: str,
        batch_number: Optional[str] = None,
    ) -> None:
        if transaction_type == "release":
            batch = None
            if batch_number:
                batch = await self.repo.get_inventory_batch(db, tenant_id, product_id, batch_number)
            if not batch:
                batches = await self.repo.list_inventory_batches(db, tenant_id, product_id)
                if not batches:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product batch not found for release.")
                batch = batches[0]

            batch.available_quantity = min(batch.quantity, batch.available_quantity + quantity)
            db.add(batch)
            await db.flush()
            return

        if batch_number:
            batch = await self.repo.get_inventory_batch(db, tenant_id, product_id, batch_number, for_update=True)
            if not batch:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product batch not found.")
            batches = [batch]
        else:
            current_date = datetime.utcnow().date()
            result = await db.execute(
                select(InventoryBatch)
                .filter(
                    InventoryBatch.tenant_id == tenant_id,
                    InventoryBatch.product_id == product_id,
                    InventoryBatch.available_quantity > 0,
                    InventoryBatch.expiry_date >= current_date,
                )
                .order_by(asc(InventoryBatch.expiry_date), asc(InventoryBatch.created_at))
                .with_for_update()
            )
            batches = result.scalars().all()

        remaining = quantity
        for batch in batches:
            if remaining <= 0:
                break
            if batch.available_quantity <= 0:
                continue
            if batch.expiry_date < datetime.utcnow().date():
                continue
            use_qty = min(batch.available_quantity, remaining)
            if transaction_type == "reserve":
                batch.available_quantity = max(0.0, batch.available_quantity - use_qty)
            else:  # issue/consume
                batch.available_quantity = max(0.0, batch.available_quantity - use_qty)
                batch.quantity = max(0.0, batch.quantity - use_qty)
            db.add(batch)
            remaining -= use_qty

        if remaining > 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient batch stock for requested quantity.")

        await db.flush()
