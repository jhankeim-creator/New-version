import { useEffect, useState, useContext, useRef } from 'react';
import { resolveImageUrl, categoryParent, parentRank } from '../lib/utils';
import { useSeo } from '../lib/seo';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Star, ChevronLeft, ChevronRight, Heart, Truck, ShieldCheck, Headphones, BadgeCheck } from 'lucide-react';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import Footer from '../components/Footer';
import axios from 'axios';

const HomePage = () => {
  const { API, addToCart, token, addToWishlist } = useContext(CartContext);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);

  useSeo({
    title: 'Luxury Watches & Fashion',
    description: 'Designer watches, curated clothing and exclusive accessories at Kayee01.',
    path: '/',
  });

  useEffect(() => {
    loadData();
    loadWishlistItems();
  }, [token]);

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes, bestSellersRes] = await Promise.all([
        axios.get(`${API}/products?featured=true`),
        axios.get(`${API}/categories/with-counts`),
        axios.get(`${API}/products/best-sellers?limit=12`)
      ]);
      setFeaturedProducts(productsRes.data.slice(0, 30));
      // Show one card per SECTION (e.g. Bags, Shoes, Jewelry, T-Shirt) rather
      // than every brand, so the homepage stays clean. Sections are derived
      // from the categories' section_slug; categories without a section fall
      // back to themselves.
      const bySection = new Map();
      (categoriesRes.data || [])
        .filter((c) => c.product_count > 0)
        .forEach((c) => {
          const parent = categoryParent(c);
          const slug = parent.slug || c.slug;
          const name = parent.name || c.name;
          if (!bySection.has(slug)) {
            bySection.set(slug, { id: slug, slug, name, description: '', image: c.image, total: 0 });
          }
          bySection.get(slug).total += c.product_count || 0;
        });
      // Preferred section order (Clothes, Shoes, Bags, Jewelry, Watches, ...).
      setCategories(Array.from(bySection.values())
        .sort((a, b) => parentRank(a.slug) - parentRank(b.slug) || b.total - a.total));
      
      // Ensure at least 3 best sellers are shown
      const sellers = bestSellersRes.data;
      if (sellers.length < 3 && productsRes.data.length > 0) {
        // Fill with featured products if not enough best sellers
        const needed = 3 - sellers.length;
        const featured = productsRes.data.slice(0, needed);
        setBestSellers([...sellers, ...featured].slice(0, 12));
      } else {
        setBestSellers(sellers);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadWishlistItems = async () => {
    try {
      if (!token) {
        const localWishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        setWishlistItems(localWishlist);
      } else {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(`${API}/wishlist`, { headers });
        setWishlistItems(response.data.map(p => p.id));
      }
    } catch (error) {
      console.error('Failed to load wishlist:', error);
    }
  };

  const handleWishlistClick = async (e, productId) => {
    e.stopPropagation();
    const success = await addToWishlist(productId);
    if (success) {
      setWishlistItems(prev => [...prev, productId]);
    }
  };

  const isInWishlist = (productId) => {
    return wishlistItems.includes(productId);
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Background Image */}
      <section
        className="relative h-[640px] bg-cover bg-center"
        style={{
          backgroundImage: 'url(/hero-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75"></div>
        <div className="relative h-full flex items-center justify-center text-center px-4">
          <div className="max-w-4xl animate-fade-up">
            <p className="eyebrow text-gold-300 mb-5">Timeless Elegance</p>
            <h1
              className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
              style={{ fontFamily: 'Playfair Display' }}
            >
              Luxury Watches <span className="text-gold-400">&</span> Fashion
            </h1>
            <p className="text-lg md:text-2xl text-white/85 mb-10 max-w-2xl mx-auto font-light">
              Designer watches, curated clothing and exclusive accessories — crafted for those who value the finer details.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                onClick={() => navigate('/shop')}
                size="lg"
                className="btn-gold text-white text-base px-9 py-6 rounded-full shadow-luxe"
              >
                Shop the Collection <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => navigate('/shop/jewelry')}
                size="lg"
                variant="outline"
                className="text-base px-9 py-6 rounded-full border-white/70 text-white bg-white/5 hover:bg-white hover:text-ink"
              >
                Explore Jewelry
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Benefits Bar */}
      <section className="border-b border-gray-100 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
            {[
              { icon: Truck, title: 'Worldwide Shipping', text: 'Fast, tracked delivery' },
              { icon: ShieldCheck, title: 'Secure Payments', text: 'Card & crypto protected' },
              { icon: BadgeCheck, title: 'Premium Quality', text: 'Curated 1:1 luxury' },
              { icon: Headphones, title: 'Dedicated Support', text: 'WhatsApp assistance' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-center gap-3 py-6 px-2 text-center sm:text-left">
                <item.icon className="h-7 w-7 text-[#d4af37] flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm md:text-base text-gray-900">{item.title}</p>
                  <p className="text-xs md:text-sm text-gray-500">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-20 bg-cream">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center mb-12">
            <p className="eyebrow mb-3">Curated Selections</p>
            <h2
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Playfair Display' }}
            >
              Shop by Category
            </h2>
            <div className="gold-divider" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/shop/${category.slug}`}
                className="group relative overflow-hidden rounded-xl shadow-card ring-1 ring-black/5 hover:ring-gold-300 hover:shadow-luxe transition-all duration-300"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={resolveImageUrl(category.image)}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-xl font-bold mb-1" style={{ fontFamily: 'Playfair Display' }}>
                      {category.name}
                    </h3>
                    <p className="text-sm opacity-90">{category.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Best Sellers - Horizontal Scroll */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="eyebrow mb-3">Most Loved</p>
              <h2
                className="text-4xl md:text-5xl font-bold"
                style={{ fontFamily: 'Playfair Display' }}
              >
                Best Sellers
              </h2>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={scrollLeft}
                variant="outline"
                size="icon"
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                onClick={scrollRight}
                variant="outline"
                size="icon"
                className="rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div 
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {bestSellers.length === 0 ? (
              <div className="w-full text-center py-12">
                <p className="text-gray-500">No best sellers available yet</p>
              </div>
            ) : (
              bestSellers.map((product) => (
                <div
                  key={product.id}
                  className="flex-shrink-0 w-64 md:w-72 lg:w-80 group cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="relative overflow-hidden rounded-lg mb-4 bg-gray-100" style={{ aspectRatio: '1/1' }}>
                    {product.images && product.images[0] && (
                      <img
                        src={resolveImageUrl(product.images[0])}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    )}
                    {product.on_sale && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 text-xs font-bold rounded">
                        SALE
                      </span>
                    )}
                    {product.is_new && (
                      <span className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 text-xs font-bold rounded">
                        NEW
                      </span>
                    )}
                    {product.best_seller && (
                      <span className="absolute top-2 left-2 bg-[#d4af37] text-white px-3 py-1 text-xs font-bold rounded">
                        BEST SELLER
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">{product.name}</h3>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {product.on_sale && product.original_price ? (
                        <>
                          <span className="text-red-600 font-bold text-xl">${product.price.toFixed(2)}</span>
                          <span className="text-gray-400 line-through text-sm">${product.original_price.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-gray-900 font-bold text-xl">${product.price.toFixed(2)}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleWishlistClick(e, product.id)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Add to wishlist"
                    >
                      <Heart
                        className={`h-5 w-5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                      />
                    </button>
                  </div>
                  {product.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-gray-600">{product.rating} ({product.reviews_count || 0})</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Products - 3 columns grid Ecwid-style */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center mb-12">
            <p className="eyebrow mb-3">Handpicked</p>
            <h2
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Playfair Display' }}
            >
              Featured Collection
            </h2>
            <div className="gold-divider mb-4" />
            <p className="text-ink-muted text-lg">Curated pieces, selected just for you</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featuredProducts.map((product) => (
              <Card
                key={product.id}
                className="group cursor-pointer overflow-hidden rounded-xl border border-black/5 shadow-card hover:shadow-luxe hover:-translate-y-1 transition-all duration-300"
                onClick={() => navigate(`/product/${product.id}`)}
                data-testid={`featured-product-${product.id}`}
              >
                <div className="relative overflow-hidden aspect-square">
                  <img
                    src={resolveImageUrl(product.images[0])}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Multiple Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {product.on_sale && (
                      <span className="bg-red-600 text-white px-3 py-1 text-xs font-bold rounded-full shadow-lg">
                        SALE
                      </span>
                    )}
                    {product.is_new && (
                      <span className="bg-green-600 text-white px-3 py-1 text-xs font-bold rounded-full shadow-lg">
                        NEW
                      </span>
                    )}
                    {product.best_seller && (
                      <span className="bg-[#d4af37] text-white px-3 py-1 text-xs font-bold rounded-full shadow-lg">
                        BEST SELLER
                      </span>
                    )}
                  </div>
                  {product.featured && !product.on_sale && !product.is_new && !product.best_seller && (
                    <div className="absolute top-3 right-3 bg-purple-600 text-white px-3 py-1 text-xs font-bold rounded-full shadow-lg">
                      FEATURED
                    </div>
                  )}
                  {/* Quick Add Button on Hover */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      className="bg-white text-black hover:bg-[#d4af37] hover:text-white font-semibold px-6"
                    >
                      Quick Add
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-base mb-2 line-clamp-2 min-h-[3rem]">{product.name}</h3>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {product.on_sale && product.compare_at_price ? (
                        <>
                          <span className="text-xl font-bold text-red-600">${product.price.toFixed(2)}</span>
                          <span className="text-sm text-gray-500 line-through">${product.compare_at_price.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-xl font-bold text-[#d4af37]">${product.price.toFixed(2)}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleWishlistClick(e, product.id)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Add to wishlist"
                    >
                      <Heart
                        className={`h-5 w-5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                      />
                    </button>
                  </div>
                  {product.rating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{product.rating.toFixed(1)}</span>
                      {product.reviews_count > 0 && <span>({product.reviews_count})</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button
              onClick={() => navigate('/shop')}
              variant="outline"
              size="lg"
              className="rounded-full px-8 border-2 border-ink hover:bg-ink hover:text-white transition-colors"
            >
              View All Products <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;