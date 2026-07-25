import { useState, useEffect, useContext } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { Link } from 'react-router-dom';
import { Heart, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';
import { CartContext } from '../App';

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const { API, token, addToCart } = useContext(CartContext);

  useEffect(() => {
    loadWishlist();
  }, []);

  const loadWishlist = async () => {
    try {
      if (!token) {
        // Load from localStorage for non-logged users
        const localWishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        if (localWishlist.length > 0) {
          const productIds = localWishlist.join(',');
          const response = await axios.get(`${API}/products/by-ids?ids=${productIds}`);
          setWishlist(response.data);
        }
      } else {
        // Load from backend for logged users
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(`${API}/wishlist`, { headers });
        setWishlist(response.data);
      }
    } catch (error) {
      console.error('Failed to load wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      if (!token) {
        // Remove from localStorage
        const localWishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        const updated = localWishlist.filter(id => id !== productId);
        localStorage.setItem('wishlist', JSON.stringify(updated));
        setWishlist(prev => prev.filter(p => p.id !== productId));
        toast.success('Removed from wishlist');
      } else {
        // Remove from backend
        const headers = { Authorization: `Bearer ${token}` };
        await axios.delete(`${API}/wishlist/${productId}`, { headers });
        setWishlist(prev => prev.filter(p => p.id !== productId));
        toast.success('Removed from wishlist');
      }
    } catch (error) {
      toast.error('Failed to remove from wishlist');
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    toast.success('Added to cart!');
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-16">
        <div className="container mx-auto px-4">
          <p className="text-center">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-16">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
            My Wishlist
          </h1>
          <p className="text-gray-600">
            {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>

        {wishlist.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Heart className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold mb-2">Your wishlist is empty</h3>
              <p className="text-gray-600 mb-6">
                Save your favorite products to your wishlist
              </p>
              <Link to="/shop">
                <Button className="bg-[#d4af37] hover:bg-[#b8941f]">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {wishlist.map((product) => (
              <Card key={product.id} className="group relative overflow-hidden">
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>

                <Link to={`/product/${product.id}`}>
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={resolveImageUrl(product.images?.[0])}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </Link>

                <CardContent className="p-4">
                  <Link to={`/product/${product.id}`}>
                    <h3 className="font-semibold mb-2 hover:text-[#d4af37] transition-colors line-clamp-2">
                      {product.name}
                    </h3>
                  </Link>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-[#d4af37]">
                        ${product.price?.toFixed(2)}
                      </p>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <p className="text-sm text-gray-400 line-through">
                          ${product.compare_at_price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleAddToCart(product)}
                    className="w-full bg-[#d4af37] hover:bg-[#b8941f]"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
