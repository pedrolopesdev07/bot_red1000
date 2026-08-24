import base64
import hashlib
import hmac
import struct
from pathlib import Path
from app.core.totp import verify_totp
from app.services.plans import get_plan_policy


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


def test_simulation_plan_limits() -> None:
    assert get_plan_policy("FREE").daily_analyses == 10
    assert get_plan_policy("PREMIUM").daily_analyses == 25
    assert get_plan_policy("ULTRA_PREMIUM").unlimited


def test_render_container_starts_analysis_worker() -> None:
    dockerfile = (Path(__file__).resolve().parents[1] / "Dockerfile").read_text(encoding="utf-8")
    assert "arq app.workers.analysis.WorkerSettings" in dockerfile
