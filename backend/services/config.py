"""Centralised settings + feature flags for AGRIOS.

Single source of truth: everything reads from os.environ via this module so
provider switches + feature flags can be toggled without code changes.
"""
from __future__ import annotations

import os
from typing import Any, Dict

_TRUTHY = {"1", "true", "yes", "on", "y", "enable", "enabled"}


def _bool(key: str, default: bool = False) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUTHY


def _csv(key: str, default: str = "") -> list[str]:
    raw = os.environ.get(key, default) or ""
    return [x.strip() for x in raw.split(",") if x.strip()]


def _str(key: str, default: str = "") -> str:
    return os.environ.get(key, default) or default


def _int(key: str, default: int = 0) -> int:
    try:
        return int(os.environ.get(key, str(default)))
    except (TypeError, ValueError):
        return default


# ---- Core ----
APP_ENV = _str("APP_ENV", "development")
APP_NAME = _str("APP_NAME", "AGRIOS")
PUBLIC_SITE_URL = _str("PUBLIC_SITE_URL", "").rstrip("/")
SUPPORT_EMAIL = _str("SUPPORT_EMAIL", "support@agrios.africa")

# ---- Email ----
EMAIL_PROVIDER = _str("EMAIL_PROVIDER", "mock").lower()  # mock | resend | sendgrid
EMAIL_FROM_NAME = _str("EMAIL_FROM_NAME", "AGRIOS")
EMAIL_FROM_ADDRESS = _str("EMAIL_FROM_ADDRESS", "no-reply@agrios.africa")
EMAIL_REPLY_TO = _str("EMAIL_REPLY_TO", "support@agrios.africa")
RESEND_API_KEY = _str("RESEND_API_KEY")
RESEND_FROM = _str("RESEND_FROM", f"{EMAIL_FROM_NAME} <{EMAIL_FROM_ADDRESS}>")
SENDGRID_API_KEY = _str("SENDGRID_API_KEY")

# ---- WhatsApp / SMS ----
WHATSAPP_PROVIDER = _str("WHATSAPP_PROVIDER", "share_only").lower()  # share_only | twilio
WHATSAPP_SHARE_BASE_URL = _str("WHATSAPP_SHARE_BASE_URL", "https://wa.me/")
WHATSAPP_DEFAULT_COUNTRY_CODE = _str("WHATSAPP_DEFAULT_COUNTRY_CODE", "234")
TWILIO_ACCOUNT_SID = _str("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = _str("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = _str("TWILIO_WHATSAPP_FROM")

# ---- Payments ----
PAYMENT_PROVIDER = _str("PAYMENT_PROVIDER", "mock").lower()  # mock | flutterwave | paystack
PAYMENT_CURRENCY_DEFAULT = _str("PAYMENT_CURRENCY_DEFAULT", "NGN")

# ---- Cron / Market Pulse ----
ENABLE_CRON = _bool("ENABLE_CRON", True)
MARKET_PULSE_CRON_HOUR_UTC = _int("MARKET_PULSE_CRON_HOUR_UTC", 8)
MARKET_PULSE_TIMEZONE = _str("MARKET_PULSE_TIMEZONE", "Africa/Lagos")
MARKET_PULSE_BATCH_SIZE = _int("MARKET_PULSE_BATCH_SIZE", 500)
MARKET_PULSE_SEND_LIMIT = _int("MARKET_PULSE_SEND_LIMIT", 5000)
MARKET_PULSE_DORMANT_DAYS = _int("MARKET_PULSE_DORMANT_DAYS", 30)

# ---- Country / currency ----
DEFAULT_COUNTRY = _str("DEFAULT_COUNTRY", "NG")
SUPPORTED_COUNTRIES = _csv("SUPPORTED_COUNTRIES", "NG,GH,KE,CI")
SUPPORTED_CURRENCIES = _csv("SUPPORTED_CURRENCIES", "NGN,GHS,KES,XOF")

# ---- Feature flags ----
FLAGS = {
    "market_pulse": _bool("FEATURE_MARKET_PULSE", True),
    "whatsapp_share": _bool("FEATURE_WHATSAPP_SHARE", True),
    "email_digest": _bool("FEATURE_EMAIL_DIGEST", True),
    "real_payments": _bool("FEATURE_REAL_PAYMENTS", False),
    "real_whatsapp_push": _bool("FEATURE_REAL_WHATSAPP_PUSH", False),
    "loans": _bool("FEATURE_LOANS", True),
    "escrow": _bool("FEATURE_ESCROW", True),
    "video_promotion": _bool("FEATURE_VIDEO_PROMOTION", True),
    "hot_demand": _bool("FEATURE_HOT_DEMAND", True),
}


def public_config() -> Dict[str, Any]:
    """Public config surfaced to the React frontend via GET /api/config."""
    effective_email = EMAIL_PROVIDER
    if EMAIL_PROVIDER == "resend" and not RESEND_API_KEY:
        effective_email = "mock"  # misconfigured — degrade gracefully
    if EMAIL_PROVIDER == "sendgrid" and not SENDGRID_API_KEY:
        effective_email = "mock"

    return {
        "app": {
            "name": APP_NAME,
            "env": APP_ENV,
            "site_url": PUBLIC_SITE_URL,
            "support_email": SUPPORT_EMAIL,
        },
        "country": {
            "default": DEFAULT_COUNTRY,
            "supported": SUPPORTED_COUNTRIES,
            "currencies": SUPPORTED_CURRENCIES,
        },
        "providers": {
            "email": {
                "configured": EMAIL_PROVIDER,
                "effective": effective_email,
            },
            "whatsapp": {"configured": WHATSAPP_PROVIDER, "effective": WHATSAPP_PROVIDER},
            "payment": {
                "configured": PAYMENT_PROVIDER,
                "effective": PAYMENT_PROVIDER if FLAGS["real_payments"] else "mock",
            },
        },
        "features": FLAGS,
        "market_pulse": {
            "timezone": MARKET_PULSE_TIMEZONE,
            "cron_hour_utc": MARKET_PULSE_CRON_HOUR_UTC,
            "dormant_days": MARKET_PULSE_DORMANT_DAYS,
        },
    }
