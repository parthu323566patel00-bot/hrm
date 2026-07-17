#!/usr/bin/env python
"""
Direct login endpoint test to diagnose 400 errors.
"""
import sys
from fastapi.testclient import TestClient
from app.main import app
from app.core.crypto import private_key
from cryptography.hazmat.primitives.asymmetric import padding
import base64

def encrypt_password(password: str) -> str:
    """Encrypt password using RSA public key."""
    encrypted = private_key.public_key().encrypt(
        password.encode('utf-8'),
        padding.PKCS1v15()
    )
    return base64.b64encode(encrypted).decode('utf-8')

def test_login():
    """Test login with the credentials we set in recover_database.py"""
    client = TestClient(app)
    
    print("=" * 60)
    print("TESTING LOGIN ENDPOINT")
    print("=" * 60)
    
    # Test 1: Get public key
    print("\n✅ Step 1: Fetching RSA public key from /auth/public-key...")
    pk_res = client.get("/api/v1/auth/public-key")
    print(f"   Status: {pk_res.status_code}")
    if pk_res.status_code != 200:
        print(f"   ❌ ERROR: {pk_res.text}")
        return False
    pk_data = pk_res.json()
    print(f"   Public key length: {len(pk_data['public_key'])}")
    
    # Test 2: Login with admin credentials
    print("\n✅ Step 2: Attempting login with admin@medicore.com...")
    email = "admin@medicore.com"
    password = "adminpassword123"
    encrypted_pwd = encrypt_password(password)
    
    print(f"   Email: {email}")
    print(f"   Original password: {password}")
    print(f"   Encrypted (b64, first 50 chars): {encrypted_pwd[:50]}...")
    
    login_payload = {"username": email, "password": encrypted_pwd}
    login_res = client.post(
        "/api/v1/auth/login",
        data=login_payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    print(f"   Status: {login_res.status_code}")
    print(f"   Response: {login_res.text[:200]}")
    
    if login_res.status_code == 200:
        token_data = login_res.json()
        print(f"   ✅ SUCCESS! Token obtained: {token_data.get('access_token', '')[:50]}...")
        return True
    else:
        print(f"   ❌ ERROR: {login_res.status_code}")
        try:
            error_data = login_res.json()
            print(f"   Error detail: {error_data.get('detail', 'No detail')}")
        except:
            print(f"   Raw response: {login_res.text}")
        return False

if __name__ == "__main__":
    try:
        success = test_login()
        print("\n" + "=" * 60)
        if success:
            print("✅ LOGIN TEST PASSED")
        else:
            print("❌ LOGIN TEST FAILED")
        print("=" * 60)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
