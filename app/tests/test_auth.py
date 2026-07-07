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

def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "healthy"

def test_get_public_key(client: TestClient):
    response = client.get("/api/v1/auth/public-key")
    assert response.status_code == status.HTTP_200_OK
    assert "public_key" in response.json()
    assert "-----BEGIN PUBLIC KEY-----" in response.json()["public_key"]

def test_register_user(client: TestClient):
    user_data = {
        "email": "test@example.com",
        "tenant_id": "default-hospital",
        "password": encrypt_password("secretpassword"),
        "full_name": "Test User",
    }
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "password" not in data

def test_register_duplicate_user(client: TestClient):
    user_data = {
        "email": "duplicate@example.com",
        "tenant_id": "default-hospital",
        "password": encrypt_password("secretpassword"),
        "full_name": "Duplicate User",
    }
    # Register once
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == status.HTTP_201_CREATED
    
    # Register again
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == status.HTTP_400_BAD_REQUEST

def test_login_user(client: TestClient):
    # 1. Register a user
    user_data = {
        "email": "login@example.com",
        "tenant_id": "default-hospital",
        "password": encrypt_password("loginpassword"),
        "full_name": "Login User",
    }
    client.post("/api/v1/auth/register", json=user_data)

    # 2. Login to get token
    login_data = {
        "username": "login@example.com",
        "password": encrypt_password("loginpassword"),
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == status.HTTP_200_OK
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

def test_get_current_user_profile(client: TestClient):
    # 1. Register
    user_data = {
        "email": "profile@example.com",
        "tenant_id": "default-hospital",
        "password": encrypt_password("profilepassword"),
        "full_name": "Profile User",
    }
    client.post("/api/v1/auth/register", json=user_data)

    # 2. Try fetching profile without token
    response = client.get("/api/v1/users/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # 3. Login
    login_data = {
        "username": "profile@example.com",
        "password": encrypt_password("profilepassword"),
    }
    login_response = client.post("/api/v1/auth/login", data=login_data)
    token = login_response.json()["access_token"]

    # 4. Fetch profile with token
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    profile_data = response.json()
    assert profile_data["email"] == "profile@example.com"
    assert profile_data["full_name"] == "Profile User"
