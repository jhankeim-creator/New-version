import { useState, useEffect, useContext } from 'react';
import { CartContext } from '../App';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, Trash2, Edit, Package } from 'lucide-react';

const AdminOrders = () => {
  const { API, token } = useContext(CartContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [trackingData, setTrackingData] = useState({
    tracking_number: '',
    tracking_carrier: 'fedex'
  });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`, {
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

  const updateOrderStatus = async (orderId, status, paymentStatus = null) => {
    try {
      const params = new URLSearchParams({ status });
      if (paymentStatus) params.append('payment_status', paymentStatus);

      await axios.put(`${API}/orders/${orderId}/status?${params.toString()}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order updated successfully');
      loadOrders();
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order');
    }
  };

  const refundToWallet = async (order) => {
    if (!window.confirm(`Refund ${order.order_number} to customer wallet?`)) return;
    setRefundLoading(true);
    try {
      await axios.post(
        `${API}/admin/orders/${order.id}/refund-to-wallet`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Refund credited to customer wallet');
      setShowDialog(false);
      loadOrders();
    } catch (error) {
      console.error('Failed to refund to wallet:', error);
      toast.error(error.response?.data?.detail || 'Failed to refund to wallet');
    } finally {
      setRefundLoading(false);
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Delete this order permanently?')) return;
    
    try {
      await axios.delete(`${API}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order deleted successfully');
      loadOrders();
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast.error('Failed to delete order');
    }
  };

  const addTracking = (order) => {
    setSelectedOrder(order);
    setTrackingData({
      tracking_number: order.tracking_number || '',
      tracking_carrier: order.tracking_carrier || 'fedex'
    });
    setShowTrackingDialog(true);
  };

  const submitTracking = async () => {
    try {
      await axios.put(
        `${API}/orders/${selectedOrder.id}/tracking?tracking_number=${trackingData.tracking_number}&tracking_carrier=${trackingData.tracking_carrier}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Tracking number added successfully');
      setShowTrackingDialog(false);
      loadOrders();
    } catch (error) {
      console.error('Failed to add tracking:', error);
      toast.error('Failed to add tracking');
    }
  };

  const viewOrder = (order) => {
    setSelectedOrder(order);
    setShowDialog(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Manage Orders</h2>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <p className="text-center py-8 text-gray-600">No orders yet</p>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="border rounded-lg p-4"
              data-testid={`order-item-${order.id}`}
            >
              <div className="flex flex-col md:flex-row justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">{order.order_number}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end mt-2 md:mt-0">
                  <p className="text-2xl font-bold text-[#d4af37]">${order.total.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Payment: {order.payment_method}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold">{order.user_name}</p>
                  <p className="text-sm">{order.user_email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Order Status</p>
                  <Select
                    value={order.status || order.order_status || 'pending'}
                    onValueChange={(value) => updateOrderStatus(order.id, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Payment Status</p>
                  <Select
                    value={order.payment_status}
                    onValueChange={(value) => updateOrderStatus(order.id, order.status, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <p className="text-sm text-gray-600">{order.items.length} item(s)</p>
                <div className="flex gap-2">
                  {(order.status === 'shipped' || order.status === 'delivered') && (
                    <Button
                      onClick={() => addTracking(order)}
                      variant="outline"
                      size="sm"
                      className="text-blue-600"
                    >
                      <Package className="mr-2 h-4 w-4" />
                      {order.tracking_number ? 'Update' : 'Add'} Tracking
                    </Button>
                  )}
                  <Button
                    onClick={() => viewOrder(order)}
                    variant="outline"
                    size="sm"
                    data-testid={`view-order-${order.id}`}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    onClick={() => deleteOrder(order.id)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {selectedOrder.refunded_to_wallet && (
                <div className="p-3 rounded border bg-green-50 border-green-200 text-green-900">
                  Refunded to wallet: ${Number(selectedOrder.refunded_amount || 0).toFixed(2)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-semibold">{selectedOrder.user_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold">{selectedOrder.user_email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-semibold">{selectedOrder.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-semibold text-[#d4af37]">${selectedOrder.total.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Shipping Address</p>
                <p className="font-semibold">
                  {selectedOrder.shipping_address.address}, {selectedOrder.shipping_address.city},{' '}
                  {selectedOrder.shipping_address.postal_code}, {selectedOrder.shipping_address.country}
                </p>
              </div>

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Order Notes</p>
                  <p className="font-semibold">{selectedOrder.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-2">Order Items</p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 p-3 border rounded">
                      <img src={item.image} alt={item.name} className="w-16 h-16 object-cover" />
                      <div className="flex-1">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          ${item.price.toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                {!selectedOrder.refunded_to_wallet && (
                  <Button
                    onClick={() => refundToWallet(selectedOrder)}
                    variant="outline"
                    disabled={refundLoading}
                    className="text-green-700 border-green-300 hover:bg-green-50"
                  >
                    {refundLoading ? 'Refunding...' : 'Refund to Wallet'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking Information</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tracking Carrier</label>
                <Select
                  value={trackingData.tracking_carrier}
                  onValueChange={(value) => setTrackingData({...trackingData, tracking_carrier: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fedex">FedEx</SelectItem>
                    <SelectItem value="usps">USPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Tracking Number</label>
                <input
                  type="text"
                  value={trackingData.tracking_number}
                  onChange={(e) => setTrackingData({...trackingData, tracking_number: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter tracking number"
                />
              </div>
              
              <Button
                onClick={submitTracking}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!trackingData.tracking_number}
              >
                Save Tracking
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;