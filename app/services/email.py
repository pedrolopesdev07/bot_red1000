import httpx

from app.core.config import get_settings


async def send_magic_link(email: str, link: str) -> bool:
    settings = get_settings()
    if not settings.resend_api_key:
        return False
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [email],
                "subject": "Seu acesso ao Reda1000IA",
                "text": f"Acesse sua conta por este link (válido por poucos minutos): {link}",
            },
        )
        response.raise_for_status()
    return True


async def send_daily_limit_reminder(email: str) -> bool:
    settings = get_settings()
    if not settings.resend_api_key:
        return False
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [email],
                "subject": "Suas correções diárias estão disponíveis",
                "text": f"Seu limite diário foi renovado. Acesse {settings.frontend_url}/redacoes/nova",
            },
        )
        response.raise_for_status()
    return True
