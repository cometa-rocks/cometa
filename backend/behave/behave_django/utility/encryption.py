# pycrypto imports
import sys
from Crypto import Random
from Crypto.Cipher import AES
import base64, sys
from hashlib import md5
import tempfile
import subprocess


# encrypt and decrypt password encrypted in Angular using Crypto-JS
# This variable is updated by backend.utility.configurations.py, when configuration is loaded from DB
ENCRYPTION_PASSPHRASE = None
# This variable is updated by backend.utility.configurations.py, when configuration is loaded from DB
ENCRYPTION_START = None
COMETA_UPLOAD_ENCRYPTION_PASSPHRASE = None
BLOCK_SIZE = 16
logger = None

def update_ENCRYPTION_PASSPHRASE(encryption_passphrase: str):
    global ENCRYPTION_PASSPHRASE
    ENCRYPTION_PASSPHRASE = encryption_passphrase

def update_COMETA_UPLOAD_ENCRYPTION_PASSPHRASE(file_upload_encryption_passphrase: str):
    global COMETA_UPLOAD_ENCRYPTION_PASSPHRASE
    COMETA_UPLOAD_ENCRYPTION_PASSPHRASE = file_upload_encryption_passphrase


def update_ENCRYPTION_START(encryption_start: str):
    global ENCRYPTION_START
    ENCRYPTION_START = encryption_start

def set_logger(logger_object):
    global logger
    logger = logger_object
    logger.debug("Logger object updated")

def print_values():
    print(f"ENCRYPTION_PASSPHRASE = {ENCRYPTION_PASSPHRASE}")
    print(f"ENCRYPTION_START = {ENCRYPTION_START}")


def pad(data):
    length = BLOCK_SIZE - (len(data) % BLOCK_SIZE)
    return data.encode() + (chr(length) * length).encode()


def unpad(data):
    return data[: -(data[-1] if type(data[-1]) == int else ord(data[-1]))]


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


def encrypt(message, passphrase=None):
    salt = Random.new().read(8)
    key_iv = bytes_to_key(
        passphrase if passphrase else ENCRYPTION_PASSPHRASE, salt, 32 + 16
    )
    key = key_iv[:32]
    iv = key_iv[32:]
    aes = AES.new(key, AES.MODE_CBC, iv)
    return base64.b64encode(b"Salted__" + salt + aes.encrypt(pad(message))).decode(
        "utf-8"
    )


def decrypt(encrypted, passphrase=None):
    encrypted = base64.b64decode(encrypted)
    assert encrypted[0:8] == b"Salted__"
    salt = encrypted[8:16]
    key_iv = bytes_to_key(
        passphrase if passphrase else ENCRYPTION_PASSPHRASE, salt, 32 + 16
    )
    key = key_iv[:32]
    iv = key_iv[32:]
    aes = AES.new(key, AES.MODE_CBC, iv)
    return unpad(aes.decrypt(encrypted[16:])).decode("utf-8")



# def decryptFile(source):
#     target = "/tmp/%s" % next(tempfile._get_candidate_names())

#     logger.debug(f"Decrypting source {source}")

#     try:
#         result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} -d {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
#         if result.returncode > 0:
#             # get the error
#             errOutput = result.stderr.decode('utf-8')
#             logger.error(errOutput)
#             raise Exception('Failed to decrypt the file, please contact an administrator.')
#         return target
#     except Exception as err:
#         raise Exception(str(err))
