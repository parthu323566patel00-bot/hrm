import asyncio
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite://"

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine, class_=AsyncSession)


def run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@pytest.fixture(name="db")
def db_fixture():
    # Create the tables in the in-memory test database
    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    run_async(init_db())
    
    db = TestingSessionLocal()
    
    # Seed default hospital tenant so foreign keys are satisfied
    async def seed_tenant():
        from app.models.tenant import Tenant
        tenant = Tenant(id="default-hospital", name="Test Hospital")
        db.add(tenant)
        await db.commit()
    run_async(seed_tenant())
    
    try:
        yield db
    finally:
        run_async(db.close())
        async def cleanup_db():
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        run_async(cleanup_db())


@pytest.fixture(name="client")
def client_fixture(db):
    async def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


