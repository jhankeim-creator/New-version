import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'sonner';
import { CreditCard, Coins, Wallet, DollarSign, Truck, Banknote } from 'lucide-react';

const CheckoutPage = () => {
  const { cart, cartTotal, clearCart, API } = useContext(CartContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [shippingMethod, setShippingMethod] = useState('free');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    paymentMethod: 'stripe',
    notes: ''
  });

  useEffect(() => {
    if (cart.length === 0 && !orderPlaced) {
      navigate('/cart');
    }
    loadPaymentGateways();
  }, [cart, navigate, orderPlaced]);

  const loadPaymentGateways = async () => {
    try {
      const response = await axios.get(`${API}/settings/payment-gateways`);
      setPaymentGateways(response.data.filter(g => g.enabled));
    } catch (error) {
      console.error('Failed to load payment gateways:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const shippingCost = shippingMethod === 'fedex' ? 10 : 0;
  
  // Calculate crypto discount for Plisio (15%)
  const cryptoDiscount = formData.paymentMethod === 'plisio' ? cartTotal * 0.15 : 0;
  
  // Calculate final total with all discounts
  const subtotal = cartTotal - couponDiscount - cryptoDiscount;
  const finalTotal = subtotal + shippingCost;

  const handleApplyCoupon = async () => {
    try {
      const response = await axios.post(`${API}/coupons/validate?code=${couponCode}&cart_total=${cartTotal}`);
      setCouponDiscount(response.data.discount_amount);
      setCouponApplied(true);
      toast.success(`Coupon applied! -$${response.data.discount_amount.toFixed(2)}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid coupon code');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const orderData = {
        user_email: formData.email,
        user_name: formData.name,
        items: cart.map(item => ({
          product_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.images[0]
        })),
        total: finalTotal,
        coupon_code: couponApplied ? couponCode : null,
        discount_amount: couponDiscount,
        crypto_discount: cryptoDiscount,
        shipping_method: shippingMethod,
        shipping_cost: shippingCost,
        payment_method: formData.paymentMethod,
        shipping_address: {
          address: formData.address,
          city: formData.city,
          postal_code: formData.postalCode,
          country: formData.country
        },
        phone: formData.phone,
        notes: formData.notes || null
      };

      const response = await axios.post(`${API}/orders`, orderData);
      setOrderPlaced(true);
      clearCart();
      toast.success('Order placed successfully!');
      navigate(`/order-success/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods = [
    { id: 'stripe', name: 'Credit Card (Stripe)', icon: CreditCard, description: 'Pay with credit or debit card', type: 'stripe' },
    { id: 'plisio', name: 'Cryptocurrency (Plisio)', icon: Wallet, description: '100+ cryptocurrencies accepted', discount: '15% OFF', type: 'plisio' },
    { id: 'manual', name: 'Manual Payment (Payoneer)', icon: DollarSign, description: 'Bank transfer, Payoneer - Instructions sent by email', type: 'manual' }
  ];

  // Add payment gateways from admin to the list
  const allPaymentMethods = [
    ...paymentMethods,
    ...paymentGateways.map(gateway => ({
      id: gateway.gateway_type === 'manual' ? `manual-${gateway.gateway_id || gateway.id}` : (gateway.gateway_id || gateway.id),
      name: gateway.name,
      icon: gateway.gateway_type === 'manual' ? Banknote : DollarSign,
      description: gateway.description || 'Manual payment method',
      type: gateway.gateway_type,
      instructions: gateway.payment_instructions
    }))
  ];

  return (
    <div className="min-h-screen">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          <h1
            className="text-4xl md:text-5xl font-bold mb-12 text-center"
            style={{ fontFamily: 'Playfair Display' }}
            data-testid="checkout-title"
          >
            Checkout
          </h1>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Checkout Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          data-testid="input-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          data-testid="input-email"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        data-testid="input-phone"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Address */}
                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Address</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="address">Street Address *</Label>
                      <Input
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        required
                        data-testid="input-address"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          required
                          data-testid="input-city"
                        />
                      </div>
                      <div>
                        <Label htmlFor="postalCode">Postal Code *</Label>
                        <Input
                          id="postalCode"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleChange}
                          required
                          data-testid="input-postal-code"
                        />
                      </div>
                      <div>
                        <Label htmlFor="country">Country *</Label>
                        <Input
                          id="country"
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                          required
                          data-testid="input-country"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Method */}
                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={shippingMethod}
                      onValueChange={setShippingMethod}
                    >
                      <div
                        className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                        onClick={() => setShippingMethod('free')}
                      >
                        <RadioGroupItem value="free" id="free" />
                        <div className="flex-1">
                          <Label htmlFor="free" className="cursor-pointer">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Free Delivery</span>
                              <span className="text-[#d4af37] font-bold">$0.00</span>
                            </div>
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">Delivery in 7-14 business days</p>
                        </div>
                      </div>

                      <div
                        className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                        onClick={() => setShippingMethod('fedex')}
                      >
                        <RadioGroupItem value="fedex" id="fedex" />
                        <div className="flex-1">
                          <Label htmlFor="fedex" className="cursor-pointer">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">FedEx Express</span>
                              <span className="text-[#d4af37] font-bold">$10.00</span>
                            </div>
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">Delivery in 5-7 business days</p>
                        </div>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Payment Method */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                      data-testid="payment-method-selector"
                    >
                      {allPaymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                          onClick={() => setFormData({ ...formData, paymentMethod: method.id })}
                        >
                          <RadioGroupItem value={method.id} id={method.id} />
                          <div className="flex-1">
                            <Label htmlFor={method.id} className="flex items-center cursor-pointer">
                              <method.icon className="h-5 w-5 mr-2 text-[#d4af37]" />
                              <span className="font-semibold">{method.name}</span>
                              {method.discount && (
                                <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                                  {method.discount}
                                </span>
                              )}
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                            {/* Instructions removed - will be sent by email only */}
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> After placing your order, you'll receive payment instructions via email.
                        For manual and crypto payments, please confirm payment in your order confirmation page.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Order Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Order Notes (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      name="notes"
                      placeholder="Any special instructions or notes..."
                      value={formData.notes}
                      onChange={handleChange}
                      rows={4}
                      data-testid="input-notes"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle>Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex gap-3">
                          <img src={item.images[0]} alt={item.name} className="w-16 h-16 object-cover" />
                          <div className="flex-1">
                            <p className="font-semibold text-sm line-clamp-1">{item.name}</p>
                            <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                            <p className="text-sm font-bold text-[#d4af37]">${(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                      </div>
                      
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Coupon Discount</span>
                          <span className="font-semibold">-${couponDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {cryptoDiscount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Crypto Discount (15%)</span>
                          <span className="font-semibold">-${cryptoDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span className="font-semibold">
                          {shippingMethod === 'fedex' ? '$10.00' : 'FREE'}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-[#d4af37]" data-testid="order-total">${finalTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {/* Coupon Code Input */}
                    <div className="mt-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <Label className="mb-2">Have a coupon code?</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Enter coupon code"
                          disabled={couponApplied}
                        />
                        <Button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={!couponCode || couponApplied}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#d4af37] hover:bg-[#b8941f] text-white py-6 text-lg"
                      data-testid="place-order-button"
                    >
                      {loading ? 'Processing...' : 'Place Order'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CheckoutPage;