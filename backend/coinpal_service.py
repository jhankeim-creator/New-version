import os
import hmac
import hashlib
import time
import requests
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class CoinPalService:
    """
    Service pour intégrer CoinPal.io pour les paiements crypto
    Documentation: https://docs.coinpal.io/
    """
    
    def __init__(self):
        self.base_url = "https://api.coinpal.io/v1"

    def _get_keys(self):
        api_key = os.environ.get('COINPAL_API_KEY', 'your_coinpal_api_key')
        api_secret = os.environ.get('COINPAL_API_SECRET', 'your_coinpal_api_secret')
        webhook_secret = os.environ.get('COINPAL_WEBHOOK_SECRET', 'your_webhook_secret')
        is_demo = api_key == 'your_coinpal_api_key' or not api_key or api_key.strip() == ""
        return api_key, api_secret, webhook_secret, is_demo
    
    def _generate_signature(self, payload: str) -> str:
        """Generate HMAC signature for API requests"""
        _, api_secret, _, _ = self._get_keys()
        return hmac.new(
            api_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    async def create_payment(
        self,
        order_id: str,
        amount: float,
        currency: str = "USD",
        description: str = "",
        customer_email: str = ""
    ) -> Dict:
        """
        Créer une demande de paiement CoinPal
        
        Args:
            order_id: ID de la commande
            amount: Montant en USD
            currency: Devise (USD par défaut)
            description: Description du paiement
            customer_email: Email du client
            
        Returns:
            Dict contenant l'URL de paiement et les détails
        """
        
        api_key, _, _, is_demo = self._get_keys()

        # Mode démo - retourner des données simulées
        if is_demo:
            logger.info(f"📝 CoinPal Demo Mode - Payment Request:")
            logger.info(f"Order ID: {order_id}")
            logger.info(f"Amount: ${amount} {currency}")
            logger.info(f"Customer: {customer_email}")
            
            return {
                "success": True,
                "demo_mode": True,
                "payment_id": f"demo_coinpal_{order_id}",
                "payment_url": f"https://demo.coinpal.io/pay/{order_id}",
                "amount": amount,
                "currency": currency,
                "status": "pending",
                "expires_at": int(time.time()) + 3600,  # 1 heure
                "qr_code": f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=demo_payment_{order_id}",
                "instructions": {
                    "fr": "Ceci est un paiement de démonstration. En production, le client sera redirigé vers CoinPal.io pour effectuer le paiement crypto.",
                    "en": "This is a demo payment. In production, the customer will be redirected to CoinPal.io to complete the crypto payment."
                }
            }
        
        # Mode production
        try:
            timestamp = str(int(time.time()))
            payload = {
                "order_id": order_id,
                "amount": str(amount),
                "currency": currency,
                "description": description,
                "customer_email": customer_email,
                "callback_url": f"{os.environ.get('BACKEND_URL', '')}/api/coinpal/webhook",
                "return_url": f"{os.environ.get('FRONTEND_URL', '')}/order-success/{order_id}",
                "timestamp": timestamp
            }
            
            # Générer la signature
            payload_string = "&".join([f"{k}={v}" for k, v in sorted(payload.items())])
            signature = self._generate_signature(payload_string)
            
            headers = {
                "X-API-KEY": api_key,
                "X-SIGNATURE": signature,
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.base_url}/payments/create",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✓ CoinPal payment created: {data.get('payment_id')}")
                return {
                    "success": True,
                    "payment_id": data.get("payment_id"),
                    "payment_url": data.get("payment_url"),
                    "amount": amount,
                    "currency": currency,
                    "status": "pending",
                    "expires_at": data.get("expires_at"),
                    "qr_code": data.get("qr_code")
                }
            else:
                logger.error(f"CoinPal API error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": "Failed to create payment",
                    "details": response.text
                }
                
        except Exception as e:
            logger.error(f"CoinPal payment creation failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def check_payment_status(self, payment_id: str) -> Dict:
        """
        Vérifier le statut d'un paiement CoinPal
        
        Args:
            payment_id: ID du paiement CoinPal
            
        Returns:
            Dict contenant le statut du paiement
        """
        
        api_key, _, _, is_demo = self._get_keys()
        if is_demo:
            return {
                "success": True,
                "demo_mode": True,
                "payment_id": payment_id,
                "status": "completed",
                "amount_received": "100.00",
                "currency": "USD"
            }
        
        try:
            timestamp = str(int(time.time()))
            params = f"payment_id={payment_id}&timestamp={timestamp}"
            signature = self._generate_signature(params)
            
            headers = {
                "X-API-KEY": api_key,
                "X-SIGNATURE": signature
            }
            
            response = requests.get(
                f"{self.base_url}/payments/{payment_id}",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "payment_id": payment_id,
                    "status": data.get("status"),
                    "amount_received": data.get("amount_received"),
                    "currency": data.get("currency"),
                    "transaction_hash": data.get("transaction_hash")
                }
            else:
                return {
                    "success": False,
                    "error": "Payment not found"
                }
                
        except Exception as e:
            logger.error(f"Failed to check payment status: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        """
        Vérifier la signature du webhook CoinPal
        
        Args:
            payload: Données du webhook
            signature: Signature reçue
            
        Returns:
            True si la signature est valide
        """
        expected_signature = self._generate_signature(payload)
        return hmac.compare_digest(expected_signature, signature)

# Initialize CoinPal service
coinpal_service = CoinPalService()
