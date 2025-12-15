import os
import requests
import logging
from typing import Dict, Optional
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

class PlisioService:
    """
    Service pour intégrer Plisio pour les paiements crypto
    Documentation: https://plisio.net/documentation/
    """
    
    def __init__(self):
        self.base_url = "https://plisio.net/api/v1"
        logger.info("Plisio initialized")

    def _get_api_key(self) -> str:
        return os.environ.get('PLISIO_API_KEY', 'your_plisio_api_key')

    def _is_demo(self, api_key: str) -> bool:
        return api_key == 'your_plisio_api_key' or not api_key or api_key.strip() == ""
    
    async def create_invoice(
        self,
        order_number: str,
        amount: float,
        currency: str = "BTC",  # Crypto to receive (BTC, ETH, LTC, etc.)
        source_currency: str = "USD",
        description: str = "",
        email: str = "",
        callback_url: str = ""
    ) -> Dict:
        """
        Créer une facture Plisio
        
        Endpoint: POST /invoices/new
        Documentation: https://plisio.net/documentation/endpoints/create-an-invoice
        
        Args:
            order_number: Numéro de commande unique
            amount: Montant en devise source
            currency: Devise crypto (BTC, ETH, USDT, etc.)
            source_currency: Devise source (USD, EUR, etc.)
            description: Description de la facture
            email: Email du client
            callback_url: URL de callback pour notifications
            
        Returns:
            Dict contenant l'URL de paiement et les détails
        """
        
        api_key = self._get_api_key()

        # Mode démo
        if self._is_demo(api_key):
            logger.info(f"📝 Plisio Demo Mode - Invoice Creation:")
            logger.info(f"Order: {order_number}")
            logger.info(f"Amount: {amount} {source_currency}")
            logger.info(f"Email: {email}")
            
            return {
                "success": True,
                "demo_mode": True,
                "invoice_id": f"demo_plisio_{order_number}",
                "invoice_url": f"https://plisio.net/invoice/demo_{order_number}",
                "amount": amount,
                "currency": currency,
                "source_currency": source_currency,
                "status": "new",
                "wallet_hash": f"demo_wallet_{order_number}",
                "qr_code": f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=plisio_demo_{order_number}",
                "instructions": {
                    "fr": "Démo Plisio - Accepte BTC, ETH, USDT, LTC et 50+ cryptos",
                    "en": "Plisio Demo - Accepts BTC, ETH, USDT, LTC and 50+ cryptocurrencies"
                }
            }
        
        # Mode production
        try:
            frontend_url = os.environ.get('FRONTEND_URL', 'https://luxury-shop-11.preview.emergentagent.com')
            
            params = {
                "source_currency": source_currency,
                "source_amount": str(amount),
                "order_number": order_number,
                "currency": currency,
                "email": email,
                "order_name": description,
                "callback_url": callback_url,
                "success_callback_url": f"{frontend_url}/order-success/{order_number}?payment=success",
                "fail_callback_url": f"{frontend_url}/checkout?payment=failed",
                "api_key": api_key
            }
            
            response = requests.get(
                f"{self.base_url}/invoices/new",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == "success":
                    result = data.get("data", {})
                    logger.info(f"✓ Plisio invoice created: {result.get('txn_id')}")
                    
                    return {
                        "success": True,
                        "invoice_id": result.get("txn_id"),
                        "invoice_url": result.get("invoice_url"),
                        "amount": result.get("amount"),
                        "currency": result.get("currency"),
                        "source_currency": source_currency,
                        "source_amount": amount,
                        "wallet_hash": result.get("wallet_hash"),
                        "status": result.get("status"),
                        "qr_code": result.get("qr_code")
                    }
                else:
                    logger.error(f"Plisio API error: {data.get('message')}")
                    return {
                        "success": False,
                        "error": data.get("message", "Failed to create invoice")
                    }
            else:
                logger.error(f"Plisio HTTP error: {response.status_code}")
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Plisio invoice creation failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_invoice_status(self, invoice_id: str) -> Dict:
        """
        Vérifier le statut d'une facture Plisio
        
        Endpoint: GET /operations
        
        Args:
            invoice_id: ID de la facture (txn_id)
            
        Returns:
            Dict contenant le statut
        """
        
        api_key = self._get_api_key()
        if self._is_demo(api_key):
            return {
                "success": True,
                "demo_mode": True,
                "invoice_id": invoice_id,
                "status": "completed",
                "amount": "100.00"
            }
        
        try:
            params = {
                "api_key": api_key,
                "id": invoice_id
            }
            
            response = requests.get(
                f"{self.base_url}/operations",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    operations = data.get("data", [])
                    if operations:
                        operation = operations[0]
                        return {
                            "success": True,
                            "invoice_id": invoice_id,
                            "status": operation.get("status"),
                            "amount": operation.get("amount"),
                            "tx_hash": operation.get("tx_hash")
                        }
            
            return {
                "success": False,
                "error": "Invoice not found"
            }
                
        except Exception as e:
            logger.error(f"Failed to get invoice status: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

# Initialize Plisio service
plisio_service = PlisioService()
