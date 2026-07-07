import os
import base64
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization

# Define keys persistence paths in the workspace root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRIVATE_KEY_PATH = os.path.join(BASE_DIR, "private_key.pem")
PUBLIC_KEY_PATH = os.path.join(BASE_DIR, "public_key.pem")

# Load existing keys from disk or generate new ones if they don't exist
if os.path.exists(PRIVATE_KEY_PATH) and os.path.exists(PUBLIC_KEY_PATH):
    with open(PRIVATE_KEY_PATH, "rb") as key_file:
        private_key = serialization.load_pem_private_key(
            key_file.read(),
            password=None,
        )
    public_key = private_key.public_key()
else:
    # Generate new RSA key pair
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    
    # Save private key PEM
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    with open(PRIVATE_KEY_PATH, "wb") as f:
        f.write(private_pem)
        
    # Save public key PEM
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    with open(PUBLIC_KEY_PATH, "wb") as f:
        f.write(public_pem)

def get_public_key_pem() -> str:
    """
    Export the public key in PEM format to send to the frontend.
    """
    with open(PUBLIC_KEY_PATH, "rb") as f:
        return f.read().decode("utf-8")

def decrypt_password(encrypted_password_b64: str) -> str:
    """
    Decrypts a base64 encoded RSA-encrypted password.
    Matches the default PKCS#1 v1.5 padding of standard frontend libraries like jsencrypt.
    """
    try:
        encrypted_bytes = base64.b64decode(encrypted_password_b64)
        decrypted = private_key.decrypt(
            encrypted_bytes,
            padding.PKCS1v15()
        )
        return decrypted.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}")
