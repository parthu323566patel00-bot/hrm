#!/usr/bin/env python
"""
Test what error we get when sending plaintext password instead of encrypted.
"""
from fastapi.testclient import TestClient
from app.main import app

def test_plaintext_password():
    """Test what happens with plaintext password."""
    client = TestClient(app)
    
    print("=" * 70)
    print("TESTING PLAINTEXT PASSWORD SUBMISSION")
    print("=" * 70)
    
    # Send plaintext password (simulating frontend not encrypting)
    print("\nSubmitting plaintext password instead of encrypted...")
    login_payload = {
        "username": "admin@medicore.com",
        "password": "adminpassword123"  # PLAINTEXT, not encrypted!
    }
    
    login_res = client.post(
        "/api/v1/auth/login",
        data=login_payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    print(f"Status: {login_res.status_code}")
    print(f"Response:")
    print(f"  {login_res.text}")
    
    return login_res.status_code

if __name__ == "__main__":
    status = test_plaintext_password()
    print("\n" + "=" * 70)
    if status == 400:
        print("✅ CONFIRMED: Plaintext password causes 400 error")
        print("   → Frontend is likely NOT encrypting the password!")
        print("   → Issue: JSEncrypt not working or not being called")
    else:
        print(f"❌ Unexpected status: {status}")
    print("=" * 70)
