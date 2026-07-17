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

def test_user_invitation_flow(client: TestClient, db):
    # 0. Seed Roles and Admin User directly in the test in-memory database
    from app.models.role import Role
    from app.models.permission import Permission
    from app.models.role_permission import RolePermission
    from app.crud.user import create_user
    from app.schemas.user import UserCreate
    
    async def seed_test_rbac():
        # Seed permissions
        perm = Permission(code="user:create", description="Invite users", module="user")
        db.add(perm)
        await db.commit()
        await db.refresh(perm)
        
        # Seed role (Super Admin)
        role = Role(id=1, tenant_id="default-hospital", name="Super Admin", description="System Admin")
        db.add(role)
        await db.commit()
        await db.refresh(role)
        
        # Bind role permission
        rp = RolePermission(tenant_id="default-hospital", role_id=1, permission_id=perm.id, role_name="Super Admin")
        db.add(rp)
        await db.commit()
        
        # Seed Doctor role (ID=4)
        doc_role = Role(id=4, tenant_id="default-hospital", name="Doctor", description="Doctor role")
        db.add(doc_role)
        await db.commit()

        # Seed admin user
        admin_in = UserCreate(
            email="admin@medicore.com",
            tenant_id="default-hospital",
            role_id=1,
            password="adminpassword123",
            full_name="System Administrator",
            is_superuser=True,
            is_active=True
        )
        await create_user(db, user_in=admin_in)
        
    from app.tests.conftest import run_async
    run_async(seed_test_rbac())

    # 1. Login as default system administrator to get admin token
    login_data = {
        "username": "admin@medicore.com",
        "password": encrypt_password("adminpassword123"),
    }
    login_res = client.post("/api/v1/auth/login", data=login_data)
    assert login_res.status_code == status.HTTP_200_OK
    admin_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Invite a new staff doctor
    invite_payload = {
        "email": "invited_doctor@example.com",
        "role_id": 4  # Doctor
    }
    invite_res = client.post("/api/v1/users/invite", json=invite_payload, headers=headers)
    assert invite_res.status_code == status.HTTP_200_OK
    invite_data = invite_res.json()
    assert invite_data["email"] == "invited_doctor@example.com"
    assert invite_data["role_name"] == "Doctor"
    assert "invite_link" in invite_data
    
    # Extract token from invite_link (e.g. http://localhost:5173/?token=<token>)
    token = invite_data["invite_link"].split("?token=")[-1]

    # 3. Validate the invitation token (guest action)
    val_res = client.get(f"/api/v1/auth/invite/validate?token={token}")
    assert val_res.status_code == status.HTTP_200_OK
    val_data = val_res.json()
    assert val_data["email"] == "invited_doctor@example.com"
    assert val_data["role_name"] == "Doctor"
    assert val_data["tenant_id"] == "default-hospital"

    # 4. Register the user using the token
    reg_payload = {
        "token": token,
        "password": encrypt_password("doctorpassword123")
    }
    reg_res = client.post("/api/v1/auth/invite/register", json=reg_payload)
    assert reg_res.status_code == status.HTTP_201_CREATED
    reg_data = reg_res.json()
    assert reg_data["email"] == "invited_doctor@example.com"
    assert reg_data["tenant_id"] == "default-hospital"
    assert reg_data["role_id"] == 2

    # 5. Verify the token is now marked as used
    val_res_retry = client.get(f"/api/v1/auth/invite/validate?token={token}")
    assert val_res_retry.status_code == status.HTTP_400_BAD_REQUEST

    # 6. Verify the new user can successfully login
    doc_login_payload = {
        "username": "invited_doctor@example.com",
        "password": encrypt_password("doctorpassword123")
    }
    doc_login_res = client.post("/api/v1/auth/login", data=doc_login_payload)
    assert doc_login_res.status_code == status.HTTP_200_OK
    doc_token = doc_login_res.json()["access_token"]

    # 7. Fetch profile of the logged-in doctor
    doc_profile_res = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {doc_token}"})
    assert doc_profile_res.status_code == status.HTTP_200_OK
    doc_profile = doc_profile_res.json()
    assert doc_profile["email"] == "invited_doctor@example.com"
    assert doc_profile["role_id"] == 2
    assert doc_profile["tenant_id"] == "default-hospital"
