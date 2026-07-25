import { useState } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { Search, Package, Truck, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'sonner';

const TrackOrderPage = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      toast.error('Please enter an order number');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/orders/track/${orderNumber.trim()}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to track order:', error);
      toast.error('Order not found. Please check your order number.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Package className="h-8 w-8 text-yellow-600" />;
      case 'processing':
        return <Package className="h-8 w-8 text-blue-600" />;
      case 'shipped':
        return <Truck className="h-8 w-8 text-purple-600" />;
      case 'delivered':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      default:
        return <Package className="h-8 w-8 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1
            className="text-4xl md:text-5xl font-bold text-center mb-8"
            style={{ fontFamily: 'Playfair Display' }}
            data-testid="track-order-title"
          >
            Track Your Order
          </h1>
          <p className="text-center text-gray-600 mb-12 text-lg">
            Enter your order number to track your package
          </p>

          {/* Search Form */}
          <Card className="mb-12">
            <CardContent className="p-6">
              <form onSubmit={handleTrack} className="flex gap-4">
                <Input
                  type="text"
                  placeholder="Enter order number (e.g., ORD-12345678)"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="flex-1"
                  data-testid="order-number-input"
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#d4af37] hover:bg-[#b8941f] text-white"
                  data-testid="track-button"
                >
                  {loading ? 'Tracking...' : 'Track'}
                  <Search className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Order Details */}
          {order && (
            <Card data-testid="order-details">
              <CardContent className="p-6">
                {/* Order Header */}
                <div className="text-center mb-8">
                  {getStatusIcon(order.status)}
                  <h2 className="text-2xl font-bold mt-4 mb-2" style={{ fontFamily: 'Playfair Display' }}>
                    Order {order.order_number}
                  </h2>
                  <p className="text-lg capitalize font-semibold text-[#d4af37]">
                    Status: {order.status}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Payment: <span className="capitalize">{order.payment_status}</span>
                  </p>
                </div>

                {/* Order Progress */}
                <div className="mb-8">
                  <div className="flex justify-between items-center relative">
                    <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 z-0" />
                    <div
                      className="absolute top-5 left-0 h-1 bg-[#d4af37] z-0 transition-all duration-500"
                      style={{
                        width:
                          order.status === 'pending'
                            ? '0%'
                            : order.status === 'processing'
                            ? '33%'
                            : order.status === 'shipped'
                            ? '66%'
                            : '100%',
                      }}
                    />
                    {['pending', 'processing', 'shipped', 'delivered'].map((status, idx) => (
                      <div key={status} className="flex flex-col items-center z-10">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            order.status === status ||
                            (status === 'processing' && ['processing', 'shipped', 'delivered'].includes(order.status)) ||
                            (status === 'shipped' && ['shipped', 'delivered'].includes(order.status)) ||
                            (status === 'delivered' && order.status === 'delivered')
                              ? 'bg-[#d4af37] text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <p className="text-xs mt-2 capitalize text-center">{status}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking Information */}
                {order.tracking_number && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                    <h3 className="font-bold text-lg mb-3 flex items-center">
                      <Truck className="h-5 w-5 mr-2 text-blue-600" />
                      Tracking Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Tracking Number</p>
                        <p className="font-mono font-semibold text-lg">{order.tracking_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Carrier</p>
                        <p className="font-semibold uppercase">{order.tracking_carrier}</p>
                      </div>
                    </div>
                    {order.tracking_carrier && (
                      <div className="mt-4">
                        <a
                          href={
                            order.tracking_carrier.toLowerCase() === 'fedex'
                              ? `https://www.fedex.com/fedextrack/?trknbr=${order.tracking_number}`
                              : order.tracking_carrier.toLowerCase() === 'usps'
                              ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}`
                              : order.tracking_carrier.toLowerCase() === 'dhl'
                              ? `https://www.dhl.com/en/express/tracking.html?AWB=${order.tracking_number}`
                              : order.tracking_carrier.toLowerCase() === 'ups'
                              ? `https://www.ups.com/track?tracknum=${order.tracking_number}`
                              : '#'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                        >
                          Track on {order.tracking_carrier.toUpperCase()} Website →
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Order Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Customer</p>
                    <p className="font-semibold">{order.user_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="font-semibold text-[#d4af37]">${order.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold">{order.user_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-semibold">{order.phone}</p>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="border-t pt-4 mb-6">
                  <p className="text-sm text-gray-600 mb-2">Shipping Address</p>
                  <p className="font-semibold">
                    {order.shipping_address.address}, {order.shipping_address.city},{' '}
                    {order.shipping_address.postal_code}, {order.shipping_address.country}
                  </p>
                </div>

                {/* Order Items */}
                <div className="border-t pt-4">
                  <p className="font-semibold mb-3">Items</p>
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex gap-3 pb-3 border-b last:border-b-0">
                        <img src={resolveImageUrl(item.image)} alt={item.name} className="w-16 h-16 object-cover" />
                        <div className="flex-1">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                          <p className="text-sm font-bold text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TrackOrderPage;