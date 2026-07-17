import json
import base64
import urllib.request
import urllib.parse
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding

BASE = 'http://127.0.0.1:8000/api/v1'

try:
    resp = urllib.request.urlopen(f'{BASE}/auth/public-key')
    text = resp.read().decode('utf-8')
    print('public-key status', resp.status)
    print(text[:500])

    data = json.loads(text)
    pub = data['public_key'].encode('utf-8')
    key = serialization.load_pem_public_key(pub)
    encrypted = key.encrypt(b'adminpassword123', padding.PKCS1v15())
    b64 = base64.b64encode(encrypted).decode('utf-8')
    body = urllib.parse.urlencode({'username': 'admin@medicore.com', 'password': b64}).encode('utf-8')
    req = urllib.request.Request(f'{BASE}/auth/login', data=body, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    login_resp = urllib.request.urlopen(req)
    print('login status', login_resp.status)
    print(login_resp.read().decode('utf-8'))
except Exception as e:
    import traceback
    traceback.print_exc()