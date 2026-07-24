import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Package, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import Footer from '../components/Footer';
import axios from 'axios';
import { fetchWhatsappSettings, buildWaLink, DEFAULT_WHATSAPP } from '../lib/whatsapp';

const OrderSuccessPage = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [whatsapp, setWhatsapp] = useState(DEFAULT_WHATSAPP);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    loadOrder();
    fetchWhatsappSettings(API).then(setWhatsapp);
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const response = await axios.get(`${API}/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to load order:', error);
    } finally {
      setLoading(false);
    }
  };

  const primaryContact = (whatsapp.buttons && whatsapp.buttons[0]) || null;
  const whatsappNumber = primaryContact ? primaryContact.number : '';
  const whatsappLink = buildWaLink(
    whatsappNumber,
    `Hi, I have a question about order ${order?.order_number || ''}`
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Success Message */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h1
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Playfair Display' }}
              data-testid="success-title"
            >
              Order Placed Successfully!
            </h1>
            <p className="text-gray-600 text-lg">
              Thank you for your order. We'll send you a confirmation email shortly.
            </p>
          </div>

          {/* Order Details */}
          {order && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Order Number</p>
                    <p className="font-bold text-lg" data-testid="order-number">{order.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="font-bold text-lg text-[#d4af37]" data-testid="order-amount">${order.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className="font-semibold capitalize">{order.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-semibold capitalize text-yellow-600">{order.status}</p>
                  </div>
                </div>

                {/* Payment Instructions */}
                {order.payment_method !== 'manual' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold mb-2">💳 Complete Your Payment</h3>
                    
                    {/* Stripe */}
                    {order.payment_method === 'stripe' && order.stripe_payment_url && (
                      <div className="text-sm space-y-3">
                        <p>Pay securely with your credit card:</p>
                        <a
                          href={order.stripe_payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block w-full text-center bg-[#635bff] hover:bg-[#5349e0] text-white font-semibold py-3 px-6 rounded"
                        >
                          Pay with Stripe
                        </a>
                      </div>
                    )}
                    
                    {/* Plisio */}
                    {order.payment_method === 'plisio' && order.plisio_invoice_url && (
                      <div className="text-sm space-y-3">
                        <p>Pay with 100+ cryptocurrencies via Plisio:</p>
                        {order.plisio_qr_code && (
                          <div className="flex justify-center">
                            <img src={order.plisio_qr_code} alt="QR Code" className="w-48 h-48" />
                          </div>
                        )}
                        {order.plisio_wallet_hash && (
                          <div className="bg-white p-3 rounded border">
                            <p className="text-xs font-mono break-all">{order.plisio_wallet_hash}</p>
                          </div>
                        )}
                        <a
                          href={order.plisio_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded"
                        >
                          Pay with Plisio
                        </a>
                      </div>
                    )}

                    {/* Demo mode message removed - production only */}
                  </div>
                )}

                {/* Manual Payment */}
                {order.payment_method === 'manual' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h3 className="font-bold text-lg mb-4 text-blue-900">💰 Manual Payment</h3>
                    <div className="text-sm space-y-3">
                      <div className="bg-yellow-100 p-4 rounded border border-yellow-300">
                        <p className="font-bold text-yellow-900 mb-3 text-center text-lg">📧 Payment instructions sent to your email</p>
                        <p className="text-gray-800 text-center">Check your inbox: <strong>{order.user_email}</strong></p>
                      </div>
                      
                      <div className="bg-white p-4 rounded border border-blue-200">
                        <p className="font-semibold text-gray-800 mb-2">📋 Order Details:</p>
                        <p className="text-gray-700">Order Number: <strong>{order.order_number}</strong></p>
                        <p className="text-gray-700">Total Amount: <strong className="text-[#d4af37] text-lg">${order.total.toFixed(2)}</strong></p>
                        <p className="text-gray-700 mt-3">Delivery: <strong>5-7 business days</strong></p>
                      </div>
                      
                      <div className="bg-green-50 p-4 rounded border border-green-200 mt-3">
                        <p className="text-gray-700 text-center">
                          Need help? Contact us on WhatsApp: <strong>{whatsappNumber}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div>
                  <h3 className="font-semibold mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex gap-3 pb-3 border-b last:border-b-0">
                        <img src={item.image} alt={item.name} className="w-16 h-16 object-cover" />
                        <div className="flex-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                          <p className="text-sm font-bold text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/track-order">
              <Button variant="outline" className="w-full sm:w-auto">
                <Package className="mr-2 h-4 w-4" />
                Track Order
              </Button>
            </Link>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </a>
            <Link to="/shop">
              <Button className="w-full sm:w-auto bg-[#d4af37] hover:bg-[#b8941f] text-white">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default OrderSuccessPage;