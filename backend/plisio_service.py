import os
import json
import requests
import logging
from typing import Dict, Optional
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)

# Updated at startup / when admin saves API settings (avoids stale env on multi-worker).
_PLISIO_KEY_CACHE = {"value": None}


def set_plisio_api_key_cache(value: Optional[str]) -> None:
    _PLISIO_KEY_CACHE["value"] = (value or "").strip() or None


def get_plisio_api_key_cache() -> Optional[str]:
    return _PLISIO_KEY_CACHE.get("value")


class PlisioService:
    """
    Plisio crypto invoices.
    Docs: https://plisio.net/documentation/endpoints/create-an-invoice
    """

    def __init__(self):
        # Official host; plisio.net also proxies but api.plisio.net is preferred in docs.
        # Some hosts block api.plisio.net (403) while plisio.net works — try both.
        self.base_urls = [
            "https://plisio.net/api/v1",
            "https://api.plisio.net/api/v1",
        ]
        self._refresh_api_key()
        logger.info(
            "Plisio initialized - Demo mode: %s, Key prefix: %s...",
            self.is_demo,
            (self.api_key or "")[:8],
        )

    def _refresh_api_key(self):
        """Prefer live cache (admin save / startup), then environment."""
        cached = get_plisio_api_key_cache()
        env_key = (os.environ.get("PLISIO_API_KEY") or "").strip()
        key = cached or env_key or "your_plisio_api_key"
        if key.lower() in ("your_plisio_api_key", "changeme", "none", "null"):
            key = "your_plisio_api_key"
        self.api_key = key
        self.is_demo = key == "your_plisio_api_key"
        return self.api_key

    def _public_frontend(self) -> str:
        for key in ("PUBLIC_SITE_URL", "FRONTEND_URL"):
            url = (os.environ.get(key) or "").strip().rstrip("/")
            if url and "vercel.app" not in url.lower() and "localhost" not in url.lower():
                return url
        return "https://kayee01.com"

    def _request_invoice(self, params: dict) -> Dict:
        """GET invoices/new against known Plisio hosts; return parsed JSON + http code."""
        last_error = None
        for base in self.base_urls:
            try:
                response = requests.get(
                    f"{base}/invoices/new",
                    params=params,
                    timeout=30,
                )
                try:
                    data = response.json()
                except Exception:
                    data = {"status": "error", "message": response.text[:500]}
                return {
                    "http_status": response.status_code,
                    "data": data,
                    "base": base,
                }
            except Exception as e:
                last_error = e
                logger.warning("Plisio host %s failed: %s", base, e)
        return {
            "http_status": 0,
            "data": {"status": "error", "message": str(last_error or "unreachable")},
            "base": None,
        }

    async def create_invoice(
        self,
        order_number: str,
        amount: float,
        currency: str = "BTC",
        source_currency: str = "USD",
        description: str = "",
        email: str = "",
        callback_url: str = "",
    ) -> Dict:
        self._refresh_api_key()

        if self.is_demo:
            logger.warning(
                "Plisio demo mode — no real API key loaded (check Admin → API Keys)"
            )
            return {
                "success": False,
                "demo_mode": True,
                "error": "Plisio API key is missing or not loaded. Save it again in Admin → API Keys.",
            }

        frontend_url = self._public_frontend()
        order_name = (description or f"Order {order_number}").strip()[:128]
        # Plisio amounts should be clean decimals
        try:
            source_amount = f"{float(amount):.2f}"
        except (TypeError, ValueError):
            source_amount = str(amount)

        params = {
            "api_key": self.api_key,
            "source_currency": source_currency or "USD",
            "source_amount": source_amount,
            "order_number": str(order_number),
            "order_name": order_name or str(order_number),
            "currency": currency or "BTC",
            "email": email or "",
            "success_invoice_url": f"{frontend_url}/order-success/{order_number}?payment=success",
            "fail_invoice_url": f"{frontend_url}/checkout?payment=failed",
            # If this order_number already has an invoice, return it instead of 422
            "return_existing": "true",
        }
        # Only send callback URLs when non-empty (empty string can 422)
        if callback_url:
            params["callback_url"] = callback_url
        else:
            params["callback_url"] = f"{os.environ.get('BACKEND_URL', frontend_url).rstrip('/')}/api/webhooks/plisio"

        result = self._request_invoice(params)
        http_status = result["http_status"]
        data = result["data"] or {}

        if http_status == 200 and data.get("status") == "success":
            payload = data.get("data") or {}
            invoice_url = payload.get("invoice_url") or payload.get("invoice")
            txn_id = payload.get("txn_id") or payload.get("id")
            if not invoice_url:
                logger.error("Plisio success without invoice_url: %s", data)
                return {
                    "success": False,
                    "error": "Plisio returned success but no invoice URL",
                    "raw": data,
                }
            logger.info("✓ Plisio invoice created: %s via %s", txn_id, result.get("base"))
            return {
                "success": True,
                "invoice_id": txn_id,
                "invoice_url": invoice_url,
                "amount": payload.get("amount") or payload.get("invoice_total_sum"),
                "currency": payload.get("currency") or currency,
                "source_currency": source_currency,
                "source_amount": amount,
                "wallet_hash": payload.get("wallet_hash"),
                "status": payload.get("status") or "new",
                "qr_code": payload.get("qr_code"),
            }

        # Dig error message out of Plisio's nested JSON-in-string format
        err = data.get("message")
        if not err and isinstance(data.get("data"), dict):
            err = data["data"].get("message") or data["data"].get("name")
        if isinstance(err, str):
            try:
                nested = json.loads(err)
                if isinstance(nested, dict):
                    err = nested.get("order_number") or nested.get("message") or err
            except Exception:
                pass
        err = err or f"HTTP {http_status}"
        logger.error("Plisio invoice failed (%s): %s | body=%s", http_status, err, data)
        return {"success": False, "error": str(err), "http_status": http_status, "raw": data}

    async def get_invoice_status(self, invoice_id: str) -> Dict:
        self._refresh_api_key()
        if self.is_demo:
            return {
                "success": False,
                "demo_mode": True,
                "error": "Plisio API key not configured",
            }

        last = None
        for base in self.base_urls:
            try:
                response = requests.get(
                    f"{base}/operations",
                    params={"api_key": self.api_key, "id": invoice_id},
                    timeout=30,
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success":
                        operations = data.get("data") or []
                        if operations:
                            operation = operations[0]
                            return {
                                "success": True,
                                "invoice_id": invoice_id,
                                "status": operation.get("status"),
                                "amount": operation.get("amount"),
                                "tx_hash": operation.get("tx_hash"),
                            }
                last = response.text[:300]
            except Exception as e:
                last = str(e)
        return {"success": False, "error": last or "Invoice not found"}

    async def verify_api_key(self) -> Dict:
        """Quick health check used by admin “Test Plisio key”."""
        self._refresh_api_key()
        if self.is_demo:
            return {"success": False, "error": "No Plisio API key configured"}
        for base in self.base_urls:
            try:
                response = requests.get(
                    f"{base}/currencies",
                    params={"api_key": self.api_key},
                    timeout=20,
                )
                data = response.json() if response.content else {}
                if response.status_code == 200 and data.get("status") == "success":
                    n = len(data.get("data") or [])
                    return {
                        "success": True,
                        "message": f"Plisio key works ({n} currencies via {base})",
                        "base": base,
                    }
                err = data.get("message") or data.get("data") or response.text[:200]
                last = f"HTTP {response.status_code}: {err}"
            except Exception as e:
                last = str(e)
        return {"success": False, "error": last or "Plisio key rejected"}


plisio_service = PlisioService()
