"""
app/core/database.py
---------------------
Async SQLAlchemy engine configured for PostgreSQL (asyncpg driver).

Connection pool settings:
  pool_pre_ping  — drops stale connections before use
  pool_recycle   — recycles connections after 1 hour
  pool_size      — 10 persistent connections
  max_overflow   — up to 20 additional burst connections
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
    class_=AsyncSession,
)

Base = declarative_base()

# Import all models so table metadata is registered on Base.metadata.
# This ensures create_all() works even when app.core.database is imported
# before app.models by other scripts or tools.
import app.models  # noqa: F401

async def get_db():
    async with SessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()
