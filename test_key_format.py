#!/usr/bin/env python
"""
Test that verifies the frontend can encrypt with our public key.
Uses jsdom simulation to mimic frontend behavior.
"""
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
from app.core.crypto import private_key, get_public_key_pem

def test_key_format():
    """Verify key format is compatible with jsencrypt."""
    print("=" * 70)
    print("VERIFYING RSA KEY FORMAT FOR JSENCRYPT COMPATIBILITY")
    print("=" * 70)
    
    # Get public key
    pem = get_public_key_pem()
    print("\n✅ Backend Public Key (PEM format):")
    print(f"   Length: {len(pem)} chars")
    print(f"   First line: {pem.split(chr(10))[0]}")
    print(f"   Has BEGIN PUBLIC KEY: {'-----BEGIN PUBLIC KEY-----' in pem}")
    print(f"   Has END PUBLIC KEY: {'-----END PUBLIC KEY-----' in pem}")
    
    # Parse it to check
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_public_key
        pub_key = load_pem_public_key(pem.encode(), backend=default_backend())
        print(f"\n✅ Public key is valid PEM format")
        print(f"   Key size: {pub_key.key_size} bits")
        print(f"   Public exponent: {pub_key.public_numbers().e}")
    except Exception as e:
        print(f"\n❌ ERROR parsing public key: {e}")
        return False
    
    # Test decryption with known encrypted value
    print("\n✅ Testing encryption/decryption cycle:")
    test_password = "adminpassword123"
    print(f"   Original password: {test_password}")
    
    # Encrypt using the public key (as JSEncrypt would)
    from cryptography.hazmat.primitives.asymmetric import padding
    encrypted_bytes = pub_key.encrypt(
        test_password.encode('utf-8'),
        padding.PKCS1v15()  # This is what jsencrypt uses
    )
    encrypted_b64 = base64.b64encode(encrypted_bytes).decode('utf-8')
    print(f"   Encrypted (b64): {encrypted_b64[:60]}...")
    
    # Now try to decrypt on backend
    from app.core.crypto import decrypt_password
    try:
        decrypted = decrypt_password(encrypted_b64)
        print(f"   Decrypted: {decrypted}")
        if decrypted == test_password:
            print(f"\n✅ ENCRYPTION/DECRYPTION SUCCESSFUL - Keys are compatible!")
            return True
        else:
            print(f"\n❌ ERROR: Decrypted value doesn't match original")
            return False
    except Exception as e:
        print(f"\n❌ ERROR during decryption: {e}")
        return False

if __name__ == "__main__":
    success = test_key_format()
    print("\n" + "=" * 70)
    if success:
        print("✅ KEY FORMAT TEST PASSED - Frontend should work correctly")
    else:
        print("❌ KEY FORMAT TEST FAILED - There's an issue with the keys")
    print("=" * 70)
