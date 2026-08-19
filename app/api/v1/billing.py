import asyncio
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


@router.post(
    "/billing/checkout", response_model=CheckoutResponse,
    dependencies=[Depends(require_csrf), Depends(rate_limit("checkout", 10, 3600))],
)
async def checkout(
    payload: CheckoutRequest,
    user: User = Depends(get_current_user),
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=64),
) -> CheckoutResponse:
    settings = get_settings()
    if payload.product == "premium" and settings.premium_checkout_url:
        return CheckoutResponse(url=settings.premium_checkout_url)
    price_id = {
        "premium": settings.stripe_premium_price_id,
        "ultra_premium": settings.stripe_ultra_premium_price_id,
        "credits": settings.stripe_credits_price_id,
    }[payload.product]
    if not settings.stripe_secret_key or (payload.product != "credits" and not price_id):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Checkout indisponível")
    stripe.api_key = settings.stripe_secret_key
    mode = "subscription" if payload.product in {"premium", "ultra_premium"} else "payment"
    credit_amount = payload.credit_amount or 150
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
