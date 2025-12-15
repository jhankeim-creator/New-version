import os
import requests
import base64
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class PayPalService:
    """
    Service pour intégrer PayPal Payment Links
    Documentation: https://developer.paypal.com/studio/checkout/payment-links-and-buttons
    """
    
    def __init__(self):
        # Config is read dynamically per request (supports runtime updates from admin settings)
        self.access_token = None

    def _get_config(self):
        client_id = os.environ.get('PAYPAL_CLIENT_ID', 'your_paypal_client_id')
        client_secret = os.environ.get('PAYPAL_CLIENT_SECRET', 'your_paypal_client_secret')
        mode = os.environ.get('PAYPAL_MODE', 'sandbox')  # sandbox | live
        base_url = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"
        is_demo = client_id == 'your_paypal_client_id' or not client_id or client_id.strip() == ""
        return client_id, client_secret, mode, base_url, is_demo
    
    def _get_access_token(self) -> str:
        """Obtenir un token d'accès OAuth2"""
        try:
            client_id, client_secret, _, base_url, _ = self._get_config()
            auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
            
            headers = {
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            response = requests.post(
                f"{base_url}/v1/oauth2/token",
                headers=headers,
                data={"grant_type": "client_credentials"},
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json().get("access_token")
            
            return None
        except Exception as e:
            logger.error(f"Failed to get PayPal access token: {str(e)}")
            return None
    
    async def create_order(
        self,
        order_id: str,
        amount: float,
        currency: str = "USD",
        description: str = "",
        return_url: str = "",
        cancel_url: str = ""
    ) -> Dict:
        """
        Créer une commande PayPal
        
        Documentation: https://developer.paypal.com/docs/api/orders/v2/#orders_create
        """
        
        _, _, _, base_url, is_demo = self._get_config()
        if is_demo:
            logger.info(f"💰 PayPal Demo Mode - Order Creation:")
            logger.info(f"Order: {order_id}, Amount: ${amount}")
            
            return {
                "success": True,
                "demo_mode": True,
                "order_id": f"demo_paypal_{order_id}",
                "approval_url": f"https://www.paypal.com/checkoutnow?token=demo_{order_id}",
                "amount": amount,
                "currency": currency,
                "status": "created"
            }
        
        try:
            if not self.access_token:
                self.access_token = self._get_access_token()
            
            if not self.access_token:
                return {"success": False, "error": "Failed to authenticate"}
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.access_token}"
            }
            
            payload = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": order_id,
                    "description": description or f"Order {order_id}",
                    "amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}"
                    }
                }],
                "application_context": {
                    "return_url": return_url or "https://your-store.com/order-success",
                    "cancel_url": cancel_url or "https://your-store.com/checkout",
                    "brand_name": "LuxeBoutique",
                    "landing_page": "BILLING",
                    "user_action": "PAY_NOW"
                }
            }
            
            response = requests.post(
                f"{base_url}/v2/checkout/orders",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 201:
                data = response.json()
                
                # Trouver l'URL d'approbation
                approval_url = None
                for link in data.get("links", []):
                    if link.get("rel") == "approve":
                        approval_url = link.get("href")
                        break
                
                logger.info(f"✓ PayPal order created: {data.get('id')}")
                
                return {
                    "success": True,
                    "order_id": data.get("id"),
                    "approval_url": approval_url,
                    "amount": amount,
                    "currency": currency,
                    "status": data.get("status")
                }
            else:
                logger.error(f"PayPal error: {response.text}")
                return {"success": False, "error": response.text}
                
        except Exception as e:
            logger.error(f"PayPal order creation failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def capture_order(self, paypal_order_id: str) -> Dict:
        """
        Capturer un paiement PayPal approuvé
        
        Documentation: https://developer.paypal.com/docs/api/orders/v2/#orders_capture
        """
        
        _, _, _, base_url, is_demo = self._get_config()
        if is_demo:
            return {
                "success": True,
                "demo_mode": True,
                "status": "completed",
                "amount": 100.00
            }
        
        try:
            if not self.access_token:
                self.access_token = self._get_access_token()
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.access_token}"
            }
            
            response = requests.post(
                f"{base_url}/v2/checkout/orders/{paypal_order_id}/capture",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 201:
                data = response.json()
                return {
                    "success": True,
                    "status": data.get("status"),
                    "capture_id": data.get("purchase_units", [{}])[0].get("payments", {}).get("captures", [{}])[0].get("id")
                }
            
            return {"success": False, "error": response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

paypal_service = PayPalService()
