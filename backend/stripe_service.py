import os
import re
import requests
import logging
from typing import Dict, Optional, Tuple
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

_STRIPE_KEY_CACHE = {"secret": None, "publishable": None}


def set_stripe_key_cache(secret: Optional[str] = None, publishable: Optional[str] = None) -> None:
    if secret is not None:
        _STRIPE_KEY_CACHE["secret"] = (secret or "").strip() or None
    if publishable is not None:
        _STRIPE_KEY_CACHE["publishable"] = (publishable or "").strip() or None


def looks_like_stripe_secret(key: str) -> bool:
    k = (key or "").strip()
    return bool(re.match(r"^sk_(live|test)_[A-Za-z0-9]+", k))


def looks_like_stripe_publishable(key: str) -> bool:
    k = (key or "").strip()
    return bool(re.match(r"^pk_(live|test)_[A-Za-z0-9]+", k))


class StripeService:
    """
    Stripe Payment Links integration.
    Docs: https://docs.stripe.com/api/payment_links/payment_links/create
    """

    def __init__(self):
        ROOT_DIR = Path(__file__).parent
        load_dotenv(ROOT_DIR / ".env")
        self.base_url = "https://api.stripe.com/v1"
        logger.info("Stripe Service initialized")

    def _get_api_keys(self) -> Tuple[str, str, bool]:
        secret = (
            _STRIPE_KEY_CACHE.get("secret")
            or (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
        )
        publishable = (
            _STRIPE_KEY_CACHE.get("publishable")
            or (os.environ.get("STRIPE_PUBLISHABLE_KEY") or "").strip()
        )
        placeholders = {
            "",
            "your_stripe_secret_key",
            "your_stripe_publishable_key",
            "sk_test_...",
            "pk_test_...",
        }
        if secret.lower() in placeholders:
            secret = ""
        if publishable.lower() in placeholders:
            publishable = ""

        # Treat clearly wrong prefixes as not configured (e.g. mk_… pasted by mistake)
        if secret and not looks_like_stripe_secret(secret):
            logger.error(
                "Stripe secret key has invalid prefix %r — expected sk_live_… or sk_test_…",
                secret[:8],
            )
            return secret, publishable, True  # is_demo / unusable
        if publishable and not looks_like_stripe_publishable(publishable):
            logger.error(
                "Stripe publishable key has invalid prefix %r — expected pk_live_… or pk_test_…",
                publishable[:8],
            )

        is_demo = not looks_like_stripe_secret(secret)
        return secret, publishable, is_demo

    def _public_frontend(self) -> str:
        for key in ("PUBLIC_SITE_URL", "FRONTEND_URL"):
            url = (os.environ.get(key) or "").strip().rstrip("/")
            if url and "vercel.app" not in url.lower() and "localhost" not in url.lower():
                return url
        return "https://kayee01.com"

    async def create_payment_link(
        self,
        order_id: str,
        amount: float,
        currency: str = "usd",
        description: str = "",
        customer_email: str = "",
    ) -> Dict:
        api_key, publishable_key, is_demo = self._get_api_keys()

        if is_demo:
            return {
                "success": False,
                "demo_mode": True,
                "error": (
                    "Stripe secret key missing or invalid. "
                    "In Stripe Dashboard → Developers → API keys, copy "
                    "Secret key (sk_live_… or sk_test_…) and Publishable key (pk_live_… / pk_test_…). "
                    f"Current secret starts with {(api_key or '∅')[:8]!r}."
                ),
            }

        # Stripe requires lowercase ISO currency codes
        currency = (currency or "usd").strip().lower()
        try:
            unit_amount = int(round(float(amount) * 100))
        except (TypeError, ValueError):
            return {"success": False, "error": f"Invalid amount: {amount}"}
        if unit_amount < 50:  # Stripe minimum often $0.50
            return {"success": False, "error": "Amount too small for Stripe (min ~$0.50)"}

        try:
            product_response = requests.post(
                f"{self.base_url}/products",
                auth=(api_key, ""),
                data={
                    "name": (description or f"Order {order_id}")[:250],
                    "description": f"Payment for order {order_id}",
                },
                timeout=30,
            )
            if product_response.status_code != 200:
                err = product_response.json().get("error", {}).get("message") or product_response.text
                logger.error("Stripe product creation failed: %s", err)
                return {"success": False, "error": f"Stripe product error: {err}"}

            product_id = product_response.json().get("id")
            price_response = requests.post(
                f"{self.base_url}/prices",
                auth=(api_key, ""),
                data={
                    "product": product_id,
                    "unit_amount": unit_amount,
                    "currency": currency,
                },
                timeout=30,
            )
            if price_response.status_code != 200:
                err = price_response.json().get("error", {}).get("message") or price_response.text
                logger.error("Stripe price creation failed: %s", err)
                return {"success": False, "error": f"Stripe price error: {err}"}

            price_id = price_response.json().get("id")
            frontend_url = self._public_frontend()
            link_response = requests.post(
                f"{self.base_url}/payment_links",
                auth=(api_key, ""),
                data={
                    "line_items[0][price]": price_id,
                    "line_items[0][quantity]": 1,
                    "metadata[order_id]": order_id,
                    "customer_creation": "always",
                    "after_completion[type]": "redirect",
                    "after_completion[redirect][url]": (
                        f"{frontend_url}/order-success/{order_id}?payment=success"
                    ),
                },
                timeout=30,
            )
            if link_response.status_code == 200:
                data = link_response.json()
                logger.info("✓ Stripe payment link created: %s", data.get("id"))
                return {
                    "success": True,
                    "payment_id": data.get("id"),
                    "payment_url": data.get("url"),
                    "amount": amount,
                    "currency": currency,
                    "status": "pending",
                }

            err = link_response.json().get("error", {}).get("message") or link_response.text
            logger.error("Stripe payment link creation failed: %s", err)
            return {"success": False, "error": f"Stripe payment link error: {err}"}

        except Exception as e:
            logger.error("Stripe payment link creation failed: %s", e)
            return {"success": False, "error": str(e)}

    async def verify_api_key(self) -> Dict:
        api_key, publishable_key, is_demo = self._get_api_keys()
        if is_demo:
            return {
                "success": False,
                "error": (
                    "Invalid Stripe Secret key. It must start with sk_live_ or sk_test_ "
                    f"(yours starts with {(api_key or 'empty')[:8]!r}). "
                    "Get keys from https://dashboard.stripe.com/apikeys"
                ),
            }
        if publishable_key and not looks_like_stripe_publishable(publishable_key):
            return {
                "success": False,
                "error": (
                    "Invalid Stripe Publishable key. It must start with pk_live_ or pk_test_ "
                    f"(yours starts with {publishable_key[:8]!r})."
                ),
            }
        if publishable_key and api_key[3:7] != publishable_key[3:7]:
            # sk_live vs pk_test mismatch
            return {
                "success": False,
                "error": (
                    f"Key mode mismatch: secret is {api_key[:7]}… but publishable is "
                    f"{publishable_key[:7]}…. Both must be live or both test."
                ),
            }
        try:
            response = requests.get(
                f"{self.base_url}/balance",
                auth=(api_key, ""),
                timeout=20,
            )
            data = response.json() if response.content else {}
            if response.status_code == 200:
                mode = "live" if api_key.startswith("sk_live_") else "test"
                return {
                    "success": True,
                    "message": f"Stripe key works ({mode} mode)",
                    "mode": mode,
                }
            err = (data.get("error") or {}).get("message") or response.text[:200]
            return {"success": False, "error": err}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def verify_payment(self, session_id: str) -> Dict:
        api_key, publishable_key, is_demo = self._get_api_keys()
        if is_demo:
            return {"success": False, "error": "Stripe not configured"}
        try:
            response = requests.get(
                f"{self.base_url}/checkout/sessions/{session_id}",
                auth=(api_key, ""),
                timeout=30,
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "status": data.get("payment_status"),
                    "amount": (data.get("amount_total") or 0) / 100,
                }
            return {"success": False, "error": "Session not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}


stripe_service = StripeService()
