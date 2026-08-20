import asyncio
import hmac
import logging
import uuid

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api.v1.schemas import CheckoutRequest, CheckoutResponse, MessageResponse
from app.core.config import get_settings
from app.core.web_security import get_current_user, rate_limit, require_csrf
from app.database.database import SessionFactory
from app.database.models import BillingEvent, CreditTransaction, Payment, PaymentStatus, Plan, User

router = APIRouter(tags=["billing"])


def _cakto_product(settings, data: dict) -> tuple[str, int] | None:
    product = data.get("product") or {}
    identifiers = {str(product.get(key) or "") for key in ("id", "short_id", "shortId")}
    mappings = (
        ("premium", 0, settings.cakto_premium_product_ids),
        ("ultra_premium", 0, settings.cakto_ultra_premium_product_ids),
        ("credits:150", 150, settings.cakto_credits_150_product_ids),
        ("credits:270", 270, settings.cakto_credits_270_product_ids),
        ("credits:750", 750, settings.cakto_credits_750_product_ids),
        ("credits:1050", 1050, settings.cakto_credits_1050_product_ids),
    )
    for product_name, credits, configured in mappings:
        if identifiers & settings.cakto_product_ids(configured):
            return product_name, credits
    return None


async def _apply_cakto_entitlement(db, user: User, product_name: str, credits: int) -> None:
    if credits:
        user.bonus_credits += credits
        db.add(CreditTransaction(
            user_id=user.id, amount=credits, balance_after=user.bonus_credits,
            reason="CREDIT_PURCHASE", description=f"Compra Cakto de {credits} créditos",
        ))
        return
    plan_name = "ULTRA_PREMIUM" if product_name == "ultra_premium" else "PREMIUM"
    plan = await db.scalar(select(Plan).where(Plan.name == plan_name, Plan.active.is_(True)))
    if not plan:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Plano comprado indisponível")
    user.plan_id, user.plan = plan.id, plan
    user.subscription_status = "active"


@router.post(
    "/billing/checkout", response_model=CheckoutResponse,
    dependencies=[Depends(require_csrf), Depends(rate_limit("checkout", 30, 60))],
)
async def checkout(
    payload: CheckoutRequest,
    user: User = Depends(get_current_user),
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=64),
) -> CheckoutResponse:
    settings = get_settings()
    if payload.product == "premium" and settings.premium_checkout_url:
        return CheckoutResponse(url=settings.premium_checkout_url)
    if payload.product == "ultra_premium" and settings.ultra_premium_checkout_url:
        return CheckoutResponse(url=settings.ultra_premium_checkout_url)
    credit_amount = payload.credit_amount or 150
    if payload.product == "credits":
        checkout_url = {
            150: settings.credits_150_checkout_url or settings.credits_checkout_url,
            270: settings.credits_270_checkout_url,
            750: settings.credits_750_checkout_url,
            1050: settings.credits_1050_checkout_url,
        }[credit_amount]
        if checkout_url:
            return CheckoutResponse(url=checkout_url)
    price_id = {
        "premium": settings.stripe_premium_price_id,
        "ultra_premium": settings.stripe_ultra_premium_price_id,
        "credits": settings.stripe_credits_price_id,
    }[payload.product]
    if not settings.stripe_secret_key or (payload.product != "credits" and not price_id):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Checkout indisponível")
    stripe.api_key = settings.stripe_secret_key
    mode = "subscription" if payload.product in {"premium", "ultra_premium"} else "payment"
    if payload.product != "credits" and payload.credit_amount is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pacote de créditos inválido")
    if payload.product == "credits":
        amount_cents = round(credit_amount * 999 / 150)
        line_items = [{
            "price_data": {
                "currency": "brl",
                "unit_amount": amount_cents,
                "product_data": {"name": f"{credit_amount} créditos Reda1000IA"},
            },
            "quantity": 1,
        }]
    else:
        line_items = [{"price": price_id, "quantity": 1}]
    stored_product = f"credits:{credit_amount}" if payload.product == "credits" else payload.product
    customer_args = {"customer": user.stripe_customer_id} if user.stripe_customer_id else {"customer_email": user.email}
    subscription_args = {"subscription_data": {"metadata": {"user_id": str(user.id), "product": payload.product}}} if mode == "subscription" else {}
    checkout_session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode=mode,
        line_items=line_items,
        success_url=f"{settings.frontend_url}/planos?checkout=sucesso",
        cancel_url=f"{settings.frontend_url}/planos?checkout=cancelado",
        metadata={"user_id": str(user.id), "product": payload.product, "credit_amount": str(credit_amount) if payload.product == "credits" else ""},
        idempotency_key=idempotency_key,
        **customer_args,
        **subscription_args,
    )
    async with SessionFactory.begin() as db:
        existing = await db.scalar(select(Payment).where(Payment.provider_session_id == checkout_session.id))
        if not existing:
            db.add(Payment(
                id=uuid.uuid4(), user_id=user.id, provider_session_id=checkout_session.id,
                product=stored_product, amount_cents=int(checkout_session.amount_total or 0),
                status=PaymentStatus.PENDING,
            ))
    return CheckoutResponse(url=checkout_session.url)


