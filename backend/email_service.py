import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
from datetime import datetime, timezone

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        self.smtp_user = os.environ.get('SMTP_USER', '')
        self.smtp_password = os.environ.get('SMTP_PASSWORD', '')
        self.from_email = os.environ.get('FROM_EMAIL', 'noreply@kayee01.com')
        self.from_name = os.environ.get('FROM_NAME', 'Kayee01')
        
        logger.info(f"EmailService initialized - SMTP User: {self.smtp_user}, Host: {self.smtp_host}")
    
    async def send_email(self, to_email: str, subject: str, html_content: str):
        """Send an email using SMTP"""
        try:
            logger.info(f"Attempting to send email to {to_email}")
            logger.info(f"SMTP Config: {self.smtp_host}:{self.smtp_port}, User: {self.smtp_user}")
            
            message = MIMEMultipart('alternative')
            message['From'] = f"{self.from_name} <{self.from_email}>"
            message['To'] = to_email
            message['Subject'] = subject
            
            html_part = MIMEText(html_content, 'html')
            message.attach(html_part)
            
            # Send actual email in production
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                start_tls=True,
                username=self.smtp_user,
                password=self.smtp_password
            )
            logger.info(f"✓ Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    async def send_order_confirmation(self, order_data: dict):
        """Send order confirmation email"""
        subject = f"Order Confirmation - {order_data['order_number']}"
        
        items_html = ""
        for item in order_data['items']:
            items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>{item['name']}</strong><br>
                    Quantity: {item['quantity']}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                    ${item['price'] * item['quantity']:.2f}
                </td>
            </tr>
            """
        
        # Payment instructions based on method
        payment_instructions = ""
        payment_method = order_data.get('payment_method', '')
        payment_gateway_instructions = order_data.get('payment_gateway_instructions', '')
        payment_gateway_name = order_data.get('payment_gateway_name', '')
        
        # Check if it's a custom manual payment gateway
        if payment_method.startswith('manual-') and payment_gateway_instructions:
            payment_instructions = f"""
            <div style="margin: 30px 0; padding: 20px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 5px;">
                <h3 style="color: #1976d2; margin-top: 0;">💰 Payment Instructions - {payment_gateway_name}</h3>
                <div style="white-space: pre-wrap; margin: 15px 0; line-height: 1.6;">{payment_gateway_instructions}</div>
                <p><strong>Amount to Pay:</strong> <span style="color: #d4af37; font-size: 20px;">${order_data['total']:.2f}</span></p>
                <p><strong>Order Reference:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 3px; font-size: 16px;">{order_data['order_number']}</code></p>
                <p style="background: #fff3cd; padding: 10px; border-radius: 3px; margin-top: 15px;">
                    <strong>⚠️ Important:</strong> Please include your order number <strong>{order_data['order_number']}</strong> as reference when making payment.
                </p>
            </div>
            """
        elif payment_method == 'manual':
            payment_instructions = f"""
            <div style="margin: 30px 0; padding: 20px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 5px;">
                <h3 style="color: #1976d2; margin-top: 0;">💰 Manual Payment Instructions</h3>
                <p><strong>Payoneer Email:</strong> <span style="color: #2196f3;">kayicom509@gmail.com</span></p>
                <p><strong>Name:</strong> Anson</p>
                <p><strong>Amount to Pay:</strong> <span style="color: #d4af37; font-size: 20px;">${order_data['total']:.2f}</span></p>
                <p><strong>Order Reference:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 3px; font-size: 16px;">{order_data['order_number']}</code></p>
                <p style="background: #fff3cd; padding: 10px; border-radius: 3px; margin-top: 15px;">
                    <strong>⚠️ Important:</strong> After payment, send proof (screenshot) via WhatsApp (+12393293813) with your order number <strong>{order_data['order_number']}</strong>.
                </p>
            </div>
            """
        elif payment_method == 'stripe' and order_data.get('stripe_payment_url'):
            payment_instructions = f"""
            <div style="margin: 30px 0; padding: 20px; background: #f3e5f5; border-left: 4px solid #9c27b0; border-radius: 5px;">
                <h3 style="color: #7b1fa2; margin-top: 0;">💳 Complete Your Stripe Payment</h3>
                <p>Click the link below to pay securely:</p>
                <p style="text-align: center;">
                    <a href="{order_data['stripe_payment_url']}" 
                       style="display: inline-block; padding: 12px 30px; background: #635bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Pay with Stripe
                    </a>
                </p>
            </div>
            """
        elif payment_method == 'plisio' and order_data.get('plisio_invoice_url'):
            payment_instructions = f"""
            <div style="margin: 30px 0; padding: 20px; background: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 5px;">
                <h3 style="color: #388e3c; margin-top: 0;">💰 Complete Your Crypto Payment (Plisio)</h3>
                <p>Click the link below to pay with 100+ cryptocurrencies:</p>
                <p style="text-align: center;">
                    <a href="{order_data['plisio_invoice_url']}" 
                       style="display: inline-block; padding: 12px 30px; background: #4caf50; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Pay with Plisio
                    </a>
                </p>
            </div>
            """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif;">
                        <span style="color: #d4af37;">Kayee</span>01
                    </h1>
                </div>
                
                <div style="padding: 30px 20px;">
                    <h2 style="color: #d4af37;">Thank you for your order!</h2>
                    <p>Hello <strong>{order_data['user_name']}</strong>,</p>
                    <p>We have received your order. Here are the details:</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Order Number:</strong> {order_data['order_number']}</p>
                        <p><strong>Payment Method:</strong> {order_data['payment_method']}</p>
                        <p><strong>Status:</strong> {order_data.get('order_status', order_data.get('status', 'pending'))}</p>
                    </div>
                    
                    <h3>Ordered Items:</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        {items_html}
                        <tr>
                            <td style="padding: 15px 10px; text-align: right; font-size: 18px;">
                                <strong>Total :</strong>
                            </td>
                            <td style="padding: 15px 10px; text-align: right; font-size: 18px; color: #d4af37;">
                                <strong>${order_data['total']:.2f}</strong>
                            </td>
                        </tr>
                    </table>
                    
                    {payment_instructions}
                    <h3>Adresse de livraison :</h3>
                    <p>
                        {order_data['shipping_address'].get('street', order_data['shipping_address'].get('address', ''))}<br>
                        {order_data['shipping_address']['city']}, {order_data['shipping_address']['postal_code']}<br>
                        {order_data['shipping_address']['country']}
                    </p>
                    
                    <div style="margin: 30px 0; padding: 20px; background: #fff8e1; border-left: 4px solid #d4af37;">
                        <p style="margin: 0;"><strong>Suivez votre commande :</strong></p>
                        <p style="margin: 10px 0 0 0;">
                            Vous pouvez suivre votre commande à tout moment avec le numéro : 
                            <strong>{order_data['order_number']}</strong>
                        </p>
                    </div>
                    
                    <p>If you have any questions, feel free to contact us via WhatsApp.</p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; color: #666; font-size: 12px;">
                    <p>© 2025 Kayee01. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(order_data['user_email'], subject, html_content)
    
    
    async def send_tracking_update(self, user_email: str, order_number: str, tracking_number: str, carrier: str):
        """Send tracking number update email"""
        subject = f"Tracking Information - Order {order_number}"
        
        carrier_links = {
            'fedex': f'https://www.fedex.com/fedextrack/?trknbr={tracking_number}',
            'usps': f'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}'
        }
        
        tracking_url = carrier_links.get(carrier.lower(), '#')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif;">
                        <span style="color: #d4af37;">Kayee</span>01
                    </h1>
                </div>
                
                <div style="padding: 30px 20px;">
                    <h2 style="color: #d4af37;">📦 Your Order Has Been Shipped!</h2>
                    <p>Great news! Your order <strong>{order_number}</strong> is on its way.</p>
                    
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">Tracking Information:</h3>
                        <p><strong>Carrier:</strong> {carrier.upper()}</p>
                        <p><strong>Tracking Number:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 3px;">{tracking_number}</code></p>
                    </div>
                    
                    <p style="text-align: center;">
                        <a href="{tracking_url}" 
                           style="display: inline-block; padding: 12px 30px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Track Your Package
                        </a>
                    </p>
                    
                    <p style="margin-top: 30px;">Estimated delivery: 5-7 business days</p>
                    <p>If you have any questions, feel free to contact us.</p>
                    <p>Best regards,<br>The Kayee01 Team</p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; color: #666; font-size: 12px;">
                    <p>© 2025 Kayee01. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(user_email, subject, html_content)

    async def send_invoice(self, order_data: dict):
        """Send professional invoice from Kayee01 website"""
        subject = f"Invoice #{order_data['order_number']} - Kayee01"
        
        items_html = ""
        subtotal = 0
        for item in order_data['items']:
            item_total = item['price'] * item['quantity']
            subtotal += item_total
            items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>{item['name']}</strong><br>
                    <span style="color: #666; font-size: 12px;">SKU: {item.get('product_id', 'N/A')}</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item['quantity']}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item['price']:.2f}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item_total:.2f}</td>
            </tr>
            """
        
        # Calculate discounts
        crypto_discount_html = ""
        if order_data.get('crypto_discount', 0) > 0:
            crypto_discount_html = f"""
            <tr>
                <td colspan="3" style="padding: 10px; text-align: right; color: green;">Crypto Discount (15%):</td>
                <td style="padding: 10px; text-align: right; color: green; font-weight: bold;">-${order_data['crypto_discount']:.2f}</td>
            </tr>
            """
        
        discount_html = ""
        if order_data.get('discount_amount', 0) > 0:
            discount_html = f"""
            <tr>
                <td colspan="3" style="padding: 10px; text-align: right; color: green;">Coupon Discount{' (' + order_data.get('coupon_code', '') + ')' if order_data.get('coupon_code') else ''}:</td>
                <td style="padding: 10px; text-align: right; color: green; font-weight: bold;">-${order_data['discount_amount']:.2f}</td>
            </tr>
            """
        
        shipping_html = ""
        shipping_cost = order_data.get('shipping_cost', 0)
        if shipping_cost > 0:
            shipping_method = order_data.get('shipping_method', 'standard').upper()
            shipping_html = f"""
            <tr>
                <td colspan="3" style="padding: 10px; text-align: right;">Shipping ({shipping_method}):</td>
                <td style="padding: 10px; text-align: right;">${shipping_cost:.2f}</td>
            </tr>
            """
        else:
            shipping_html = f"""
            <tr>
                <td colspan="3" style="padding: 10px; text-align: right;">Shipping:</td>
                <td style="padding: 10px; text-align: right; color: green; font-weight: bold;">FREE</td>
            </tr>
            """
        
        # Shipping address
        shipping_addr = order_data.get('shipping_address', {})
        address_html = f"""
        {shipping_addr.get('street', shipping_addr.get('address', ''))}<br>
        {shipping_addr.get('city', '')}, {shipping_addr.get('postal_code', '')}<br>
        {shipping_addr.get('country', '')}
        """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 700px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 3px solid #d4af37;">
                    <div>
                        <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 32px;">
                            <span style="color: #d4af37;">Kayee</span><span style="color: #1a1a1a;">01</span>
                        </h1>
                        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Luxury-Inspired Fashion & Accessories</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 28px;">INVOICE</h2>
                        <p style="margin: 5px 0; font-size: 14px;"><strong>#{order_data['order_number']}</strong></p>
                    </div>
                </div>
                
                <!-- Invoice Info -->
                <div style="margin: 30px 0; display: flex; justify-content: space-between;">
                    <div>
                        <p style="margin: 0; font-weight: bold; color: #1a1a1a;">Bill To:</p>
                        <p style="margin: 5px 0;"><strong>{order_data['user_name']}</strong></p>
                        <p style="margin: 5px 0; font-size: 14px;">{order_data['user_email']}</p>
                        <p style="margin: 5px 0; font-size: 14px;">{order_data.get('phone', 'N/A')}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-weight: bold; color: #1a1a1a;">Ship To:</p>
                        <p style="margin: 5px 0; font-size: 14px;">{address_html}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 5px 0; font-size: 14px;"><strong>Payment Method:</strong></p>
                        <p style="margin: 5px 0; font-size: 14px; text-transform: uppercase;">{order_data['payment_method']}</p>
                        <p style="margin: 10px 0 5px 0; font-size: 14px;"><strong>Status:</strong></p>
                        <p style="margin: 5px 0; padding: 5px 10px; background: #4caf50; color: white; border-radius: 3px; font-size: 12px; display: inline-block;">PAID</p>
                    </div>
                </div>
                
                <!-- Items Table -->
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #1a1a1a; color: white;">
                            <th style="padding: 12px; text-align: left;">Product</th>
                            <th style="padding: 12px; text-align: center; width: 80px;">Qty</th>
                            <th style="padding: 12px; text-align: right; width: 100px;">Price</th>
                            <th style="padding: 12px; text-align: right; width: 100px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">${subtotal:.2f}</td>
                        </tr>
                        {crypto_discount_html}
                        {discount_html}
                        {shipping_html}
                        <tr style="background: #f9f9f9; border-top: 2px solid #d4af37;">
                            <td colspan="3" style="padding: 15px; text-align: right; font-size: 18px; font-weight: bold;">TOTAL:</td>
                            <td style="padding: 15px; text-align: right; font-size: 20px; font-weight: bold; color: #d4af37;">${order_data['total']:.2f}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <!-- Footer Notes -->
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="margin: 0; font-size: 14px; color: #4caf50; font-weight: bold;">✓ Payment Confirmed - Thank you for your purchase!</p>
                    <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">Your order will be processed and shipped within 5-7 business days. You'll receive tracking information once your package ships.</p>
                </div>
                
                <!-- Contact Info -->
                <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                    <p style="margin: 0; font-size: 13px; color: #666;"><strong>Questions?</strong> Contact us:</p>
                    <p style="margin: 5px 0; font-size: 13px; color: #666;">📧 Email: kayee01.shop@gmail.com</p>
                    <p style="margin: 5px 0; font-size: 13px; color: #666;">📱 WhatsApp: +12393293813</p>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="margin: 0; font-size: 11px; color: #999;">© 2025 Kayee01. All rights reserved.</p>
                    <p style="margin: 5px 0; font-size: 11px; color: #999;">This is an official invoice from Kayee01</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(order_data['user_email'], subject, html_content)


    async def send_order_status_update(self, order_data: dict, old_status: str):
        """Send order status update email"""
        status_messages = {
            'processing': '🔄 Votre commande est en cours de traitement',
            'shipped': '📦 Votre commande a été expédiée',
            'delivered': '✅ Votre commande a été livrée',
            'cancelled': '❌ Votre commande a été annulée'
        }
        
        status_descriptions = {
            'processing': 'Nous préparons votre commande avec soin.',
            'shipped': 'Votre colis est en route ! Vous devriez le recevoir dans les prochains jours.',
            'delivered': 'Votre commande a été livrée avec succès. Nous espérons que vous êtes satisfait(e) !',
            'cancelled': 'Votre commande a été annulée. Si vous avez des questions, contactez-nous.'
        }
        
        subject = f"Mise à jour de commande - {order_data['order_number']}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif;">
                        <span style="color: #d4af37;">Luxe</span>Boutique
                    </h1>
                </div>
                
                <div style="padding: 30px 20px;">
                    <h2 style="color: #d4af37;">{status_messages.get(order_data.get('order_status', order_data.get('status', 'pending')), 'Mise à jour de commande')}</h2>
                    <p>Bonjour <strong>{order_data['user_name']}</strong>,</p>
                    
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
                        <p style="font-size: 18px; margin: 0;">
                            {status_descriptions.get(order_data.get('order_status', order_data.get('status', 'pending')), 'Le statut de votre commande a été mis à jour.')}
                        </p>
                    </div>
                    
                    <div style="background: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Numéro de commande :</strong> {order_data['order_number']}</p>
                        <p><strong>Ancien statut :</strong> {old_status}</p>
                        <p><strong>Nouveau statut :</strong> <span style="color: #d4af37; font-weight: bold;">{order_data.get('order_status', order_data.get('status', 'pending'))}</span></p>
                        <p><strong>Total :</strong> ${order_data['total']:.2f}</p>
                    </div>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="https://your-store.com/track-order" 
                           style="display: inline-block; padding: 12px 30px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Suivre ma commande
                        </a>
                    </p>
                    
                    <p>If you have any questions, feel free to contact us.</p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; color: #666; font-size: 12px;">
                    <p>© 2025 Kayee01. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(order_data['user_email'], subject, html_content)
    
    async def send_payment_confirmation(self, order_data: dict):
        """Send payment confirmation email"""
        subject = f"Paiement confirmé - {order_data['order_number']}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif;">
                        <span style="color: #d4af37;">Luxe</span>Boutique
                    </h1>
                </div>
                
                <div style="padding: 30px 20px;">
                    <h2 style="color: #28a745;">✅ Paiement confirmé !</h2>
                    <p>Bonjour <strong>{order_data['user_name']}</strong>,</p>
                    <p>Nous avons bien reçu votre paiement pour la commande <strong>{order_data['order_number']}</strong>.</p>
                    
                    <div style="background: #d4edda; padding: 20px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0;">
                        <p style="margin: 0; font-size: 18px;">
                            Montant payé : <strong style="color: #d4af37;">${order_data['total']:.2f}</strong>
                        </p>
                        <p style="margin: 10px 0 0 0;">
                            Méthode : <strong>{order_data['payment_method']}</strong>
                        </p>
                    </div>
                    
                    <p>Votre commande est maintenant en cours de traitement. Nous vous tiendrons informé(e) de son avancement.</p>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="https://your-store.com/track-order" 
                           style="display: inline-block; padding: 12px 30px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Suivre ma commande
                        </a>
                    </p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; color: #666; font-size: 12px;">
                    <p>© 2025 Kayee01. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(order_data['user_email'], subject, html_content)
    
    async def send_password_reset_email(self, to_email: str, reset_token: str):
        """Send password reset email"""
        reset_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}"
        subject = "Password Reset Request - Kayee01"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif;">
                        <span style="color: #d4af37;">Kayee</span>01
                    </h1>
                </div>
                
                <div style="padding: 30px 20px;">
                    <h2 style="color: #d4af37;">🔒 Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password. Click the button below to reset it:</p>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" 
                           style="display: inline-block; padding: 15px 40px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                            Reset Password
                        </a>
                    </p>
                    
                    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                    <p style="background: #f5f5f5; padding: 10px; border-radius: 3px; word-break: break-all; font-size: 13px;">
                        {reset_url}
                    </p>
                    
                    <div style="margin: 30px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 5px;">
                        <p style="margin: 0; color: #856404;">
                            <strong>⚠️ Important:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
                        </p>
                    </div>
                    
                    <p>Best regards,<br>The Kayee01 Team</p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; color: #666; font-size: 12px;">
                    <p>© 2025 Kayee01. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(to_email, subject, html_content)
    
    async def send_welcome_email(self, to_email: str, user_name: str):
        """Send welcome email after registration"""
        subject = "Welcome to Kayee01 - Luxury 1:1 Replica Watches & Accessories"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif;">
                        <span style="color: #d4af37;">Kayee</span>01
                    </h1>
                </div>
                
                <div style="padding: 30px 20px;">
                    <h2 style="color: #d4af37;">🎉 Welcome to Kayee01!</h2>
                    <p>Hello <strong>{user_name}</strong>,</p>
                    <p>Thank you for joining Kayee01 - your destination for high-quality 1:1 replica luxury watches, clothing, and accessories.</p>
                    
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1a1a1a;">What's Next?</h3>
                        <ul style="padding-left: 20px;">
                            <li>Browse our exclusive collection of luxury replicas</li>
                            <li>Enjoy secure checkout with multiple payment options</li>
                            <li>Get 15% OFF when paying with cryptocurrency</li>
                            <li>Track your orders in real-time</li>
                        </ul>
                    </div>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/shop" 
                           style="display: inline-block; padding: 15px 40px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                            Start Shopping
                        </a>
                    </p>
                    
                    <div style="margin: 30px 0; padding: 20px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 5px;">
                        <p style="margin: 0; color: #1976d2;"><strong>💡 Need Help?</strong></p>
                        <p style="margin: 10px 0 0 0; color: #1976d2;">Contact us via WhatsApp: +12393293813</p>
                        <p style="margin: 5px 0 0 0; color: #1976d2;">Email: kayee01.shop@gmail.com</p>
                    </div>
                    
                    <p>Best regards,<br>The Kayee01 Team</p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; color: #666; font-size: 12px;">
                    <p>© 2025 Kayee01. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(to_email, subject, html_content)
    
    async def send_bulk_promotional_email(self, to_email: str, subject: str, message: str):
        """Send bulk promotional/coupon email"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif;">
                        <span style="color: #d4af37;">Kayee</span>01
                    </h1>
                </div>
                
                <div style="padding: 30px 20px;">
                    <div style="white-space: pre-wrap;">{message}</div>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/shop" 
                           style="display: inline-block; padding: 15px 40px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                            Shop Now
                        </a>
                    </p>
                    
                    <div style="margin: 30px 0; padding: 20px; background: #fff8e1; border-left: 4px solid #d4af37; border-radius: 5px;">
                        <p style="margin: 0; color: #856404;"><strong>💎 Why Choose Kayee01?</strong></p>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404;">
                            <li>High-quality 1:1 replicas</li>
                            <li>15% OFF with cryptocurrency</li>
                            <li>Fast & secure shipping worldwide</li>
                        </ul>
                    </div>
                    
                    <p style="text-align: center; font-size: 14px; color: #666; margin-top: 30px;">
                        Contact us: 📱 WhatsApp +12393293813 | 📧 kayee01.shop@gmail.com
                    </p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; color: #666; font-size: 12px;">
                    <p>© 2025 Kayee01. All rights reserved.</p>
                    <p style="margin: 5px 0 0 0; font-size: 11px;">
                        You received this email because you're a valued Kayee01 customer.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        await self.send_email(to_email, subject, html_content)
    
    async def send_admin_new_order_notification(self, order_data: dict):
        """Send notification to admin when new order is placed"""
        admin_emails = ["kayicom509@gmail.com", "Info.kayicom.com@gmx.fr"]
        subject = f"🔔 New Order - {order_data['order_number']}"
        
        # Build items list
        items_html = ""
        for item in order_data['items']:
            items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>{item['name']}</strong><br>
                    <span style="color: #666; font-size: 12px;">Quantité: {item['quantity']}</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                    ${item['price'] * item['quantity']:.2f}
                </td>
            </tr>
            """
        
        # Payment method display
        payment_method_display = {
            'manual': '💵 Paiement Manuel (Payoneer)',
            'stripe': '💳 Stripe',
            'plisio': '🪙 Crypto (Plisio)',
            'paypal': '💰 PayPal'
        }
        
        payment_display = payment_method_display.get(order_data.get('payment_method', ''), order_data.get('payment_method', 'N/A'))
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 700px; margin: 0 auto; padding: 20px; border: 2px solid #d4af37; border-radius: 10px;">
                <div style="text-align: center; padding: 20px; background: #1a1a1a; color: white; border-radius: 8px;">
                    <h1 style="margin: 0; font-family: 'Playfair Display', serif; font-size: 32px;">
                        🔔 <span style="color: #d4af37;">NEW ORDER</span>
                    </h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px; color: #d4af37;">Kayee01 Admin</p>
                </div>
                
                <div style="padding: 30px 20px; background: #f9f9f9; margin: 20px 0; border-radius: 8px;">
                    <h2 style="color: #d4af37; margin-top: 0; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
                        📋 Order Details
                    </h2>
                    
                    <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
                        <p style="margin: 5px 0;"><strong>Order Number:</strong> <span style="color: #d4af37; font-size: 18px;">{order_data['order_number']}</span></p>
                        <p style="margin: 5px 0;"><strong>Date:</strong> {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M:%S')} UTC</p>
                        <p style="margin: 5px 0;"><strong>Status:</strong> <span style="background: #ffc107; color: #000; padding: 3px 10px; border-radius: 3px; font-weight: bold;">{order_data.get('order_status', order_data.get('status', 'pending')).upper()}</span></p>
                        <p style="margin: 5px 0;"><strong>Payment Method:</strong> {payment_display}</p>
                    </div>
                    
                    <h3 style="color: #1a1a1a; margin-top: 30px;">👤 Customer Information</h3>
                    <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p style="margin: 5px 0;"><strong>Name:</strong> {order_data['user_name']}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:{order_data['user_email']}" style="color: #2196f3;">{order_data['user_email']}</a></p>
                        <p style="margin: 5px 0;"><strong>Phone:</strong> {order_data.get('phone', 'N/A')}</p>
                    </div>
                    
                    <h3 style="color: #1a1a1a; margin-top: 30px;">📦 Ordered Items</h3>
                    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 5px; overflow: hidden;">
                        {items_html}
                        <tr style="background: #f5f5f5; font-weight: bold;">
                            <td style="padding: 15px; text-align: right; font-size: 18px;">TOTAL:</td>
                            <td style="padding: 15px; text-align: right; font-size: 20px; color: #d4af37;">
                                ${order_data['total']:.2f}
                            </td>
                        </tr>
                    </table>
                    
                    <h3 style="color: #1a1a1a; margin-top: 30px;">🚚 Shipping Address</h3>
                    <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p style="margin: 5px 0;">{order_data['shipping_address'].get('street', order_data['shipping_address'].get('address', ''))}</p>
                        <p style="margin: 5px 0;">{order_data['shipping_address']['city']}, {order_data['shipping_address']['postal_code']}</p>
                        <p style="margin: 5px 0;"><strong>{order_data['shipping_address']['country']}</strong></p>
                    </div>
                    
                    <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 5px;">
                        <p style="margin: 0; color: #1976d2; font-weight: bold;">⚡ Action Required:</p>
                        <p style="margin: 10px 0 0 0; color: #1976d2;">
                            Please process this order as soon as possible. Login to admin panel for more details.
                        </p>
                    </div>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/admin/login" 
                           style="display: inline-block; padding: 15px 40px; background: #d4af37; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                            View in Admin
                        </a>
                    </p>
                </div>
                
                <div style="text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #666;">© 2025 Kayee01 - Admin Notification System</p>
                    <p style="margin: 5px 0; font-size: 11px; color: #999;">This email was sent automatically</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Send to both admin emails
        for admin_email in admin_emails:
            try:
                await self.send_email(admin_email, subject, html_content)
                logger.info(f"✓ Admin notification sent to {admin_email}")
            except Exception as e:
                logger.error(f"✗ Failed to send admin notification to {admin_email}: {str(e)}")

# Initialize email service
email_service = EmailService()
