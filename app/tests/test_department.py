from fastapi.testclient import TestClient
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

def test_list_departments(client: TestClient, db):
    # 0. Seed basic setup
    from app.models.role import Role
    from app.models.department import Department
    from app.crud.user import create_user
    from app.schemas.user import UserCreate
    
    async def seed_test_data():
        role = Role(id=1, tenant_id="default-hospital", name="Super Admin", description="System Admin")
        db.add(role)
        
        dept1 = Department(tenant_id="default-hospital", name="Cardiology", code="CARD", is_active=True)
        dept2 = Department(tenant_id="default-hospital", name="Neurology", code="NEUR", is_active=True)
        db.add(dept1)
        db.add(dept2)
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
    run_async(seed_test_data())

    # 1. Login
    login_payload = {
        "username": "admin@medicore.com",
        "password": encrypt_password("adminpassword123")
    }
    login_res = client.post("/api/v1/auth/login", data=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. List departments
    res = client.get("/api/v1/departments", headers=headers)
    assert res.status_code == status.HTTP_200_OK
    depts = res.json()
    assert len(depts) >= 2
    codes = [d["code"] for d in depts]
    assert "CARD" in codes
    assert "NEUR" in codes


def test_update_profile_department(client: TestClient, db):
    from app.models.role import Role
    from app.models.department import Department
    from app.crud.user import create_user
    from app.schemas.user import UserCreate
    
    async def seed_test_data():
        role = Role(id=4, tenant_id="default-hospital-2", name="Doctor", description="Clinician")
        db.add(role)
        
        dept1 = Department(tenant_id="default-hospital-2", name="Cardiology", code="CARD2", is_active=True)
        dept2 = Department(tenant_id="default-hospital-2", name="Neurology", code="NEUR2", is_active=True)
        db.add(dept1)
        db.add(dept2)
        await db.commit()

        doctor_in = UserCreate(
            email="doctor2@medicore.com",
            tenant_id="default-hospital-2",
            role_id=4,
            password="doctorpassword123",
            full_name="Doctor Strange",
            is_superuser=False,
            is_active=True
        )
        await create_user(db, user_in=doctor_in)

    from app.tests.conftest import run_async
    run_async(seed_test_data())

    # 1. Login
    login_payload = {
        "username": "doctor2@medicore.com",
        "password": encrypt_password("doctorpassword123")
    }
    login_res = client.post("/api/v1/auth/login", data=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get active departments to find their IDs
    dept_res = client.get("/api/v1/departments", headers=headers)
    assert dept_res.status_code == status.HTTP_200_OK
    depts = dept_res.json()
    card_dept = [d for d in depts if d["code"] == "CARD2"][0]

    # 3. Update department
    update_payload = {
        "department_id": card_dept["id"]
    }
    update_res = client.put("/api/v1/users/me", json=update_payload, headers=headers)
    assert update_res.status_code == status.HTTP_200_OK
    assert update_res.json()["department_id"] == card_dept["id"]

