import { useState, useContext, useEffect, useMemo } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'sonner';
import { CreditCard, Wallet, DollarSign, Truck, Banknote, ShieldCheck, Sparkles } from 'lucide-react';

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'France', 'Haiti', 'Dominican Republic',
  'Germany', 'Italy', 'Spain', 'Belgium', 'Netherlands', 'Switzerland', 'Australia',
  'Japan', 'China', 'Mexico', 'Brazil', 'Other',
];

/** Build a human-readable notes string from structured checkout answers. */
function formatAnswersAsNotes(answers, cart) {
  const lines = [];
  (cart || []).forEach((item, idx) => {
    const key = item.cartKey || item.id || String(idx);
    const color = answers[`color_${key}`];
    const size = answers[`size_${key}`];
    const extra = answers[`item_note_${key}`];
    if (color || size || extra) {
      lines.push(`• ${item.name}:`);
      if (color) lines.push(`  Color: ${color}`);
      if (size) lines.push(`  Size: ${size}`);
      if (extra) lines.push(`  Note: ${extra}`);
    }
  });
  if (answers.is_gift === 'yes') {
    lines.push('• Gift order: Yes');
    if (answers.gift_message) lines.push(`  Gift message: ${answers.gift_message}`);
  }
  if (answers.delivery_instructions) {
    lines.push(`• Delivery: ${answers.delivery_instructions}`);
  }
  if (answers.other) lines.push(`• Other: ${answers.other}`);
  return lines.join('\n') || null;
}

