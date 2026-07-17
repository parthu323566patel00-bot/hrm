from fastapi import status
from app.core.crypto import public_key
from cryptography.hazmat.primitives.asymmetric import padding
import base64


def encrypt_password(password: str) -> str:
    encrypted = public_key.encrypt(
        password.encode("utf-8"),
        padding.PKCS1v15()
    )
    return base64.b64encode(encrypted).decode("utf-8")


def test_create_product_and_duplicate(client, db):
    # Seed admin user and role
    from sqlalchemy import delete
    from app.models.role import Role
    from app.models.user import User
    from app.crud.user import create_user
    from app.schemas.user import UserCreate

    async def seed():
        await db.execute(delete(User).where(User.tenant_id == "default-hospital"))
        await db.execute(delete(Role).where(Role.tenant_id == "default-hospital"))
        await db.commit()

        role = Role(id=1, tenant_id="default-hospital", name="Super Admin", description="System Admin")
        db.add(role)
        await db.commit()

        admin_in = UserCreate(
            email="admin@medicore.com",
            tenant_id="default-hospital",
            role_id=1,
            password="adminpassword123",
            full_name="System Admin",
            is_superuser=True,
            is_active=True
        )
        await create_user(db, user_in=admin_in)

    from app.tests.conftest import run_async
    run_async(seed())

    # Login
    login_payload = {"username": "admin@medicore.com", "password": encrypt_password("adminpassword123")}
    login_res = client.post("/api/v1/auth/login", data=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create required masters
    cat_res = client.post("/api/v1/inventory/categories", json={"name": "TestCat"}, headers=headers)
    assert cat_res.status_code == status.HTTP_201_CREATED
    cat_id = cat_res.json()["id"]

    unit_res = client.post("/api/v1/inventory/units", json={"name": "pcs"}, headers=headers)
    assert unit_res.status_code == status.HTTP_201_CREATED
    unit_id = unit_res.json()["id"]

    mfg_res = client.post("/api/v1/inventory/manufacturers", json={"name": "MfgA"}, headers=headers)
    assert mfg_res.status_code == status.HTTP_201_CREATED
    mfg_id = mfg_res.json()["id"]

    brand_res = client.post(
        "/api/v1/inventory/brands",
        json={"name": "BrandX", "manufacturer_id": mfg_id},
        headers=headers,
    )
    assert brand_res.status_code == status.HTTP_201_CREATED
    brand_id = brand_res.json()["id"]

    supp_res = client.post(
        "/api/v1/inventory/suppliers",
        json={"name": "SuppA", "phone": "1234567890"},
        headers=headers,
    )
    assert supp_res.status_code == status.HTTP_201_CREATED
    supp_id = supp_res.json()["id"]

    loc_res = client.post(
        "/api/v1/inventory/locations",
        json={"name": "MainWH"},
        headers=headers,
    )
    assert loc_res.status_code == status.HTTP_201_CREATED
    loc_id = loc_res.json()["id"]

    # Create product
    product_payload = {
        "product_code": "P-TEST-001",
        "name": "Test Product",
        "category_id": cat_id,
        "brand_id": brand_id,
        "manufacturer_id": mfg_id,
        "unit_id": unit_id,
        "default_supplier_id": supp_id,
        "storage_location_id": loc_id,
    }

    p_res = client.post("/api/v1/inventory/products", json=product_payload, headers=headers)
    assert p_res.status_code == status.HTTP_201_CREATED
    p_json = p_res.json()
    assert p_json["product_code"] == "P-TEST-001"

    # Duplicate product_code should return 400
    dup_res = client.post("/api/v1/inventory/products", json=product_payload, headers=headers)
    assert dup_res.status_code == status.HTTP_400_BAD_REQUEST


def test_purchase_order_and_goods_receipt_response_batching(client, db):
    from sqlalchemy import delete
    from app.models.role import Role
    from app.models.user import User
    from app.crud.user import create_user
    from app.schemas.user import UserCreate

    async def seed_full():
        await db.execute(delete(User).where(User.tenant_id == "default-hospital"))
        await db.execute(delete(Role).where(Role.tenant_id == "default-hospital"))
        await db.commit()

        role = Role(id=1, tenant_id="default-hospital", name="Super Admin", description="System Admin")
        db.add(role)
        await db.commit()

        admin_in = UserCreate(
            email="admin@medicore.com",
            tenant_id="default-hospital",
            role_id=1,
            password="adminpassword123",
            full_name="System Admin",
            is_superuser=True,
            is_active=True,
        )
        await create_user(db, user_in=admin_in)

    from app.tests.conftest import run_async
    run_async(seed_full())

    # Login
    login_payload = {"username": "admin@medicore.com", "password": encrypt_password("adminpassword123")}
    login_res = client.post("/api/v1/auth/login", data=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create masters if missing (category/unit/manufacturer/brand/supplier/location)
    client.post("/api/v1/inventory/categories", json={"name": "SeedCat"}, headers=headers)
    client.post("/api/v1/inventory/units", json={"name": "pcs"}, headers=headers)
    client.post("/api/v1/inventory/manufacturers", json={"name": "SeedMfg"}, headers=headers)
    # brand requires manufacturer id; fetch created ones
    mfg_list = client.get("/api/v1/inventory/manufacturers", headers=headers).json()
    mfg_id = mfg_list[0]["id"] if mfg_list else 1
    client.post("/api/v1/inventory/brands", json={"name": "SeedBrand", "manufacturer_id": mfg_id}, headers=headers)
    client.post("/api/v1/inventory/suppliers", json={"name": "SeedSupp", "phone": "9999999999"}, headers=headers)
    client.post("/api/v1/inventory/locations", json={"name": "SeedLoc"}, headers=headers)

    # Create two products
    prod_template = {
        "product_code": "P-BATCH-",
        "name": "Batch Product ",
        "category_id": 1,
        "brand_id": 1,
        "manufacturer_id": mfg_id,
        "unit_id": 1,
        "default_supplier_id": 1,
        "storage_location_id": 1,
    }
    p1 = prod_template.copy(); p1["product_code"] += "1"; p1["name"] += "1"
    p2 = prod_template.copy(); p2["product_code"] += "2"; p2["name"] += "2"
    client.post("/api/v1/inventory/products", json=p1, headers=headers)
    client.post("/api/v1/inventory/products", json=p2, headers=headers)

    prod_list = client.get("/api/v1/inventory/products", headers=headers)
    assert prod_list.status_code == status.HTTP_200_OK
    data = prod_list.json()
    prods = data[0:2] if isinstance(data, list) else data.get("data", [])[:2]
    if len(prods) < 2:
        return

    items = [
        {"product_id": prods[0]["id"], "quantity": 5, "expected_unit_price": 10.0},
        {"product_id": prods[1]["id"], "quantity": 3, "expected_unit_price": 5.0},
    ]

    po_payload = {"supplier_id": 1, "items": items}
    po_res = client.post("/api/v1/inventory/purchase-orders", json=po_payload, headers=headers)
    assert po_res.status_code == status.HTTP_201_CREATED
    po_json = po_res.json()
    assert "items" in po_json and len(po_json["items"]) == 2
    for it in po_json["items"]:
        assert it.get("product_name") is not None

    gr_items = []
    for it in po_json["items"]:
        gr_items.append({
            "purchase_order_item_id": it["id"],
            "product_id": it["product_id"],
            "received_quantity": it.get("quantity", 1),
            "unit_cost": it.get("expected_unit_price", 1.0),
            "batch_number": "BATCH-1",
            "manufacturing_date": "2024-01-01",
            "expiry_date": "2028-12-31",
        })

    gr_payload = {"purchase_order_id": po_json["id"], "items": gr_items}
    gr_res = client.post("/api/v1/inventory/goods-receipts", json=gr_payload, headers=headers)
    assert gr_res.status_code == status.HTTP_201_CREATED
    gr_json = gr_res.json()
    assert "items" in gr_json and len(gr_json["items"]) == 2
    for it in gr_json["items"]:
        assert it.get("product_name") is not None


def test_inventory_stock_transaction_and_ledger(client, db):
    from sqlalchemy import delete
    from app.models.role import Role
    from app.models.user import User
    from app.crud.user import create_user
    from app.schemas.user import UserCreate

    async def seed_full():
        await db.execute(delete(User).where(User.tenant_id == "default-hospital"))
        await db.execute(delete(Role).where(Role.tenant_id == "default-hospital"))
        await db.commit()

        role = Role(id=1, tenant_id="default-hospital", name="Super Admin", description="System Admin")
        db.add(role)
        await db.commit()

        admin_in = UserCreate(
            email="admin@medicore.com",
            tenant_id="default-hospital",
            role_id=1,
            password="adminpassword123",
            full_name="System Admin",
            is_superuser=True,
            is_active=True,
        )
        await create_user(db, user_in=admin_in)

    from app.tests.conftest import run_async
    run_async(seed_full())

    login_payload = {"username": "admin@medicore.com", "password": encrypt_password("adminpassword123")}
    login_res = client.post("/api/v1/auth/login", data=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/v1/inventory/categories", json={"name": "StockCat"}, headers=headers)
    client.post("/api/v1/inventory/units", json={"name": "pcs"}, headers=headers)
    client.post("/api/v1/inventory/manufacturers", json={"name": "StockMfg"}, headers=headers)
    mfg_list = client.get("/api/v1/inventory/manufacturers", headers=headers).json()
    mfg_id = mfg_list[0]["id"]
    client.post("/api/v1/inventory/brands", json={"name": "StockBrand", "manufacturer_id": mfg_id}, headers=headers)
    client.post("/api/v1/inventory/suppliers", json={"name": "StockSupp", "phone": "9999999999"}, headers=headers)
    client.post("/api/v1/inventory/locations", json={"name": "StockLoc"}, headers=headers)

    prod_payload = {
        "product_code": "P-STOCK-001",
        "name": "Stock Product",
        "category_id": 1,
        "brand_id": 1,
        "manufacturer_id": mfg_id,
        "unit_id": 1,
        "default_supplier_id": 1,
        "storage_location_id": 1,
    }
    prod_res = client.post("/api/v1/inventory/products", json=prod_payload, headers=headers)
    assert prod_res.status_code == status.HTTP_201_CREATED
    product_id = prod_res.json()["id"]

    po_payload = {
        "supplier_id": 1,
        "items": [{"product_id": product_id, "quantity": 10, "expected_unit_price": 2.0}],
    }
    po_res = client.post("/api/v1/inventory/purchase-orders", json=po_payload, headers=headers)
    assert po_res.status_code == status.HTTP_201_CREATED
    po_json = po_res.json()

    gr_payload = {
        "purchase_order_id": po_json["id"],
        "items": [
            {
                "purchase_order_item_id": po_json["items"][0]["id"],
                "product_id": product_id,
                "received_quantity": 10,
                "unit_cost": 2.0,
                "batch_number": "STOCK-BATCH-1",
                "manufacturing_date": "2024-01-01",
                "expiry_date": "2028-12-31",
            }
        ],
    }
    gr_res = client.post("/api/v1/inventory/goods-receipts", json=gr_payload, headers=headers)
    assert gr_res.status_code == status.HTTP_201_CREATED

    stock_res = client.get(f"/api/v1/inventory/stock/{product_id}", headers=headers)
    assert stock_res.status_code == status.HTTP_200_OK
    stock_json = stock_res.json()
    assert stock_json["available_quantity"] == 10
    assert stock_json["total_quantity"] == 10

    transaction_payload = {
        "product_id": product_id,
        "transaction_type": "issue",
        "quantity": 3,
        "reference_type": "order",
        "reference_id": 123,
    }
    tx_res = client.post("/api/v1/inventory/stock/transactions", json=transaction_payload, headers=headers)
    assert tx_res.status_code == status.HTTP_201_CREATED
    tx_json = tx_res.json()
    assert tx_json["transaction_type"] == "issue"
    assert tx_json["quantity"] == 3
    assert tx_json["before_quantity"] == 10
    assert tx_json["after_quantity"] == 7

    stock_res2 = client.get(f"/api/v1/inventory/stock/{product_id}", headers=headers)
    assert stock_res2.status_code == status.HTTP_200_OK
    stock_json2 = stock_res2.json()
    assert stock_json2["available_quantity"] == 7
    assert stock_json2["total_quantity"] == 7

    ledger_res = client.get(f"/api/v1/inventory/stock/ledger?product_id={product_id}", headers=headers)
    assert ledger_res.status_code == status.HTTP_200_OK
    ledger_json = ledger_res.json()
    assert any(entry["transaction_type"] == "issue" for entry in ledger_json["data"])
