import { useEffect, useState, useContext, useMemo } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { useSeo } from '../lib/seo';
import { productKeywords } from '../lib/seo';
import { getProductVariantGroups } from '../lib/variants';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'sonner';

const ProductPage = () => {
  const { id } = useParams();
  const { API, addToCart } = useContext(CartContext);
  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    loadProduct();
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

  const variantGroups = useMemo(() => getProductVariantGroups(product), [product]);

  const handleAddToCart = () => {
    if (!product || quantity <= 0) return;
    // Require a choice for every variant axis before adding to cart.
    const missing = variantGroups.find((g) => !selectedVariants[g.name]);
    if (missing) {
      toast.error(`Please select a ${missing.name.toLowerCase()}`);
      return;
    }
    addToCart(product, quantity, variantGroups.length ? selectedVariants : null);
  };

  useSeo({
    title: product?.meta_title || product?.name,
    description: product?.meta_description || product?.description,
    image: product?.images?.[0] ? resolveImageUrl(product.images[0]) : undefined,
    keywords: productKeywords(product),
  });

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
          {/* Breadcrumb */}
          <nav className="text-sm text-ink-muted mb-6">
            <Link to="/" className="hover:text-gold-600">Home</Link>
            <span className="mx-2">/</span>
            <Link to={`/shop/${product.category}`} className="hover:text-gold-600 capitalize">{product.category}</Link>
            <span className="mx-2">/</span>
            <span className="text-ink-soft line-clamp-1">{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Images */}
            <div>
              <div className="mb-4 overflow-hidden rounded-2xl bg-cream shadow-card">
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
                      className={`w-full h-24 object-cover cursor-pointer rounded-lg border-2 transition-colors ${
                        selectedImage === idx ? 'border-gold-500' : 'border-transparent hover:border-gold-200'
                      }`}
                      onClick={() => setSelectedImage(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.on_sale && <span className="bg-red-600 text-white px-3 py-1 text-xs font-bold rounded-full">SALE</span>}
                {product.is_new && <span className="bg-green-600 text-white px-3 py-1 text-xs font-bold rounded-full">NEW</span>}
                {product.best_seller && <span className="bg-gold-500 text-white px-3 py-1 text-xs font-bold rounded-full">BEST SELLER</span>}
              </div>
              <h1
                className="text-4xl md:text-5xl font-bold mb-4"
                style={{ fontFamily: 'Playfair Display' }}
                data-testid="product-name"
              >
                {product.name}
              </h1>
              <div className="flex items-center gap-3 mb-6" data-testid="product-price">
                <span className={`text-3xl font-bold ${product.on_sale ? 'text-red-600' : 'text-gold-600'}`}>
                  ${product.price.toFixed(2)}
                </span>
                {product.on_sale && product.compare_at_price && (
                  <span className="text-xl text-gray-400 line-through">${product.compare_at_price.toFixed(2)}</span>
                )}
              </div>
              {typeof product.stock === 'number' && (
                <p className={`mb-6 text-sm font-medium ${product.stock > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {product.stock > 0 ? (product.stock <= 5 ? `Only ${product.stock} left in stock` : 'In stock') : 'Out of stock'}
                </p>
              )}
              {product.description && (
                <div className="mb-6">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted mb-2">
                    Description
                  </h2>
                  <div className="text-gray-700 text-base md:text-lg leading-relaxed space-y-3">
                    {product.description
                      .split(/\n\s*\n|\r\n\r\n/)
                      .map((para) => para.trim())
                      .filter(Boolean)
                      .map((para, idx) => (
                        <p key={idx} className="whitespace-pre-line">{para}</p>
                      ))}
                  </div>
                </div>
              )}

              {/* Variant Selectors (color, size, ... parsed from description) */}
              {variantGroups.map((group) => (
                <div className="mb-6" key={group.name} data-testid={`variant-${group.name}`}>
                  <label className="block text-sm font-semibold mb-2">
                    {group.name}
                    {selectedVariants[group.name] && (
                      <span className="ml-2 font-normal text-ink-muted">: {selectedVariants[group.name]}</span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((value) => {
                      const active = selectedVariants[group.name] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setSelectedVariants((prev) => ({ ...prev, [group.name]: value }))
                          }
                          className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                            active
                              ? 'border-gold-500 bg-gold-500 text-white'
                              : 'border-gray-300 hover:border-gold-400'
                          }`}
                          data-testid={`variant-option-${group.name}-${value}`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

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
                  disabled={product.stock === 0}
                  className="flex-1 btn-gold text-white py-6 text-lg rounded-full"
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
                  disabled={product.stock === 0}
                  variant="outline"
                  className="flex-1 border-2 border-ink hover:bg-ink hover:text-white py-6 text-lg rounded-full"
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
      </div>
      <Footer />
    </div>
  );
};

export default ProductPage;