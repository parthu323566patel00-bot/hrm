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

def test_patient_management_flow(client: TestClient, db):
    # 0. Seed Tenant, Role, Permissions, and User
    from app.models.role import Role
    from app.models.permission import Permission
    from app.models.role_permission import RolePermission
    from app.crud.user import create_user
    from app.schemas.user import UserCreate
    
    async def seed_test_rbac():
        # Register permissions
        perms = [
            ("patient:create", "Create patients", "patient"),
            ("patient:view", "View patients", "patient"),
            ("patient:update", "Update patients", "patient"),
            ("patient:search", "Search patients", "patient"),
            ("patient:archive", "Archive patients", "patient")
        ]
        perms_mapped = {}
        for code, desc, mod in perms:
            p = Permission(code=code, description=desc, module=mod)
            db.add(p)
            await db.commit()
            await db.refresh(p)
            perms_mapped[code] = p
            
        # Role 3 (Receptionist)
        role = Role(id=3, tenant_id="default-hospital", name="Nurse", description="Nursing Staff")
        db.add(role)
        await db.commit()
        await db.refresh(role)
        
        # Bind permissions to Role 3 (Nurse)
        for p in perms_mapped.values():
            rp = RolePermission(tenant_id="default-hospital", role_id=3, permission_id=p.id, role_name="Nurse")
            db.add(rp)
        await db.commit()

        # Seed nurse user
        user_in = UserCreate(
            email="nurse@medicore.com",
            tenant_id="default-hospital",
            role_id=3,
            password="nursepass",
            full_name="Alice Smith",
            is_superuser=False,
            is_active=True
        )
        await create_user(db, user_in=user_in)

    from app.tests.conftest import run_async
    run_async(seed_test_rbac())

    # 1. Login as receptionist
    login_payload = {
        "username": "receptionist@medicore.com",
        "password": encrypt_password("receptionistpass")
    }
    login_res = client.post("/api/v1/auth/login", data=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Register Patient
    patient_data = {
        "name": "John Doe",
        "age": 36,
        "gender": "Male",
        "phone": "+1234567890",
        "email": "johndoe@example.com",
        "address": "123 Health Ave, Clinic City",
        "blood_group": "O+"
    }
    create_res = client.post("/api/v1/patients/", json=patient_data, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    p_id = create_res.json()["id"]
    assert create_res.json()["name"] == "John Doe"

    # 3. Retrieve Patient details
    get_res = client.get(f"/api/v1/patients/{p_id}", headers=headers)
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["email"] == "johndoe@example.com"

    # 4. Search patient
    search_res = client.get("/api/v1/patients/?q=Doe", headers=headers)
    assert search_res.status_code == status.HTTP_200_OK
    search_data = search_res.json()["data"]
    assert len(search_data) >= 1
    assert search_data[0]["id"] == p_id

    # 5. Update patient info
    update_payload = {
        "phone": "+1112223333",
        "address": "456 Wellness Blvd"
    }
    update_res = client.put(f"/api/v1/patients/{p_id}", json=update_payload, headers=headers)
    assert update_res.status_code == status.HTTP_200_OK
    assert update_res.json()["phone"] == "+1112223333"

    # 6. Archive patient
    archive_res = client.post(f"/api/v1/patients/{p_id}/archive", headers=headers)
    assert archive_res.status_code == status.HTTP_200_OK
    assert archive_res.json()["is_archived"] is True

    # 7. Listing default exclusion of archived
    list_active_res = client.get("/api/v1/patients/", headers=headers)
    assert list_active_res.status_code == status.HTTP_200_OK
    assert len(list_active_res.json()["data"]) == 0

    # 8. Listing with archived option
    list_all_res = client.get("/api/v1/patients/?include_archived=true", headers=headers)
    assert list_all_res.status_code == status.HTTP_200_OK
    assert len(list_all_res.json()["data"]) >= 1
