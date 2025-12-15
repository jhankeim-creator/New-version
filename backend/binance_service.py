import os
import hmac
import hashlib
import time
import requests
import json
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class BinancePayService:
    """
    Service pour intégrer Binance Pay
    Documentation: https://developers.binance.com/docs/binance-pay/introduction
    """
    
    def __init__(self):
        self.base_url = "https://bpay.binanceapi.com"

    def _get_keys(self):
        api_key = os.environ.get('BINANCE_PAY_API_KEY', 'your_binance_pay_api_key')
        api_secret = os.environ.get('BINANCE_PAY_API_SECRET', 'your_binance_pay_api_secret')
        is_demo = api_key == 'your_binance_pay_api_key' or not api_key or api_key.strip() == ""
        return api_key, api_secret, is_demo
    
    def _generate_signature(self, timestamp: str, nonce: str, body: str) -> str:
        """Générer la signature HMAC SHA512"""
        _, api_secret, _ = self._get_keys()
        payload = f"{timestamp}\n{nonce}\n{body}\n"
        signature = hmac.new(
            api_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha512
        ).hexdigest().upper()
        return signature
    
    async def create_order(
        self,
        merchant_order_no: str,
        total_amount: float,
        currency: str = "USDT",
        description: str = "",
        buyer_email: str = ""
    ) -> Dict:
        """
        Créer une commande Binance Pay
        
        Documentation: https://developers.binance.com/docs/binance-pay/api-order-create-v2
        """
        
        api_key, _, is_demo = self._get_keys()
        if is_demo:
            logger.info(f"🟡 Binance Pay Demo Mode - Order Creation:")
            logger.info(f"Order: {merchant_order_no}, Amount: {total_amount} {currency}")
            
            return {
                "success": True,
                "demo_mode": True,
                "order_id": f"demo_binance_{merchant_order_no}",
                "checkout_url": f"https://pay.binance.com/checkout/demo_{merchant_order_no}",
                "qr_code": f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=binance_demo_{merchant_order_no}",
                "amount": total_amount,
                "currency": currency,
                "status": "INITIAL",
                "universal_url": {
                    "qrContent": f"binance://pay/demo_{merchant_order_no}",
                    "qrcodeLink": f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=binance_demo"
                }
            }
        
        try:
            timestamp = str(int(time.time() * 1000))
            nonce = str(int(time.time() * 1000000))
            
            payload = {
                "env": {
                    "terminalType": "WEB"
                },
                "merchantTradeNo": merchant_order_no,
                "orderAmount": total_amount,
                "currency": currency,
                "goods": {
                    "goodsType": "01",
                    "goodsCategory": "0000",
                    "referenceGoodsId": merchant_order_no,
                    "goodsName": description or f"Order {merchant_order_no}"
                },
                "buyer": {
                    "buyerEmail": buyer_email
                } if buyer_email else {}
            }
            
            body = json.dumps(payload)
            signature = self._generate_signature(timestamp, nonce, body)
            
            headers = {
                "Content-Type": "application/json",
                "BinancePay-Timestamp": timestamp,
                "BinancePay-Nonce": nonce,
                "BinancePay-Certificate-SN": api_key,
                "BinancePay-Signature": signature
            }
            
            response = requests.post(
                f"{self.base_url}/binancepay/openapi/v2/order",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("status") == "SUCCESS":
                    result = data.get("data", {})
                    logger.info(f"✓ Binance Pay order created: {result.get('prepayId')}")
                    
                    return {
                        "success": True,
                        "order_id": result.get("prepayId"),
                        "checkout_url": result.get("checkoutUrl"),
                        "qr_code": result.get("qrcodeLink"),
                        "amount": total_amount,
                        "currency": currency,
                        "status": "INITIAL",
                        "universal_url": result.get("universalUrl", {})
                    }
                else:
                    logger.error(f"Binance Pay error: {data.get('errorMessage')}")
                    return {
                        "success": False,
                        "error": data.get("errorMessage", "Failed to create order")
                    }
            else:
                return {"success": False, "error": response.text}
                
        except Exception as e:
            logger.error(f"Binance Pay order creation failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def query_order(self, merchant_order_no: str) -> Dict:
        """
        Vérifier le statut d'une commande Binance Pay
        
        Documentation: https://developers.binance.com/docs/binance-pay/api-order-query
        """
        
        api_key, _, is_demo = self._get_keys()
        if is_demo:
            return {
                "success": True,
                "demo_mode": True,
                "status": "SUCCESS",
                "amount": 100.00
            }
        
        try:
            timestamp = str(int(time.time() * 1000))
            nonce = str(int(time.time() * 1000000))
            
            payload = {
                "merchantTradeNo": merchant_order_no
            }
            
            body = json.dumps(payload)
            signature = self._generate_signature(timestamp, nonce, body)
            
            headers = {
                "Content-Type": "application/json",
                "BinancePay-Timestamp": timestamp,
                "BinancePay-Nonce": nonce,
                "BinancePay-Certificate-SN": api_key,
                "BinancePay-Signature": signature
            }
            
            response = requests.post(
                f"{self.base_url}/binancepay/openapi/v2/order/query",
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "SUCCESS":
                    result = data.get("data", {})
                    return {
                        "success": True,
                        "status": result.get("status"),
                        "amount": result.get("orderAmount")
                    }
            
            return {"success": False, "error": "Order not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}

binance_service = BinancePayService()
