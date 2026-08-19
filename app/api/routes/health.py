from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import text

from app.core.redis import get_redis
from app.database.database import SessionFactory

router = APIRouter()


@router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready", tags=["health"])
async def readiness() -> dict[str, str]:
    """Only reports ready after both durable storage and the job queue respond."""
    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
        await get_redis().ping()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Dependency unavailable") from exc
    return {"status": "ready", "database": "ok", "redis": "ok"}


@router.get("/metrics", tags=["health"], include_in_schema=False)
async def metrics() -> Response:
    async with SessionFactory() as session:
        users = (await session.execute(text("SELECT count(*) FROM users"))).scalar_one()
        queued = (await session.execute(text("SELECT count(*) FROM analyses WHERE status = 'QUEUED'"))).scalar_one()
        failed = (await session.execute(text("SELECT count(*) FROM analyses WHERE status = 'FAILED'"))).scalar_one()
    body = "\n".join((f"reda1000_users {users}", f"reda1000_analyses_queued {queued}", f"reda1000_analyses_failed {failed}")) + "\n"
    return Response(body, media_type="text/plain; version=0.0.4")
