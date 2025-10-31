import os
import requests
import logging
from typing import Dict
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

class StripeService:
    """
    Service pour intégrer Stripe Payment Links
    Documentation: https://docs.stripe.com/payment-links/api
    """
    
    def __init__(self):
        # Load environment variables
        ROOT_DIR = Path(__file__).parent
        load_dotenv(ROOT_DIR / '.env')
        
        self.base_url = "https://api.stripe.com/v1"
        
        # Log initialization
        logger.info("Stripe Service initialized")
    
    def _get_api_keys(self):
        """Get API keys dynamically from environment (allows runtime updates)"""
        api_key = os.environ.get('STRIPE_SECRET_KEY', 'your_stripe_secret_key')
        publishable_key = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'your_stripe_publishable_key')
        is_demo = api_key == 'your_stripe_secret_key' or not api_key or api_key.strip() == ''
        
        return api_key, publishable_key, is_demo
    
    async def create_payment_link(
        self,
        order_id: str,
        amount: float,
        currency: str = "usd",
        description: str = "",
        customer_email: str = ""
    ) -> Dict:
        """
        Créer un lien de paiement Stripe
        
        Documentation: https://docs.stripe.com/api/payment_links/payment_links/create
        """
        
        # Get keys dynamically each time
        api_key, publishable_key, is_demo = self._get_api_keys()
        
        if is_demo:
            logger.info(f"💳 Stripe Demo Mode - Payment Link:")
            logger.info(f"Order: {order_id}, Amount: ${amount}")
            
            return {
                "success": True,
                "demo_mode": True,
                "payment_id": f"demo_stripe_{order_id}",
                "payment_url": f"https://checkout.stripe.com/demo/{order_id}",
                "amount": amount,
                "currency": currency,
                "status": "pending"
            }
        
        logger.info(f"Using Stripe API key: {api_key[:20]}... for order {order_id}")
        
        try:
            # Create product with order details
            product_data = {
                "name": description or f"Order {order_id}",
                "description": f"Payment for order {order_id}"
            }
            
            product_response = requests.post(
                f"{self.base_url}/products",
                auth=(api_key, ""),
                data=product_data,
                timeout=30
            )
            
            if product_response.status_code != 200:
                logger.error(f"Stripe product creation failed: {product_response.text}")
                return {"success": False, "error": f"Failed to create product: {product_response.text}"}
            
            product_id = product_response.json().get("id")
            
            # Créer un prix
            price_data = {
                "product": product_id,
                "unit_amount": int(amount * 100),  # Montant en centimes
                "currency": currency
            }
            
            price_response = requests.post(
                f"{self.base_url}/prices",
                auth=(api_key, ""),
                data=price_data,
                timeout=30
            )
            
            if price_response.status_code != 200:
                logger.error(f"Stripe price creation failed: {price_response.text}")
                return {"success": False, "error": f"Failed to create price: {price_response.text}"}
            
            price_id = price_response.json().get("id")
            
            # Créer le lien de paiement avec URLs de retour
            frontend_url = os.environ.get('FRONTEND_URL', 'https://luxury-shop-11.preview.emergentagent.com')
            
            payment_link_data = {
                "line_items[0][price]": price_id,
                "line_items[0][quantity]": 1,
                "metadata[order_id]": order_id,
                "customer_creation": "always",
                "after_completion[type]": "redirect",
                "after_completion[redirect][url]": f"{frontend_url}/order-success/{order_id}?payment=success"
            }
            
            # Note: customer_email is not supported in payment links API
            # Customer email will be collected during checkout
            
            link_response = requests.post(
                f"{self.base_url}/payment_links",
                auth=(api_key, ""),
                data=payment_link_data,
                timeout=30
            )
            
            if link_response.status_code == 200:
                data = link_response.json()
                logger.info(f"✓ Stripe payment link created: {data.get('id')}")
                
                return {
                    "success": True,
                    "payment_id": data.get("id"),
                    "payment_url": data.get("url"),
                    "amount": amount,
                    "currency": currency,
                    "status": "pending"
                }
            else:
                logger.error(f"Stripe payment link creation failed: {link_response.text}")
                return {"success": False, "error": f"Failed to create payment link: {link_response.text}"}
                
        except Exception as e:
            logger.error(f"Stripe payment link creation failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def verify_payment(self, session_id: str) -> Dict:
        """Vérifier le statut d'un paiement Stripe"""
        
        if self.is_demo:
            return {
                "success": True,
                "demo_mode": True,
                "status": "completed",
                "amount": 100.00
            }
        
        try:
            response = requests.get(
                f"{self.base_url}/checkout/sessions/{session_id}",
                auth=(self.api_key, ""),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "status": data.get("payment_status"),
                    "amount": data.get("amount_total", 0) / 100
                }
            
            return {"success": False, "error": "Session not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}

stripe_service = StripeService()
