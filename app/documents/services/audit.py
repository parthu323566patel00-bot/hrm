"""
app/documents/services/audit.py
---------------------------------
AuditService — append-only document audit log writer.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.models import DocumentAuditLog

logger = logging.getLogger(__name__)


class AuditService:

    async def log(
        self,
        db: AsyncSession,
        *,
        document_id: int,
        actor_id: int,
        tenant_id: str,
        action: str,
        ip_address: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Write an audit log entry. Failures are swallowed so they never
        interrupt the main flow — but they are always logged.
        """
        try:
            entry = DocumentAuditLog(
                document_id=document_id,
                actor_id=actor_id,
                tenant_id=tenant_id,
                action=action,
                ip_address=ip_address,
                metadata_json=json.dumps(meta) if meta else None,
                created_at=datetime.utcnow(),
            )
            db.add(entry)
            await db.commit()
        except Exception as exc:
            logger.error("Audit log write failed [doc=%s action=%s]: %s",
                         document_id, action, exc)


audit_service = AuditService()
