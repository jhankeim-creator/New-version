import { useEffect, useState, useContext } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Minus, Plus, ShoppingCart, Star } from 'lucide-react';
import Footer from '../components/Footer';
import ReviewSystem from '../components/ReviewSystem';
import axios from 'axios';
import { toast } from 'sonner';

const ProductPage = () => {
  const { id } = useParams();
  const { API, addToCart } = useContext(CartContext);
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadProduct();
    loadReviews();
  }, [id]);

  const loadProduct = async () => {
    try {
      const response = await axios.get(`${API}/products/${id}`);
      setProduct(response.data);
    } catch (error) {
      console.error('Failed to load product:', error);
      toast.error('Product not found');
      navigate('/shop');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await axios.get(`${API}/v2/reviews/product/${id}`);
      setReviews(response.data);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const handleAddToCart = () => {
    if (product && quantity > 0) {
      addToCart(product, quantity);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Images */}
            <div>
              <div className="mb-4">
                <img
                  src={resolveImageUrl(product.images[selectedImage])}
                  alt={product.name}
                  className="w-full h-[600px] object-cover"
                  data-testid="product-main-image"
                />
              </div>
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-4">
                  {product.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={resolveImageUrl(img)}
                      alt={`${product.name} ${idx + 1}`}
                      className={`w-full h-24 object-cover cursor-pointer border-2 ${
                        selectedImage === idx ? 'border-[#d4af37]' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedImage(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <h1
                className="text-4xl md:text-5xl font-bold mb-4"
                style={{ fontFamily: 'Playfair Display' }}
                data-testid="product-name"
              >
                {product.name}
              </h1>
              <div className="text-3xl font-bold text-[#d4af37] mb-6" data-testid="product-price">
                ${product.price.toFixed(2)}
              </div>
              <p className="text-gray-700 text-lg mb-6 leading-relaxed">{product.description}</p>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Quantity</label>
                <div className="flex items-center space-x-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      data-testid="decrease-quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-xl font-semibold w-12 text-center" data-testid="quantity-display">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(quantity + 1)}
                      data-testid="increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

              {/* Add to Cart Button */}
              <div className="flex space-x-4">
                <Button
                  onClick={handleAddToCart}
                  className="flex-1 bg-[#d4af37] hover:bg-[#b8941f] text-white py-6 text-lg"
                  data-testid="add-to-cart-button"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Add to Cart
                </Button>
                <Button
                  onClick={() => {
                    handleAddToCart();
                    navigate('/cart');
                  }}
                  variant="outline"
                  className="flex-1 border-2 border-black hover:bg-black hover:text-white py-6 text-lg"
                >
                  Buy Now
                </Button>
              </div>

              {/* Category */}
              <div className="mt-8 pt-8 border-t">
                <p className="text-gray-600">
                  <span className="font-semibold">Category:</span>{' '}
                  <span className="capitalize">{product.category}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Reviews Section */}
        <div className="container mx-auto px-4 py-12">
          <ReviewSystem
            productId={id}
            reviews={reviews}
            onReviewSubmitted={loadReviews}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProductPage;