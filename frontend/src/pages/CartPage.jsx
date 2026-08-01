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
        <div className="pt-32 pb-28">
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
    <div className="min-h-screen bg-[#faf7f2]">
      {/* Extra bottom padding so the WhatsApp FAB never covers Order Summary */}
      <div className="pt-28 md:pt-32 pb-36 md:pb-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1
            className="text-4xl md:text-5xl font-bold mb-8 md:mb-12"
            style={{ fontFamily: 'Playfair Display' }}
            data-testid="cart-title"
          >
            Shopping Cart
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => {
                const key = item.cartKey || item.id;
                return (
                  <div
                    key={key}
                    className="relative bg-white border border-black/5 rounded-xl p-3 sm:p-4 flex gap-3 sm:gap-4 shadow-card overflow-hidden"
                    data-testid={`cart-item-${item.id}`}
                  >
                    <img
                      src={resolveImageUrl(item.images[0])}
                      alt={item.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0 bg-[#f5f0e8]"
                    />
                    <div className="flex-1 min-w-0 pr-8 sm:pr-0">
                      <h3 className="font-semibold text-base sm:text-lg mb-1 line-clamp-2">{item.name}</h3>
                      {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2" data-testid={`cart-variants-${item.id}`}>
                          {Object.entries(item.selectedVariants).map(([name, value]) => (
                            <span
                              key={name}
                              className="text-xs bg-[#fbf7ec] text-gray-700 px-2 py-0.5 rounded-full border border-gold-100"
                            >
                              {name}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[#d4af37] font-bold mb-2">${item.price.toFixed(2)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateCartQuantity(key, item.quantity - 1)}
                            data-testid={`decrease-quantity-${item.id}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-semibold" data-testid={`quantity-${item.id}`}>
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
                        <p className="font-bold text-base sm:text-lg ml-auto sm:hidden">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end justify-between flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(key)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`remove-item-${item.id}`}
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      <p className="font-bold text-lg">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    {/* Mobile delete — pinned inside the card */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(key)}
                      className="sm:hidden absolute top-2 right-2 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`remove-item-mobile-${item.id}`}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white border border-black/5 rounded-xl p-5 sm:p-6 sticky top-24 shadow-card">
                <h2 className="text-xl sm:text-2xl font-bold mb-5" style={{ fontFamily: 'Playfair Display' }}>
                  Order Summary
                </h2>
                <div className="space-y-3 mb-6 text-sm sm:text-base">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-600 shrink-0">Shipping</span>
                    <span className="font-semibold text-right text-ink-muted">At checkout</span>
                  </div>
                  <div className="border-t border-gold-100 pt-3 flex justify-between gap-3 text-lg font-bold">
                    <span>Total</span>
                    <span className="text-[#d4af37]" data-testid="cart-total">${cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full btn-gold text-white py-6 text-lg rounded-full"
                  data-testid="checkout-button"
                >
                  Proceed to Checkout
                </Button>
                <Button
                  onClick={() => navigate('/shop')}
                  variant="outline"
                  className="w-full mt-3 rounded-full"
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
