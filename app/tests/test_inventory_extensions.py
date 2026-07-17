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


def seed_admin_user(db):
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
            is_active=True,
        )
        await create_user(db, user_in=admin_in)

    from app.tests.conftest import run_async
    run_async(seed())


def test_inventory_extension_endpoints(client, db):
    seed_admin_user(db)

    login_payload = {"username": "admin@medicore.com", "password": encrypt_password("adminpassword123")}
    login_res = client.post("/api/v1/auth/login", data=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create required inventory masters.
    cat_res = client.post("/api/v1/inventory/categories", json={"name": "ExtCat"}, headers=headers)
    assert cat_res.status_code == status.HTTP_201_CREATED
    cat_id = cat_res.json()["id"]

    unit_res = client.post("/api/v1/inventory/units", json={"name": "pcs"}, headers=headers)
    assert unit_res.status_code == status.HTTP_201_CREATED
    unit_id = unit_res.json()["id"]

    mfg_res = client.post("/api/v1/inventory/manufacturers", json={"name": "ExtMfg"}, headers=headers)
    assert mfg_res.status_code == status.HTTP_201_CREATED
    mfg_id = mfg_res.json()["id"]

    brand_res = client.post(
        "/api/v1/inventory/brands",
        json={"name": "ExtBrand", "manufacturer_id": mfg_id},
        headers=headers,
    )
    assert brand_res.status_code == status.HTTP_201_CREATED
    brand_id = brand_res.json()["id"]

    supp_res = client.post(
        "/api/v1/inventory/suppliers",
        json={"name": "ExtSupp", "phone": "1234567890"},
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
    from_location_id = loc_res.json()["id"]

    to_loc_res = client.post(
        "/api/v1/inventory/locations",
        json={"name": "SecondaryWH"},
        headers=headers,
    )
    assert to_loc_res.status_code == status.HTTP_201_CREATED
    to_location_id = to_loc_res.json()["id"]

    product_payload = {
        "product_code": "EXT-PROD-001",
        "name": "Extension Product",
        "category_id": cat_id,
        "brand_id": brand_id,
        "manufacturer_id": mfg_id,
        "unit_id": unit_id,
        "default_supplier_id": supp_id,
        "storage_location_id": from_location_id,
    }
    p_res = client.post("/api/v1/inventory/products", json=product_payload, headers=headers)
    assert p_res.status_code == status.HTTP_201_CREATED
    product_id = p_res.json()["id"]

    po_payload = {
        "supplier_id": supp_id,
        "items": [{"product_id": product_id, "quantity": 20, "expected_unit_price": 10.0}],
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
                "received_quantity": 20,
                "unit_cost": 10.0,
                "batch_number": "EXT-BATCH-1",
                "manufacturing_date": "2024-01-01",
                "expiry_date": "2028-12-31",
            }
        ],
    }
    gr_res = client.post("/api/v1/inventory/goods-receipts", json=gr_payload, headers=headers)
    assert gr_res.status_code == status.HTTP_201_CREATED

    transfer_payload = {
        "from_location_id": from_location_id,
        "to_location_id": to_location_id,
        "remarks": "Move some stock",
        "items": [{"product_id": product_id, "quantity": 5}],
    }
    transfer_res = client.post("/api/v1/inventory/transfers", json=transfer_payload, headers=headers)
    assert transfer_res.status_code == status.HTTP_201_CREATED
    transfer_id = transfer_res.json()["id"]

    approve_res = client.patch(f"/api/v1/inventory/transfers/{transfer_id}/approve", headers=headers)
    assert approve_res.status_code == status.HTTP_200_OK

    complete_res = client.patch(f"/api/v1/inventory/transfers/{transfer_id}/complete", headers=headers)
    assert complete_res.status_code == status.HTTP_200_OK
    assert complete_res.json()["status"] == "completed"

    adjustment_payload = {
        "reason": "Manual Increase",
        "remarks": "Top up stock",
        "items": [{"product_id": product_id, "quantity": 5, "unit_cost": 10.0}],
    }
    adj_res = client.post("/api/v1/inventory/adjustments", json=adjustment_payload, headers=headers)
    assert adj_res.status_code == status.HTTP_201_CREATED
    adjustment_id = adj_res.json()["id"]

    approve_adj_res = client.patch(f"/api/v1/inventory/adjustments/{adjustment_id}/approve", headers=headers)
    assert approve_adj_res.status_code == status.HTTP_200_OK
    assert approve_adj_res.json()["status"] == "approved"

    reservation_payload = {
        "product_id": product_id,
        "quantity": 3,
        "remarks": "Reserved for patient care",
    }
    reservation_res = client.post("/api/v1/inventory/reservations", json=reservation_payload, headers=headers)
    assert reservation_res.status_code == status.HTTP_201_CREATED
    reservation_id = reservation_res.json()["id"]

    release_res = client.patch(f"/api/v1/inventory/reservations/{reservation_id}/release", headers=headers)
    assert release_res.status_code == status.HTTP_200_OK
    assert release_res.json()["status"] == "released"

    dashboard_res = client.get("/api/v1/inventory/dashboard", headers=headers)
    assert dashboard_res.status_code == status.HTTP_200_OK
    assert "total_products" in dashboard_res.json()

    alerts_res = client.get("/api/v1/inventory/alerts", headers=headers)
    assert alerts_res.status_code == status.HTTP_200_OK

    reports_res = client.get("/api/v1/inventory/reports?report_type=inventory_stock", headers=headers)
    assert reports_res.status_code == status.HTTP_200_OK
    assert "data" in reports_res.json()
