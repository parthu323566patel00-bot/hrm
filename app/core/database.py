from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Check if SQLite and apply thread workarounds
connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_async_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine, class_=AsyncSession)


Base = declarative_base()

async def get_db():
    async with SessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()

