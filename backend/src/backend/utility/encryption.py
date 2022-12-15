# pycrypto imports
import sys
from Crypto import Random
from Crypto.Cipher import AES
import base64, sys
from hashlib import md5

# just to import secrets
sys.path.append("/code")
import secret_variables

# encrypt and decrypt password encrypted in Angular using Crypto-JS
ENCRYPTION_PASSPHRASE = getattr(secret_variables, 'COMETA_ENCRYPTION_PASSPHRASE', '').encode()
ENCRYPTION_START = getattr(secret_variables, 'COMETA_ENCRYPTION_START', '')
BLOCK_SIZE = 16

def pad(data):
    length = BLOCK_SIZE - (len(data) % BLOCK_SIZE)
    return data.encode() + (chr(length)*length).encode()

def unpad(data):
    return data[:-(data[-1] if type(data[-1]) == int else ord(data[-1]))]

def bytes_to_key(data, salt, output=48):
    # extended from https://gist.github.com/gsakkis/4546068
    assert len(salt) == 8, len(salt)
    data += salt
    key = md5(data).digest()
    final_key = key
    while len(final_key) < output:
        key = md5(key + data).digest()
        final_key += key
    return final_key[:output]

def encrypt(message):
    salt = Random.new().read(8)
    key_iv = bytes_to_key(ENCRYPTION_PASSPHRASE, salt, 32+16)
    key = key_iv[:32]
    iv = key_iv[32:]
    aes = AES.new(key, AES.MODE_CBC, iv)
    return base64.b64encode(b"Salted__" + salt + aes.encrypt(pad(message))).decode("utf-8")

def decrypt(encrypted):
    encrypted = base64.b64decode(encrypted)
    assert encrypted[0:8] == b"Salted__"
    salt = encrypted[8:16]
    key_iv = bytes_to_key(ENCRYPTION_PASSPHRASE, salt, 32+16)
    key = key_iv[:32]
    iv = key_iv[32:]
    aes = AES.new(key, AES.MODE_CBC, iv)
    return unpad(aes.decrypt(encrypted[16:])).decode("utf-8")
