#!/usr/bin/env python
"""
Test script to verify RSA key setup and encryption/decryption pipeline.
"""
import asyncio
import base64
from app.core.crypto import get_public_key_pem, decrypt_password
from app.core.crypto import private_key
from cryptography.hazmat.primitives.asymmetric import padding

def test_keys():
    """Verify keys exist and are properly formatted."""
    print("=" * 60)
    print("TESTING RSA KEY SETUP")
    print("=" * 60)
    
    try:
        public_pem = get_public_key_pem()
        print("✅ Public key loaded successfully")
        print(f"   First 100 chars: {public_pem[:100]}")
        
        if not public_pem.startswith("-----BEGIN PUBLIC KEY-----"):
            print("❌ ERROR: Public key doesn't have proper PEM format")
            return False
            
        print("✅ Public key has proper PEM format")
    except Exception as e:
        print(f"❌ ERROR loading public key: {e}")
        return False
    
    try:
        # Test encryption/decryption cycle with Python
        test_password = "testpassword123"
        print(f"\n✅ Testing encryption/decryption with password: {test_password}")
        
        # Encrypt using private key (simulate frontend encryption)
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        public_key = private_key.public_key()
        
        encrypted = public_key.encrypt(
            test_password.encode('utf-8'),
            padding.PKCS1v15()
        )
        encrypted_b64 = base64.b64encode(encrypted).decode('utf-8')
        print(f"   Encrypted (b64): {encrypted_b64[:50]}...")
        
        # Decrypt on backend
        decrypted = decrypt_password(encrypted_b64)
        print(f"   Decrypted: {decrypted}")
        
        if decrypted == test_password:
            print("✅ Encryption/Decryption cycle SUCCESSFUL")
            return True
        else:
            print(f"❌ ERROR: Decrypted password doesn't match. Got: {decrypted}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR during encryption/decryption test: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_with_db():
    """Test actual login with test user."""
    print("\n" + "=" * 60)
    print("TESTING LOGIN FLOW")
    print("=" * 60)
    
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.core.database import DATABASE_URL
    from app.models.user import User
    from sqlalchemy import select
    
    try:
        engine = create_async_engine(DATABASE_URL, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as db:
            # Find admin user
            result = await db.execute(select(User).filter(User.email == "admin@medicore.com"))
            admin = result.scalars().first()
            
            if not admin:
                print("❌ ERROR: admin@medicore.com not found in database")
                return False
            
            print(f"✅ Found user: {admin.email}")
            print(f"   Is Active: {admin.is_active}")
            print(f"   Has hashed password: {'Yes' if admin.hashed_password else 'No'}")
            
            # Test encryption of admin's actual password
            from app.core import security
            plaintext_password = "adminpassword123"
            
            # Verify the hashed password matches
            if security.verify_password(plaintext_password, admin.hashed_password):
                print(f"✅ Password hash verification SUCCESSFUL")
            else:
                print(f"❌ ERROR: Password hash verification FAILED")
                return False
            
            # Now test the full encryption cycle
            encrypted_b64 = base64.b64encode(
                private_key.public_key().encrypt(
                    plaintext_password.encode('utf-8'),
                    padding.PKCS1v15()
                )
            ).decode('utf-8')
            
            decrypted = decrypt_password(encrypted_b64)
            print(f"✅ Password decryption cycle successful: {decrypted}")
            
            if decrypted == plaintext_password:
                print("✅ Full crypto pipeline WORKING")
                return True
            else:
                print(f"❌ ERROR: Decrypted password doesn't match")
                return False
                
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_keys()
    if success:
        success = asyncio.run(test_with_db())
    
    print("\n" + "=" * 60)
    if success:
        print("✅ ALL TESTS PASSED - Crypto pipeline is working!")
    else:
        print("❌ TESTS FAILED - See errors above")
    print("=" * 60)
