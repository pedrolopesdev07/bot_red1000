import base64
import hashlib
import hmac
import struct
import time


def verify_totp(secret: str, code: str, *, now: int | None = None, window: int = 1) -> bool:
    """Validate a six-digit RFC 6238 code with a small clock-skew window."""
    normalized_secret = "".join(secret.split()).upper()
    normalized_code = code.strip()
    if not normalized_secret or len(normalized_code) != 6 or not normalized_code.isdigit():
        return False
    try:
        key = base64.b32decode(normalized_secret, casefold=True)
    except (ValueError, TypeError):
        return False
    counter = (int(time.time()) if now is None else now) // 30
    for offset in range(-window, window + 1):
        digest = hmac.new(key, struct.pack(">Q", counter + offset), hashlib.sha1).digest()
        start = digest[-1] & 0x0F
        value = (struct.unpack(">I", digest[start:start + 4])[0] & 0x7FFFFFFF) % 1_000_000
        if hmac.compare_digest(f"{value:06d}", normalized_code):
            return True
    return False