@router.post("/webhooks/payment-provider", response_model=MessageResponse)
async def stripe_webhook(
    request: Request, stripe_signature: str = Header(alias="Stripe-Signature")
) -> MessageResponse:
    settings = get_settings()
    body = await request.body()
    try:
        event = stripe.Webhook.construct_event(body, stripe_signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Webhook inválido") from exc
    event_id, event_type = event["id"], event["type"]
    async with SessionFactory.begin() as db:
        event_insert = (
            pg_insert(BillingEvent)
            .values(provider="stripe", event_id=event_id, event_type=event_type, payload={"object_id": event["data"]["object"].get("id")})
            .on_conflict_do_nothing(index_elements=["provider", "event_id"])
            .returning(BillingEvent.id)
        )
        if await db.scalar(event_insert) is None:
            return MessageResponse(message="Evento já processado")
        data = event["data"]["object"]
        if event_type == "checkout.session.completed":
            payment = await db.scalar(select(Payment).where(Payment.provider_session_id == data.get("id")))
            if payment:
                payment.status = PaymentStatus.PAID
                payment.provider_payment_intent = data.get("payment_intent")
                user = await db.get(User, payment.user_id)
                if payment.product in {"premium", "ultra_premium"}:
                    plan_name = "ULTRA_PREMIUM" if payment.product == "ultra_premium" else "PREMIUM"
                    premium = await db.scalar(select(Plan).where(Plan.name == plan_name))
                    user.plan_id, user.plan = premium.id, premium
                    user.stripe_customer_id = data.get("customer") or user.stripe_customer_id
                    user.stripe_subscription_id = data.get("subscription")
                    user.subscription_status = "active"
                else:
                    _, _, purchased = payment.product.partition(":")
                    amount = int(purchased or 150)
                    user.bonus_credits += amount
                    db.add(CreditTransaction(
                        user_id=user.id, amount=amount, balance_after=user.bonus_credits,
                        reason="CREDIT_PURCHASE", description=f"Compra de {amount} créditos", payment_id=payment.id,
                    ))
        elif event_type in {"checkout.session.expired", "checkout.session.async_payment_failed"}:
            payment = await db.scalar(select(Payment).where(Payment.provider_session_id == data.get("id")))
            if payment:
                payment.status = PaymentStatus.FAILED
        elif event_type == "charge.refunded":
            payment = await db.scalar(select(Payment).where(Payment.provider_payment_intent == data.get("payment_intent")))
            if payment:
                payment.status = PaymentStatus.REFUNDED
                if payment.product.startswith("credits:"):
                    user = await db.get(User, payment.user_id)
                    amount = int(payment.product.partition(":")[2] or 150)
                    deducted = min(amount, user.bonus_credits)
                    user.bonus_credits -= deducted
                    db.add(CreditTransaction(
                        user_id=user.id, amount=-deducted, balance_after=user.bonus_credits,
                        reason="CREDIT_REFUND", description=f"Estorno de compra de {amount} créditos", payment_id=payment.id,
                    ))
        elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
            metadata = data.get("metadata") or {}
            user_id = metadata.get("user_id")
            user = await db.get(User, int(user_id)) if user_id else await db.scalar(select(User).where(User.stripe_subscription_id == data.get("id")))
            if user:
                subscription_status = str(data.get("status") or "inactive")
                user.stripe_customer_id = data.get("customer") or user.stripe_customer_id
                user.stripe_subscription_id = data.get("id")
                user.subscription_status = subscription_status
                if event_type == "customer.subscription.deleted" or subscription_status in {"canceled", "unpaid", "incomplete_expired"}:
                    free = await db.scalar(select(Plan).where(Plan.name == "FREE"))
                    user.plan_id, user.plan = free.id, free
                elif subscription_status in {"active", "trialing"}:
                    product = metadata.get("product")
                    plan_name = "ULTRA_PREMIUM" if product == "ultra_premium" else "PREMIUM"
                    plan = await db.scalar(select(Plan).where(Plan.name == plan_name))
                    user.plan_id, user.plan = plan.id, plan
        elif event_type == "invoice.payment_failed":
            user = await db.scalar(select(User).where(User.stripe_customer_id == data.get("customer")))
            if user:
                user.subscription_status = "past_due"
    return MessageResponse(message="Evento processado")


@router.post("/webhooks/cakto", response_model=MessageResponse)
async def cakto_webhook(request: Request) -> MessageResponse:
    """Process Cakto's JSON-secret webhook protocol idempotently."""
    settings = get_settings()
    if not settings.cakto_webhook_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhook Cakto não configurado")
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "JSON inválido") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payload inválido")
    received_secret = str(payload.get("secret") or "")
    if not hmac.compare_digest(received_secret, settings.cakto_webhook_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Webhook não autorizado")
    event_type = str(payload.get("event") or "")
    data = payload.get("data")
    if not event_type or not isinstance(data, dict) or not data.get("id"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Evento incompleto")
    event_id = f"{event_type}:{data['id']}"
    supported = {
        "purchase_approved", "purchase_refused", "refund", "chargeback",
        "subscription_created", "subscription_renewed",
        "subscription_renewal_refused", "subscription_canceled",
    }
    if event_type not in supported:
        return MessageResponse(message="Evento ignorado")

    async with SessionFactory.begin() as db:
        inserted = await db.scalar(
            pg_insert(BillingEvent)
            .values(provider="cakto", event_id=event_id, event_type=event_type,
                    payload={"object_id": str(data["id"])})
            .on_conflict_do_nothing(index_elements=["provider", "event_id"])
            .returning(BillingEvent.id)
        )
        if inserted is None:
            return MessageResponse(message="Evento já processado")

        order_key = f"cakto:{data['id']}"
        payment = await db.scalar(select(Payment).where(Payment.provider_session_id == order_key))
        customer = data.get("customer") or {}
        email = str(customer.get("email") or "").strip().casefold()
        user = await db.scalar(select(User).where(User.email == email)) if email else None

        if event_type == "purchase_approved":
            product = _cakto_product(settings, data)
            if not product:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Produto Cakto não mapeado")
            if not user:
                raise HTTPException(status.HTTP_409_CONFLICT, "Comprador sem conta associada")
            product_name, credits = product
            if not payment:
                amount_cents = round(float(data.get("baseAmount") or 0) * 100)
                payment = Payment(
                    id=uuid.uuid4(), user_id=user.id, provider_session_id=order_key,
                    product=product_name, amount_cents=max(0, amount_cents), status=PaymentStatus.PAID,
                )
                db.add(payment)
                await _apply_cakto_entitlement(db, user, product_name, credits)
        elif event_type in {"refund", "chargeback"}:
            if payment and payment.status != PaymentStatus.REFUNDED:
                payment.status = PaymentStatus.REFUNDED
                owner = await db.get(User, payment.user_id)
                if payment.product.startswith("credits:"):
                    credits = int(payment.product.partition(":")[2])
                    deducted = min(credits, owner.bonus_credits)
                    owner.bonus_credits -= deducted
                    db.add(CreditTransaction(
                        user_id=owner.id, amount=-deducted, balance_after=owner.bonus_credits,
                        reason="CREDIT_REFUND", description=f"Estorno Cakto de {credits} créditos",
                        payment_id=payment.id,
                    ))
                else:
                    free = await db.scalar(select(Plan).where(Plan.name == "FREE"))
                    owner.plan_id, owner.plan = free.id, free
                    owner.subscription_status = "refunded"
        elif event_type in {"subscription_canceled", "subscription_renewal_refused"} and user:
            free = await db.scalar(select(Plan).where(Plan.name == "FREE"))
            user.plan_id, user.plan = free.id, free
            user.subscription_status = "canceled" if event_type == "subscription_canceled" else "past_due"
        elif event_type in {"subscription_created", "subscription_renewed"} and user:
            product = _cakto_product(settings, data)
            if product and not product[1]:
                await _apply_cakto_entitlement(db, user, product[0], 0)
    logging.getLogger(__name__).info(
        "cakto_event_processed", extra={"event_type": event_type, "event_id": str(data["id"])}
    )
    return MessageResponse(message="Evento processado")
