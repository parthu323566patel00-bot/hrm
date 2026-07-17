import asyncio
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

os.environ["TESTING"] = "1"

from app.main import app
from app.core.database import Base, get_db, engine

TestingSessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    bind=engine,
    class_=AsyncSession,
)

_test_event_loop = None

def get_test_event_loop():
    global _test_event_loop
    if _test_event_loop is None or _test_event_loop.is_closed():
        _test_event_loop = asyncio.new_event_loop()
    return _test_event_loop


def run_async(coro):
    loop = get_test_event_loop()
    return loop.run_until_complete(coro)


def close_test_event_loop():
    global _test_event_loop
    if _test_event_loop is not None and not _test_event_loop.is_closed():
        _test_event_loop.close()
        _test_event_loop = None


@pytest.fixture(name="db")
def db_fixture():
    async def init_db():
        async with engine.begin() as conn:
            # Ensure a clean database state by dropping and recreating the public schema.
            # This removes any leftover custom types (eg. ENUMs) that can cause
            # duplicate-type errors across test runs.
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.run_sync(Base.metadata.create_all)

    run_async(init_db())

    async def seed_tenant():
        from app.models.tenant import Tenant

        async with TestingSessionLocal() as session:
            result = await session.execute(select(Tenant).filter(Tenant.id == "default-hospital"))
            tenant = result.scalars().first()
            if not tenant:
                tenant = Tenant(id="default-hospital", name="Test Hospital")
                session.add(tenant)
                await session.commit()

    run_async(seed_tenant())

    db_session = TestingSessionLocal()

    try:
        yield db_session
    finally:
        run_async(db_session.close())

        async def cleanup_db():
            async with engine.begin() as conn:
                # Clean up by dropping and recreating the public schema to remove
                # any custom types or objects created during tests.
                await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
                await conn.execute(text("CREATE SCHEMA public"))

        run_async(cleanup_db())
        close_test_event_loop()


@pytest.fixture(name="client")
def client_fixture(db):
    async def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            await session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


