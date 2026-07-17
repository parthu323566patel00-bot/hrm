import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_audit_log import InventoryAuditLog

logger = logging.getLogger(__name__)


class InventoryAuditService:

    async def log(
        self,
        db: AsyncSession,
        *,
        tenant_id: str,
        actor_id: int,
        action: str,
        entity: str,
        entity_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        try:
            entry = InventoryAuditLog(
                tenant_id=tenant_id,
                actor_id=actor_id,
                action=action,
                entity=entity,
                entity_id=entity_id,
                ip_address=ip_address,
                metadata_json=json.dumps(meta) if meta else None,
                created_at=datetime.utcnow(),
            )
            db.add(entry)
            await db.flush()  # write within current transaction; caller commits
        except Exception as exc:
            logger.error(
                "Inventory audit log write failed [entity=%s id=%s action=%s]: %s",
                entity,
                entity_id,
                action,
                exc,
            )


inventory_audit_service = InventoryAuditService()
