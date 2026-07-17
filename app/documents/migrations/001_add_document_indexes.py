"""
app/documents/migrations/001_add_document_indexes.py
-------------------------------------------------------
Strategic indexes for document queries to meet performance targets.

This migration adds essential indexes for:
- Status polling queries
- Duplicate detection
- Tenant/patient document retrieval
- OCR batch processing

Run BEFORE going to production.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


async def add_indexes(engine):
    """Create all performance-critical indexes."""
    
    async with engine.begin() as conn:
        indexes = [
            # documents table
            """
            CREATE INDEX IF NOT EXISTS idx_doc_tenant_status 
            ON documents(tenant_id, status);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_doc_patient_status 
            ON documents(patient_id, status);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_doc_status_uploaded_at 
            ON documents(status, uploaded_at DESC);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_doc_visit_patient 
            ON documents(visit_id, patient_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_doc_sha256_hash
            ON documents(tenant_id, patient_id, sha256_hash);
            """,
            
            # document_content table
            """
            CREATE INDEX IF NOT EXISTS idx_doc_content_classified 
            ON document_content(classified_as);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_doc_content_ocr_status 
            ON document_content(ocr_status);
            """,
            
            # document_audit_logs table
            """
            CREATE INDEX IF NOT EXISTS idx_audit_doc_created 
            ON document_audit_logs(document_id, created_at DESC);
            """,
        ]
        
        for idx_sql in indexes:
            try:
                await conn.execute(text(idx_sql))
                print(f"✓ Index created: {idx_sql.split('ON')[1].split('(')[0].strip()}")
            except Exception as exc:
                print(f"⚠ Index creation skipped (may already exist): {exc}")


async def main():
    """Run migration."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )
    await add_indexes(engine)
    await engine.dispose()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