const CheckoutPage = () => {
  const { cart, cartTotal, clearCart, API } = useContext(CartContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [shippingMethod, setShippingMethod] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [answers, setAnswers] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    paymentMethod: 'stripe',
  });

  useEffect(() => {
    if (cart.length === 0 && !orderPlaced) {
      navigate('/cart');
    }
    loadPaymentGateways();
    loadShippingMethods();
  }, [cart, navigate, orderPlaced]);

  // Prefill size/color answers from cart variant selections.
  useEffect(() => {
    setAnswers((prev) => {
      const next = { ...prev };
      cart.forEach((item) => {
        const key = item.cartKey || item.id;
        const sel = item.selectedVariants || {};
        Object.entries(sel).forEach(([axis, value]) => {
          const lower = axis.toLowerCase();
          if (lower === 'color' && !next[`color_${key}`]) next[`color_${key}`] = value;
          if (lower === 'size' && !next[`size_${key}`]) next[`size_${key}`] = value;
        });
      });
      return next;
    });
  }, [cart]);

  const loadPaymentGateways = async () => {
    try {
      const response = await axios.get(`${API}/settings/payment-gateways`);
      setPaymentGateways(response.data.filter((g) => g.enabled));
    } catch (error) {
      console.error('Failed to load payment gateways:', error);
    }
  };

  const loadShippingMethods = async () => {
    try {
      const response = await axios.get(`${API}/settings/shipping-methods`);
      const methods = Array.isArray(response.data) ? response.data : [];
      setShippingMethods(methods);
      setShippingMethod((prev) => prev || methods[0]?.id || '');
    } catch (error) {
      console.error('Failed to load shipping methods:', error);
      const fallback = [{ id: 'free', name: 'Free Delivery', description: 'Delivery in 7-14 business days', cost: 0 }];
      setShippingMethods(fallback);
      setShippingMethod((prev) => prev || 'free');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const selectedShippingMethod = shippingMethods.find((m) => m.id === shippingMethod) || null;
  const shippingCost = selectedShippingMethod ? Number(selectedShippingMethod.cost) || 0 : 0;
  const cryptoDiscount = formData.paymentMethod === 'plisio' ? cartTotal * 0.15 : 0;
  const subtotal = cartTotal - couponDiscount - cryptoDiscount;
  const finalTotal = subtotal + shippingCost;

  const itemQuestions = useMemo(
    () =>
      cart.map((item) => {
        const key = item.cartKey || item.id;
        const sel = item.selectedVariants || {};
        const hasColor = Object.keys(sel).some((k) => k.toLowerCase() === 'color');
        const hasSize = Object.keys(sel).some((k) => k.toLowerCase() === 'size');
        return { item, key, hasColor, hasSize };
      }),
    [cart]
  );

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

    // Require color answer when the product didn't already pick one in cart.
    for (const { item, key, hasColor } of itemQuestions) {
      if (!hasColor && !(answers[`color_${key}`] || '').trim()) {
        toast.error(`Please tell us the color you want for “${item.name}”`);
        setLoading(false);
        return;
      }
    }

    try {
      const notes = formatAnswersAsNotes(answers, cart);
      const orderData = {
        user_email: formData.email,
        user_name: formData.name,
        items: cart.map((item) => ({
          product_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          variant: item.selectedVariants || null,
          image: item.images?.[0] || '',
        })),
        total: finalTotal,
        coupon_code: couponApplied ? couponCode : null,
        discount_amount: couponDiscount,
        crypto_discount: cryptoDiscount,
        shipping_method: shippingMethod,
        shipping_method_name: selectedShippingMethod?.name || null,
        shipping_cost: shippingCost,
        payment_method: formData.paymentMethod,
        shipping_address: {
          address: formData.address,
          city: formData.city,
          postal_code: formData.postalCode,
          country: formData.country,
        },
        phone: formData.phone,
        notes,
        checkout_answers: answers,
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
    { id: 'stripe', name: 'Credit / Debit Card', icon: CreditCard, description: 'Secure card payment via Stripe', type: 'stripe' },
    { id: 'plisio', name: 'Cryptocurrency', icon: Wallet, description: '100+ coins accepted', discount: '15% OFF', type: 'plisio' },
    { id: 'manual', name: 'Bank / Payoneer', icon: DollarSign, description: 'Transfer — instructions by email', type: 'manual' },
  ];

  const allPaymentMethods = [
    ...paymentMethods,
    ...paymentGateways.map((gateway) => ({
      id: gateway.gateway_type === 'manual' ? `manual-${gateway.gateway_id || gateway.id}` : (gateway.gateway_id || gateway.id),
      name: gateway.name,
      icon: gateway.gateway_type === 'manual' ? Banknote : DollarSign,
      description: gateway.description || 'Manual payment method',
      type: gateway.gateway_type,
    })),
  ];

  const sectionClass = 'rounded-2xl border border-black/5 bg-white shadow-card overflow-hidden';
  const sectionHead = 'px-5 py-4 border-b border-gold-100 bg-gradient-to-r from-[#fbf7ec] to-white';
  const sectionBody = 'p-5 md:p-6 space-y-4';

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <div className="pt-28 md:pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-10">
            <p className="eyebrow mb-3">Secure checkout</p>
            <h1
              className="text-4xl md:text-5xl font-bold mb-3"
              style={{ fontFamily: 'Playfair Display' }}
              data-testid="checkout-title"
            >
              Checkout
            </h1>
            <div className="gold-divider mx-auto mb-4" />
            <p className="text-sm text-ink-muted flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#d4af37]" />
              Encrypted payment · Worldwide shipping
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-6">
                {/* Contact */}
                <section className={sectionClass}>
                  <div className={sectionHead}>
                    <h2 className="text-lg font-semibold tracking-tight">1. Contact</h2>
                  </div>
                  <div className={sectionBody}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full name *</Label>
                        <Input id="name" name="name" value={formData.name} onChange={handleChange} required data-testid="input-name" className="mt-1.5 bg-white" />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required data-testid="input-email" className="mt-1.5 bg-white" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required data-testid="input-phone" className="mt-1.5 bg-white" />
                    </div>
                  </div>
                </section>

                {/* Shipping address */}
                <section className={sectionClass}>
                  <div className={sectionHead}>
                    <h2 className="text-lg font-semibold tracking-tight">2. Shipping address</h2>
                  </div>
                  <div className={sectionBody}>
                    <div>
                      <Label htmlFor="address">Street address *</Label>
                      <Input id="address" name="address" value={formData.address} onChange={handleChange} required data-testid="input-address" className="mt-1.5 bg-white" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input id="city" name="city" value={formData.city} onChange={handleChange} required data-testid="input-city" className="mt-1.5 bg-white" />
                      </div>
                      <div>
                        <Label htmlFor="postalCode">Postal code *</Label>
                        <Input id="postalCode" name="postalCode" value={formData.postalCode} onChange={handleChange} required data-testid="input-postal-code" className="mt-1.5 bg-white" />
                      </div>
                      <div>
                        <Label htmlFor="country">Country *</Label>
                        <select
                          id="country"
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                          required
                          data-testid="input-country"
                          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Select country</option>
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Delivery */}
                <section className={sectionClass}>
                  <div className={sectionHead}>
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                      <Truck className="h-5 w-5 text-[#d4af37]" />
                      3. Delivery
                    </h2>
                  </div>
                  <div className={sectionBody}>
                    {shippingMethods.length === 0 ? (
                      <p className="text-sm text-gray-500">Loading delivery options…</p>
                    ) : (
                      <RadioGroup value={shippingMethod} onValueChange={setShippingMethod} data-testid="shipping-method-selector">
                        {shippingMethods.map((method) => {
                          const isSelected = shippingMethod === method.id;
                          return (
                            <label
                              key={method.id}
                              htmlFor={`ship-${method.id}`}
                              className={`flex items-start space-x-3 p-4 rounded-xl cursor-pointer transition-colors border ${
                                isSelected
                                  ? 'border-[#d4af37] bg-[#fbf7ec] ring-1 ring-[#d4af37]'
                                  : 'border-gray-200 hover:border-gold-200 bg-white'
                              }`}
                              data-testid={`shipping-option-${method.id}`}
                            >
                              <RadioGroupItem value={method.id} id={`ship-${method.id}`} className="mt-1" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold">{method.name}</span>
                                  <span className="text-[#d4af37] font-bold whitespace-nowrap">
                                    {Number(method.cost) > 0 ? `$${Number(method.cost).toFixed(2)}` : 'FREE'}
                                  </span>
                                </div>
                                {(method.description || method.estimated_days) && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {method.description || `Delivery in ${method.estimated_days}`}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    )}
                  </div>
                </section>

                {/* Product questions — color, size, etc. */}
                <section className={sectionClass} data-testid="checkout-questions">
                  <div className={sectionHead}>
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[#d4af37]" />
                      4. Your preferences
                    </h2>
                    <p className="text-sm text-ink-muted mt-1">
                      Answer these so we prepare the exact item you want (color, size, gift…).
                    </p>
                  </div>
                  <div className={sectionBody}>
                    {itemQuestions.map(({ item, key, hasColor, hasSize }) => (
                      <div
                        key={key}
                        className="rounded-xl border border-gold-100 bg-[#fbf7ec]/50 p-4 space-y-3"
                      >
                        <div className="flex gap-3 items-start">
                          <img
                            src={resolveImageUrl(item.images?.[0])}
                            alt=""
                            className="w-14 h-14 rounded-lg object-cover bg-white"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm line-clamp-2">{item.name}</p>
                            <p className="text-xs text-ink-muted">Qty {item.quantity}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`color_${key}`}>
                              Preferred color {!hasColor && <span className="text-red-500">*</span>}
                            </Label>
                            <Input
                              id={`color_${key}`}
                              value={answers[`color_${key}`] || ''}
                              onChange={(e) => setAnswer(`color_${key}`, e.target.value)}
                              placeholder={hasColor ? 'Confirmed from your selection' : 'e.g. Black, Gold, Red…'}
                              required={!hasColor}
                              readOnly={hasColor}
                              className="mt-1.5 bg-white"
                              data-testid={`input-color-${key}`}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`size_${key}`}>Preferred size</Label>
                            <Input
                              id={`size_${key}`}
                              value={answers[`size_${key}`] || ''}
                              onChange={(e) => setAnswer(`size_${key}`, e.target.value)}
                              placeholder={hasSize ? 'Confirmed from your selection' : 'e.g. M, 42, S-XL…'}
                              readOnly={hasSize}
                              className="mt-1.5 bg-white"
                              data-testid={`input-size-${key}`}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`item_note_${key}`}>Anything else for this item?</Label>
                          <Input
                            id={`item_note_${key}`}
                            value={answers[`item_note_${key}`] || ''}
                            onChange={(e) => setAnswer(`item_note_${key}`, e.target.value)}
                            placeholder="Optional — engraving, model preference…"
                            className="mt-1.5 bg-white"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 space-y-3 border-t border-gold-100">
                      <div>
                        <Label className="mb-2 block">Is this a gift?</Label>
                        <RadioGroup
                          value={answers.is_gift || 'no'}
                          onValueChange={(v) => setAnswer('is_gift', v)}
                          className="flex gap-4"
                        >
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <RadioGroupItem value="no" id="gift-no" />
                            No
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <RadioGroupItem value="yes" id="gift-yes" />
                            Yes
                          </label>
                        </RadioGroup>
                      </div>
                      {answers.is_gift === 'yes' && (
                        <div>
                          <Label htmlFor="gift_message">Gift message</Label>
                          <Textarea
                            id="gift_message"
                            value={answers.gift_message || ''}
                            onChange={(e) => setAnswer('gift_message', e.target.value)}
                            placeholder="Message for the recipient…"
                            rows={2}
                            className="mt-1.5 bg-white"
                          />
                        </div>
                      )}
                      <div>
                        <Label htmlFor="delivery_instructions">Delivery instructions</Label>
                        <Input
                          id="delivery_instructions"
                          value={answers.delivery_instructions || ''}
                          onChange={(e) => setAnswer('delivery_instructions', e.target.value)}
                          placeholder="Gate code, leave with concierge…"
                          className="mt-1.5 bg-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="other">Other comments</Label>
                        <Textarea
                          id="other"
                          value={answers.other || ''}
                          onChange={(e) => setAnswer('other', e.target.value)}
                          placeholder="Anything else we should know?"
                          rows={2}
                          className="mt-1.5 bg-white"
                          data-testid="input-notes"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Payment */}
                <section className={sectionClass}>
                  <div className={sectionHead}>
                    <h2 className="text-lg font-semibold tracking-tight">5. Payment</h2>
                  </div>
                  <div className={sectionBody}>
                    <RadioGroup
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                      data-testid="payment-method-selector"
                    >
                      {allPaymentMethods.map((method) => {
                        const isSelected = formData.paymentMethod === method.id;
                        return (
                          <label
                            key={method.id}
                            htmlFor={`pay-${method.id}`}
                            className={`flex items-start space-x-3 p-4 rounded-xl cursor-pointer transition-colors border ${
                              isSelected
                                ? 'border-[#d4af37] bg-[#fbf7ec] ring-1 ring-[#d4af37]'
                                : 'border-gray-200 hover:border-gold-200 bg-white'
                            }`}
                            data-testid={`payment-option-${method.id}`}
                          >
                            <RadioGroupItem value={method.id} id={`pay-${method.id}`} className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <method.icon className="h-5 w-5 text-[#d4af37]" />
                                <span className="font-semibold">{method.name}</span>
                                {method.discount && (
                                  <span className="px-2 py-0.5 bg-[#d4af37]/15 text-[#8a6b1f] text-xs font-bold rounded">
                                    {method.discount}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </RadioGroup>
                    <div className="mt-2 p-4 rounded-xl border border-gold-100 bg-[#fbf7ec]">
                      <p className="text-sm text-[#5c4a2a]">
                        After you place the order, payment instructions arrive by email.
                        Confirm crypto or bank transfer on the order confirmation page.
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Summary */}
              <div className="lg:col-span-2">
                <div className={`${sectionClass} sticky top-24`}>
                  <div className={sectionHead}>
                    <h2 className="text-lg font-semibold tracking-tight">Order summary</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                      {cart.map((item) => (
                        <div key={item.cartKey || item.id} className="flex gap-3">
                          <img
                            src={resolveImageUrl(item.images?.[0])}
                            alt={item.name}
                            className="w-16 h-16 rounded-lg object-cover bg-[#f5f0e8]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm line-clamp-2">{item.name}</p>
                            {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                              <p className="text-xs text-ink-muted">
                                {Object.entries(item.selectedVariants).map(([n, v]) => `${n}: ${v}`).join(', ')}
                              </p>
                            )}
                            <p className="text-sm text-gray-600">Qty {item.quantity}</p>
                            <p className="text-sm font-bold text-[#d4af37]">
                              ${(item.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-gold-100 bg-[#fbf7ec]/80 p-3 space-y-2">
                      <Label className="text-sm">Coupon code</Label>
                      <div className="flex gap-2">
                        <Input
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Enter code"
                          disabled={couponApplied}
                          className="bg-white"
                        />
                        <Button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={!couponCode || couponApplied}
                          className="btn-gold text-white shrink-0"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-gold-100 pt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                      </div>
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Coupon</span>
                          <span className="font-semibold">-${couponDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      {cryptoDiscount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Crypto (15%)</span>
                          <span className="font-semibold">-${cryptoDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Shipping{selectedShippingMethod ? ` · ${selectedShippingMethod.name}` : ''}
                        </span>
                        <span className="font-semibold">
                          {shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : 'FREE'}
                        </span>
                      </div>
                      <div className="border-t border-gold-100 pt-3 flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-[#d4af37]" data-testid="order-total">
                          ${finalTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full btn-gold text-white py-6 text-lg rounded-full shadow-luxe"
                      data-testid="place-order-button"
                    >
                      {loading ? 'Processing…' : 'Place order'}
                    </Button>
                    <p className="text-[11px] text-center text-ink-muted leading-relaxed">
                      By placing your order you agree to our terms. Need help? Use the WhatsApp chat.
                    </p>
                  </div>
                </div>
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
