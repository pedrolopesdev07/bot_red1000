import base64
import hashlib
import hmac
import struct
from types import SimpleNamespace

from app.api.v1.billing import _cakto_product
from app.core.totp import verify_totp


def _code(secret: str, now: int) -> str:
    key = base64.b32decode(secret)
    digest = hmac.new(key, struct.pack(">Q", now // 30), hashlib.sha1).digest()
    offset = digest[-1] & 15
    value = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def test_totp_accepts_current_code_and_rejects_wrong_code() -> None:
    secret = "JBSWY3DPEHPK3PXP"
    now = 1_700_000_000
    assert verify_totp(secret, _code(secret, now), now=now)
    assert not verify_totp(secret, "000000", now=now)


def test_cakto_product_mapping_is_allowlist_only() -> None:
    settings = SimpleNamespace(
        cakto_premium_product_ids="premium-id",
        cakto_ultra_premium_product_ids="ultra-id",
        cakto_credits_150_product_ids="credits-150",
        cakto_credits_270_product_ids="",
        cakto_credits_750_product_ids="",
        cakto_credits_1050_product_ids="",
        cakto_product_ids=lambda value: {item for item in value.split(",") if item},
    )
    assert _cakto_product(settings, {"product": {"id": "premium-id"}}) == ("premium", 0)
    assert _cakto_product(settings, {"product": {"short_id": "credits-150"}}) == ("credits:150", 150)
    assert _cakto_product(settings, {"product": {"id": "unknown"}}) is None
