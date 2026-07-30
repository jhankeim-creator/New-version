import { useContext } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import Footer from '../components/Footer';

const CartPage = () => {
  const { cart, updateCartQuantity, removeFromCart, cartTotal } = useContext(CartContext);
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="text-center py-20">
              <ShoppingBag className="h-24 w-24 mx-auto mb-6 text-gray-300" />
              <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
                Your Cart is Empty
              </h2>
              <p className="text-gray-600 mb-8">Add some items to get started!</p>
              <Button
                onClick={() => navigate('/shop')}
                className="bg-[#d4af37] hover:bg-[#b8941f] text-white"
              >
                Start Shopping
              </Button>
            </div>
          </div>
        </div>
        <Footer />
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
            data-testid="cart-title"
          >
            Shopping Cart
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => {
                const key = item.cartKey || item.id;
                return (
                <div
                  key={key}
                  className="bg-white border rounded-lg p-4 flex gap-4"
                  data-testid={`cart-item-${item.id}`}
                >
                  <img
                    src={resolveImageUrl(item.images[0])}
                    alt={item.name}
                    className="w-24 h-24 object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                    {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2" data-testid={`cart-variants-${item.id}`}>
                        {Object.entries(item.selectedVariants).map(([name, value]) => (
                          <span
                            key={name}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                          >
                            {name}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[#d4af37] font-bold mb-2">${item.price.toFixed(2)}</p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateCartQuantity(key, item.quantity - 1)}
                        data-testid={`decrease-quantity-${item.id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-12 text-center font-semibold" data-testid={`quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateCartQuantity(key, item.quantity + 1)}
                        data-testid={`increase-quantity-${item.id}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(key)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`remove-item-${item.id}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                    <p className="font-bold text-lg">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 border rounded-lg p-6 sticky top-24">
                <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>
                  Order Summary
                </h2>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-semibold">Calculated at checkout</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-[#d4af37]" data-testid="cart-total">${cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-[#d4af37] hover:bg-[#b8941f] text-white py-6 text-lg"
                  data-testid="checkout-button"
                >
                  Proceed to Checkout
                </Button>
                <Button
                  onClick={() => navigate('/shop')}
                  variant="outline"
                  className="w-full mt-3"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CartPage;