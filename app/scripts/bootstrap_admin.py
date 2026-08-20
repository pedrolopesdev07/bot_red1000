import asyncio
import os

from sqlalchemy import select

from app.core.passwords import hash_password
from app.database.database import SessionFactory
from app.database.models import Plan, User, UserRole


async def main() -> None:
    username = os.environ.get("ADMIN_USERNAME", "").strip().casefold()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not username or len(password) < 14:
        raise RuntimeError("ADMIN_USERNAME e ADMIN_PASSWORD (mínimo de 14 caracteres) são obrigatórios")
    if not os.environ.get("ADMIN_TOTP_SECRET", "").strip():
        raise RuntimeError("ADMIN_TOTP_SECRET é obrigatório para o administrador")

    async with SessionFactory.begin() as db:
        plan = await db.scalar(select(Plan).where(Plan.name == "ULTRA_PREMIUM"))
        if not plan:
            raise RuntimeError("Plano ULTRA_PREMIUM não encontrado; execute as migrations primeiro")
        user = await db.scalar(select(User).where(User.username == username))
        if not user:
            user = User(username=username, plan_id=plan.id, plan=plan)
            db.add(user)
        user.password_hash = hash_password(password)
        user.role = UserRole.ADMIN
        user.mfa_enabled = True
        user.is_active = True
        await db.flush()
        print(f"Administrador '{username}' configurado com id {user.id}")


if __name__ == "__main__":
    asyncio.run(main())
