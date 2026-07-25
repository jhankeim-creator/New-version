import { useEffect, useState, useContext } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

const MyOrders = () => {
  const { user, token, API } = useContext(CartContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !token) {
      toast.error('Please login to view your orders');
      navigate('/login');
      return;
    }
    loadOrders();
  }, [user, token]);

  const loadOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="container mx-auto px-4">
          <h1
            className="text-4xl md:text-5xl font-bold mb-12"
            style={{ fontFamily: 'Playfair Display' }}
            data-testid="my-orders-title"
          >
            My Orders
          </h1>

          {orders.length === 0 ? (
            <div className="text-center py-20">
              <Package className="h-24 w-24 mx-auto mb-6 text-gray-300" />
              <h2 className="text-2xl font-bold mb-4">No Orders Yet</h2>
              <p className="text-gray-600 mb-8">Start shopping to see your orders here!</p>
              <Button
                onClick={() => navigate('/shop')}
                className="bg-[#d4af37] hover:bg-[#b8941f] text-white"
              >
                Start Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <Card key={order.id} data-testid={`order-${order.id}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{order.order_number}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-start md:items-end mt-2 md:mt-0">
                        <p className="text-2xl font-bold text-[#d4af37]">${order.total.toFixed(2)}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded capitalize">
                            {order.status}
                          </span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded capitalize">
                            {order.payment_status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Payment Method</p>
                        <p className="font-semibold capitalize">{order.payment_method}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Items</p>
                        <p className="font-semibold">{order.items.length} item(s)</p>
                      </div>
                    </div>

                    {/* Tracking Information */}
                    {order.tracking_number && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="font-semibold text-blue-900 mb-2">📦 Tracking Information</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <p className="text-sm text-gray-600">Carrier</p>
                            <p className="font-semibold uppercase">{order.tracking_carrier}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Tracking Number</p>
                            <p className="font-semibold">{order.tracking_number}</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            const trackingUrls = {
                              fedex: `https://www.fedex.com/fedextrack/?trknbr=${order.tracking_number}`,
                              usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}`
                            };
                            window.open(trackingUrls[order.tracking_carrier.toLowerCase()] || '#', '_blank');
                          }}
                          className="mt-3 bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          Track Package
                        </Button>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex flex-col">
                            <img
                              src={resolveImageUrl(item.image)}
                              alt={item.name}
                              className="w-full h-24 object-cover mb-2"
                            />
                            <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
                            <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button
                        onClick={() => navigate(`/track-order`)}
                        variant="outline"
                      >
                        Track Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MyOrders;