"""AGRIOS Payment Provider abstraction.

Clean base interface with three concrete providers:
- MockProvider    — default when PAYMENT_PROVIDER=mock (no external calls)
- PaystackProvider — PAYMENT_PROVIDER=paystack + PAYSTACK_SECRET_KEY
- FlutterwaveProvider — PAYMENT_PROVIDER=flutterwave + FLUTTERWAVE_SECRET_KEY

Every provider implements:
  initialize(amount, currency, email, reference, metadata) -> {authorization_url, reference}
  verify(reference) -> {status: 'success'|'failed'|'pending', amount, currency, raw}
  verify_webhook_signature(raw_body: bytes, headers: dict) -> bool
  parse_webhook(raw_body: bytes) -> {event_id, reference, status, amount, currency, raw}

Secrets read from env via services.config; missing keys auto-downgrade to mock.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

import httpx

from . import config as cfg

logger = logging.getLogger("agrios.payments")


class PaymentProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def initialize(
        self,
        *,
        amount: float,
        currency: str,
        email: str,
        reference: str,
        metadata: Optional[Dict[str, Any]] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]: ...

    @abstractmethod
    async def verify(self, reference: str) -> Dict[str, Any]: ...

    @abstractmethod
    def verify_webhook_signature(self, raw_body: bytes, headers: Dict[str, str]) -> bool: ...

    @abstractmethod
    def parse_webhook(self, raw_body: bytes) -> Dict[str, Any]: ...


# ---------------------------- Mock ----------------------------


class MockProvider(PaymentProvider):
    name = "mock"

    async def initialize(self, *, amount, currency, email, reference, metadata=None, callback_url=None):
        return {
            "authorization_url": f"{cfg.PUBLIC_SITE_URL}/app/wallet?mock_ref={reference}",
            "reference": reference,
            "provider": "mock",
            "status": "pending",
        }

    async def verify(self, reference):
        # Mock: auto-approve after invocation
        return {"status": "success", "reference": reference, "amount": None, "currency": None, "raw": {"mock": True}}

    def verify_webhook_signature(self, raw_body, headers):
        return True  # mock trusts everything

    def parse_webhook(self, raw_body):
        payload = json.loads(raw_body or b"{}")
        return {
            "event_id": payload.get("event_id") or payload.get("id") or f"mock-{payload.get('reference','')}",
            "reference": payload.get("reference"),
            "status": payload.get("status", "success"),
            "amount": payload.get("amount"),
            "currency": payload.get("currency", "NGN"),
            "raw": payload,
        }


# ---------------------------- Paystack ----------------------------


class PaystackProvider(PaymentProvider):
    """Paystack Nigeria payment provider.

    API docs: https://paystack.com/docs/api/
    """
    name = "paystack"
    _base = "https://api.paystack.co"

    def __init__(self) -> None:
        self._secret = cfg._str("PAYSTACK_SECRET_KEY")
        self._webhook_secret = cfg._str("PAYSTACK_WEBHOOK_SECRET") or self._secret

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self._secret}", "Content-Type": "application/json"}

    async def initialize(self, *, amount, currency, email, reference, metadata=None, callback_url=None):
        # Paystack expects amount in kobo (smallest currency unit)
        body = {
            "email": email,
            "amount": int(round(float(amount) * 100)),
            "currency": currency,
            "reference": reference,
            "metadata": metadata or {},
        }
        if callback_url:
            body["callback_url"] = callback_url
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"{self._base}/transaction/initialize", json=body, headers=self._headers())
        if r.status_code >= 300:
            raise RuntimeError(f"Paystack initialize failed ({r.status_code}): {r.text[:300]}")
        data = r.json()["data"]
        return {
            "authorization_url": data["authorization_url"],
            "reference": data["reference"],
            "provider": "paystack",
            "access_code": data.get("access_code"),
        }

    async def verify(self, reference):
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{self._base}/transaction/verify/{reference}", headers=self._headers())
        if r.status_code >= 300:
            return {"status": "failed", "reference": reference, "raw": r.text[:500]}
        d = r.json().get("data") or {}
        status = "success" if d.get("status") == "success" else "failed"
        return {
            "status": status,
            "reference": reference,
            "amount": (d.get("amount") or 0) / 100.0,
            "currency": d.get("currency"),
            "raw": d,
        }

    def verify_webhook_signature(self, raw_body, headers):
        sig = headers.get("x-paystack-signature") or headers.get("X-Paystack-Signature")
        if not sig or not self._webhook_secret:
            return False
        computed = hmac.new(self._webhook_secret.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(sig, computed)

    def parse_webhook(self, raw_body):
        payload = json.loads(raw_body or b"{}")
        data = payload.get("data") or {}
        return {
            "event_id": data.get("id") or data.get("reference"),
            "reference": data.get("reference"),
            "status": "success" if data.get("status") == "success" else "failed",
            "amount": (data.get("amount") or 0) / 100.0,
            "currency": data.get("currency"),
            "event_type": payload.get("event"),
            "raw": payload,
        }


# ---------------------------- Flutterwave ----------------------------


class FlutterwaveProvider(PaymentProvider):
    """Flutterwave multi-country (NG/GH/KE/CI) payment provider.

    API docs: https://developer.flutterwave.com/docs
    """
    name = "flutterwave"
    _base = "https://api.flutterwave.com/v3"

    def __init__(self) -> None:
        self._secret = cfg._str("FLUTTERWAVE_SECRET_KEY")
        self._webhook_secret = cfg._str("FLUTTERWAVE_WEBHOOK_SECRET")

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self._secret}", "Content-Type": "application/json"}

    async def initialize(self, *, amount, currency, email, reference, metadata=None, callback_url=None):
        body = {
            "tx_ref": reference,
            "amount": float(amount),
            "currency": currency,
            "redirect_url": callback_url or f"{cfg.PUBLIC_SITE_URL}/app/wallet",
            "customer": {"email": email},
            "meta": metadata or {},
            "payment_options": "card,ussd,banktransfer,mobilemoneyghana,mobilemoneykenya,mpesa",
            "customizations": {"title": cfg.APP_NAME, "description": "AGRIOS wallet funding"},
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"{self._base}/payments", json=body, headers=self._headers())
        if r.status_code >= 300:
            raise RuntimeError(f"Flutterwave initialize failed ({r.status_code}): {r.text[:300]}")
        data = r.json().get("data") or {}
        return {
            "authorization_url": data.get("link"),
            "reference": reference,
            "provider": "flutterwave",
        }

    async def verify(self, reference):
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{self._base}/transactions/verify_by_reference",
                params={"tx_ref": reference},
                headers=self._headers(),
            )
        if r.status_code >= 300:
            return {"status": "failed", "reference": reference, "raw": r.text[:500]}
        d = (r.json().get("data") or {})
        status = "success" if d.get("status") == "successful" else "failed"
        return {
            "status": status,
            "reference": reference,
            "amount": d.get("amount"),
            "currency": d.get("currency"),
            "raw": d,
        }

    def verify_webhook_signature(self, raw_body, headers):
        """Flutterwave sends `verif-hash` header set to the `secret_hash` configured in the dashboard."""
        sig = headers.get("verif-hash") or headers.get("Verif-Hash")
        if not sig or not self._webhook_secret:
            return False
        return hmac.compare_digest(sig, self._webhook_secret)

    def parse_webhook(self, raw_body):
        payload = json.loads(raw_body or b"{}")
        data = payload.get("data") or {}
        return {
            "event_id": str(data.get("id") or data.get("tx_ref") or ""),
            "reference": data.get("tx_ref"),
            "status": "success" if data.get("status") == "successful" else "failed",
            "amount": data.get("amount"),
            "currency": data.get("currency"),
            "event_type": payload.get("event"),
            "raw": payload,
        }


# ---------------------------- Factory ----------------------------


_INSTANCES: Dict[str, PaymentProvider] = {}


def get_provider(name: Optional[str] = None) -> PaymentProvider:
    """Return the active provider for the env, auto-downgrade if secret missing."""
    configured = (name or cfg.PAYMENT_PROVIDER or "mock").lower()
    if configured == "paystack" and not cfg._str("PAYSTACK_SECRET_KEY"):
        logger.warning("PAYSTACK_SECRET_KEY missing — downgrading to mock")
        configured = "mock"
    if configured == "flutterwave" and not cfg._str("FLUTTERWAVE_SECRET_KEY"):
        logger.warning("FLUTTERWAVE_SECRET_KEY missing — downgrading to mock")
        configured = "mock"
    if configured not in _INSTANCES:
        if configured == "paystack":
            _INSTANCES[configured] = PaystackProvider()
        elif configured == "flutterwave":
            _INSTANCES[configured] = FlutterwaveProvider()
        else:
            _INSTANCES[configured] = MockProvider()
    return _INSTANCES[configured]


def provider_by_name(name: str) -> PaymentProvider:
    """Get provider instance by name — used by webhook handlers (the path segment determines which)."""
    n = name.lower()
    if n == "paystack":
        return _INSTANCES.get("paystack") or PaystackProvider()
    if n == "flutterwave":
        return _INSTANCES.get("flutterwave") or FlutterwaveProvider()
    return _INSTANCES.get("mock") or MockProvider()
