from fastapi import status
from fastapi.testclient import TestClient
from cryptography.hazmat.primitives.asymmetric import padding
from app.core.crypto import public_key
import base64


def encrypt_password(password: str) -> str:
    encrypted = public_key.encrypt(password.encode("utf-8"), padding.PKCS1v15())
    return base64.b64encode(encrypted).decode("utf-8")


def test_purchase_requisition_create_approve_and_convert(client: TestClient):
    register_payload = {
        "email": "requisition@example.com",
        "tenant_id": "default-hospital",
        "password": encrypt_password("StrongPass123!"),
        "full_name": "Requisition User",
        "is_superuser": True,
    }
    response = client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == status.HTTP_201_CREATED

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": "requisition@example.com", "password": encrypt_password("StrongPass123!")},
    )
    assert login_response.status_code == status.HTTP_200_OK
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    supplier_response = client.post(
        "/api/v1/inventory/suppliers",
        json={
            "name": "Test Supplier",
            "phone": "1234567890",
            "company_name": "Supplier Co",
            "email": "supplier@example.com",
            "address": "1 Test Street",
            "city": "Test City",
            "state": "TS",
            "country": "IN",
            "postal_code": "000000",
            "contact_person": "Supplier Contact",
            "status": "active",
            "remarks": "Primary test supplier",
        },
        headers=headers,
    )
    assert supplier_response.status_code == status.HTTP_201_CREATED
    supplier_id = supplier_response.json()["id"]

    category_response = client.post(
        "/api/v1/inventory/categories",
        json={"name": "Requisition Items", "description": "Test category", "status": "active"},
        headers=headers,
    )
    assert category_response.status_code == status.HTTP_201_CREATED

    manufacturer_response = client.post(
        "/api/v1/inventory/manufacturers",
        json={"name": "Test Manufacturer", "status": "active"},
        headers=headers,
    )
    assert manufacturer_response.status_code == status.HTTP_201_CREATED

    brand_response = client.post(
        "/api/v1/inventory/brands",
        json={"name": "Test Brand", "manufacturer_id": manufacturer_response.json()["id"], "status": "active"},
        headers=headers,
    )
    assert brand_response.status_code == status.HTTP_201_CREATED

    unit_response = client.post(
        "/api/v1/inventory/units",
        json={"name": "Box", "status": "active"},
        headers=headers,
    )
    assert unit_response.status_code == status.HTTP_201_CREATED

    location_response = client.post(
        "/api/v1/inventory/locations",
        json={"name": "Main Store", "status": "active"},
        headers=headers,
    )
    assert location_response.status_code == status.HTTP_201_CREATED

    product_response = client.post(
        "/api/v1/inventory/products",
        json={
            "product_code": "REQ-1001",
            "name": "Requisition Product",
            "generic_name": "Generic Requisition Product",
            "category_id": category_response.json()["id"],
            "brand_id": brand_response.json()["id"],
            "manufacturer_id": manufacturer_response.json()["id"],
            "unit_id": unit_response.json()["id"],
            "default_supplier_id": supplier_id,
            "storage_location_id": location_response.json()["id"],
            "minimum_stock": 5,
            "maximum_stock": 50,
            "reorder_level": 10,
            "gst_percent": 0,
            "description": "Test product",
            "status": "active",
        },
        headers=headers,
    )
    assert product_response.status_code == status.HTTP_201_CREATED

    requisition_response = client.post(
        "/api/v1/inventory/requisitions",
        json={
            "requested_date": "2025-01-15",
            "required_date": "2025-01-20",
            "department_id": 1,
            "supplier_id": supplier_id,
            "priority": "high",
            "remarks": "Need this urgently",
            "items": [
                {
                    "product_id": product_response.json()["id"],
                    "requested_quantity": 10,
                    "estimated_unit_price": 25.5,
                    "remarks": "First batch",
                }
            ],
        },
        headers=headers,
    )
    assert requisition_response.status_code == status.HTTP_201_CREATED
    requisition_data = requisition_response.json()
    assert requisition_data["status"] == "draft"
    assert requisition_data["items"][0]["product_id"] == product_response.json()["id"]

    approve_response = client.patch(
        f"/api/v1/inventory/requisitions/{requisition_data['id']}/approve",
        json={"remarks": "Approved for procurement"},
        headers=headers,
    )
    assert approve_response.status_code == status.HTTP_200_OK
    assert approve_response.json()["status"] == "approved"

    convert_response = client.post(
        f"/api/v1/inventory/requisitions/{requisition_data['id']}/convert",
        json={"supplier_id": supplier_id, "remarks": "Converted to purchase order"},
        headers=headers,
    )
    assert convert_response.status_code == status.HTTP_200_OK
    assert convert_response.json()["status"] == "converted"

    purchase_order_response = client.get(
        f"/api/v1/inventory/purchase-orders/{convert_response.json()['converted_po_id']}",
        headers=headers,
    )
    assert purchase_order_response.status_code == status.HTTP_200_OK
    assert purchase_order_response.json()["requisition_id"] == requisition_data["id"]
