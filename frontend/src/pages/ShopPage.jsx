import { useEffect, useState, useContext, useMemo } from 'react';
import { resolveImageUrl, categoryParent, buildCategoryTree, findCategoryNode, displayCategoryName } from '../lib/utils';
import { useSeo } from '../lib/seo';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import CategoryTiles from '../components/CategoryTiles';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'sonner';
import { Heart, ChevronRight } from 'lucide-react';

// Umbrella collections map a friendly slug to the brand/type categories that
// belong to it, so pages like /shop/jewelry aggregate related products instead
// of being empty (the catalog is organised by brand).
// Legacy umbrella slugs kept for backward-compatible links. Section browsing is
// now driven dynamically from each category's `section_slug` (see sectionMap).
const CATEGORY_GROUPS = {
  jewelry: ['jewelry', 'necklace', 'bracelet', 'earring', 'ring', 'cartier', 'bvlgari', 'chanel', 'dior'],
  watches: ['watches', 'other-watche', 'rolex', 'omega', 'audemars-piguet', 'richard-mille', 'cartier', 'bvlgari', 'bell-&-ross', 'antoine-preziuso'],
};

const ShopPage = () => {
  const { category } = useParams();
  const { API, addToCart, token, addToWishlist } = useContext(CartContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const productsPerPage = 20;
  const navigate = useNavigate();
  const location = useLocation();
  const [wishlistItems, setWishlistItems] = useState([]);

  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });
  const [sortBy, setSortBy] = useState('featured');

  // Maps a section slug (e.g. "bags") to its member brand category slugs
  // (e.g. ["bags-lv", "bags-gucci"]), so /shop/<section> aggregates all brands.
  const [sectionMap, setSectionMap] = useState({});
  const [categoryTree, setCategoryTree] = useState([]);

  useSeo({
    title: category ? `${category.charAt(0).toUpperCase()}${category.slice(1)} Collection` : 'Shop All Products',
    description: 'Browse the full Kayee01 collection of jewelry, watches, fashion and accessories.',
    keywords: category ? [String(category).replace(/-/g, ' '), 'buy online', 'designer'] : ['shop', 'jewelry', 'watches', 'accessories'],
    // Never include ?sort / ?page query strings in the canonical.
    path: category ? `/shop/${category}` : '/shop',
  });

  useEffect(() => {
    let active = true;
    axios.get(`${API}/categories/with-counts`)
      .then((res) => {
        if (!active) return;
        const list = res.data || [];
        const m = {};
        list.forEach((c) => {
          const parent = categoryParent(c);
          if (parent.slug && parent.slug !== c.slug) {
            (m[parent.slug] = m[parent.slug] || []).push(c.slug);
          }
        });
        setSectionMap(m);
        setCategoryTree(buildCategoryTree(list));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [API]);

  const currentNode = useMemo(
    () => (category ? findCategoryNode(categoryTree, category) : null),
    [categoryTree, category]
  );
  const childCategories = currentNode?.children?.length ? currentNode.children : [];
  // On /shop with no category, show mother categories to mirror the homepage/menu.
  const browseNodes = category ? childCategories : categoryTree;

  const breadcrumb = useMemo(() => {
    if (!category || !categoryTree.length) return [];
    const path = [];
    const walk = (nodes, trail) => {
      for (const n of nodes) {
        const next = [...trail, n];
        if (n.slug === category) {
          path.push(...next);
          return true;
        }
        if (n.children?.length && walk(n.children, next)) return true;
      }
      return false;
    };
    walk(categoryTree, []);
    return path;
  }, [category, categoryTree]);

  useEffect(() => {
    setPage(1);
    loadProducts(1);
  }, [category, priceRange, sortBy, sectionMap]);

  useEffect(() => {
    if (page > 1) {
      loadProducts(page);
    }
  }, [page]);

  useEffect(() => {
    loadWishlistItems();
  }, [token]);

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

  const loadProducts = async (currentPage) => {
    // /shop root shows category tiles only (no product dump).
    if (!category) {
      setProducts([]);
      setTotalProducts(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const skip = (currentPage - 1) * productsPerPage;
      const searchParams = new URLSearchParams(location.search);
      const tags = searchParams.get('tags');
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: productsPerPage.toString()
      });

      if (category) {
        const expandMembers = (slug, depth = 0) => {
          const direct = sectionMap[slug] || CATEGORY_GROUPS[slug];
          if (!direct || depth > 4) return [slug];
          const out = [];
          direct.forEach((m) => {
            if ((sectionMap[m] || CATEGORY_GROUPS[m]) && m !== slug) {
              out.push(...expandMembers(m, depth + 1));
            } else {
              out.push(m);
            }
          });
          return out;
        };
        const hasChildren = sectionMap[category] || CATEGORY_GROUPS[category];
        const members = hasChildren
          ? Array.from(new Set([...expandMembers(category), category]))
          : null;
        params.append('category', members ? members.join(',') : category);
      }

      if (tags) {
        params.append('tags', tags);
      }

      if (priceRange.min > 0) {
        params.append('min_price', priceRange.min.toString());
      }
      if (priceRange.max < 10000) {
        params.append('max_price', priceRange.max.toString());
      }

      if (sortBy) {
        params.append('sort', sortBy);
      }

      const [productsRes, countRes] = await Promise.all([
        axios.get(`${API}/products?${params.toString()}`),
        axios.get(`${API}/products/count?${params.toString()}`)
      ]);

      setProducts(productsRes.data);
      setTotalProducts(countRes.data?.count ?? productsRes.data.length);
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTitle = () => {
    if (!category) return 'Shop by Category';
    if (currentNode) return displayCategoryName(currentNode.name);
    const titleCased = category
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    if (sectionMap[category] || CATEGORY_GROUPS[category]) {
      return `${titleCased} Collection`;
    }
    return titleCased;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center mb-8">
            <p className="eyebrow mb-3">The Collection</p>
            <h1
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Playfair Display' }}
              data-testid="shop-page-title"
            >
              {getTitle()}
            </h1>
            <div className="gold-divider" />
          </div>

          {breadcrumb.length > 0 && (
            <nav
              className="flex flex-wrap items-center justify-center gap-1 text-sm text-gray-500 mb-8"
              aria-label="Category breadcrumb"
            >
              <Link to="/shop" className="hover:text-[#d4af37]">
                Categories
              </Link>
              {breadcrumb.map((node, i) => {
                const isLast = i === breadcrumb.length - 1;
                return (
                  <span key={node.slug} className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                    {isLast ? (
                      <span className="font-medium text-gray-900">{displayCategoryName(node.name)}</span>
                    ) : (
                      <Link to={`/shop/${node.slug}`} className="hover:text-[#d4af37]">
                        {displayCategoryName(node.name)}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          )}

          {browseNodes.length > 0 && (
            <section className="mb-12" data-testid="shop-subcategories">
              <div className="flex flex-col items-center text-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
                  {category ? 'Browse sub-categories' : 'Choose a category'}
                </h2>
                <p className="text-sm text-gray-500">
                  {category
                    ? `Pick a type or brand inside ${displayCategoryName(currentNode?.name || category)}`
                    : 'Organised like the menu — open a collection to see its sub-categories'}
                </p>
              </div>
              <CategoryTiles nodes={browseNodes} />
            </section>
          )}

          {category && (
            <>
              {browseNodes.length > 0 && (
                <div className="flex flex-col items-center text-center mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    All {displayCategoryName(currentNode?.name || category)}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Every product in this collection</p>
                </div>
              )}

              <div className="bg-cream border border-gold-100 p-4 rounded-xl mb-8 space-y-4">
                <div className="flex flex-col space-y-2">
                  <span className="font-semibold text-sm">Price Range:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      placeholder="Min $"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: Number(e.target.value) || 0 })}
                      className="flex-1 min-w-[100px] px-3 py-2 border rounded-md text-sm"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="number"
                      placeholder="Max $"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) || 10000 })}
                      className="flex-1 min-w-[100px] px-3 py-2 border rounded-md text-sm"
                    />
                    <button
                      onClick={() => setPriceRange({ min: 0, max: 10000 })}
                      className="btn-gold px-4 py-2 text-sm text-white rounded-md whitespace-nowrap"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-semibold text-sm whitespace-nowrap">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-md bg-white text-sm"
                  >
                    <option value="featured">Featured</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="newest">Newest First</option>
                  </select>
                </div>

                <div className="text-sm text-gray-600">
                  Showing {products.length} of {totalProducts} products
                </div>
              </div>

              {loading ? (
                <div className="text-center py-20">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-600 text-lg">No products found in this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {products.map((product) => (
                    <Card
                      key={product.id}
                      className="group cursor-pointer overflow-hidden rounded-xl border border-black/5 shadow-card hover:shadow-luxe hover:-translate-y-1 transition-all duration-300"
                      onClick={() => navigate(`/product/${product.id}`)}
                      data-testid={`product-card-${product.id}`}
                    >
                      <div className="relative overflow-hidden aspect-square">
                        <img
                          src={resolveImageUrl(product.images[0])}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
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
                          {product.stock <= 5 && product.stock > 0 && !product.on_sale && !product.is_new && !product.best_seller && (
                            <span className="bg-orange-600 text-white px-3 py-1 text-xs font-bold rounded-full shadow-lg">
                              Only {product.stock} left
                            </span>
                          )}
                        </div>
                        {product.featured && !product.on_sale && !product.is_new && !product.best_seller && (
                          <div className="absolute top-3 right-3 bg-purple-600 text-white px-3 py-1 text-xs font-bold rounded-full shadow-lg">
                            FEATURED
                          </div>
                        )}
                        {product.stock === 0 && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <span className="bg-gray-800 text-white px-4 py-2 text-sm font-bold rounded">
                              Out of Stock
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                            disabled={product.stock === 0}
                            className="bg-white text-black hover:bg-[#d4af37] hover:text-white font-semibold px-6"
                            data-testid={`add-to-cart-${product.id}`}
                          >
                            {product.stock === 0 ? 'Out of Stock' : 'Quick Add'}
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
                              <span className="text-xl font-bold text-gold-600">${product.price.toFixed(2)}</span>
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {totalProducts > productsPerPage && (
                <div className="mt-12 flex flex-wrap justify-center items-center gap-2">
                  <Button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                    data-testid="prev-page"
                  >
                    Previous
                  </Button>

                  <div className="flex flex-wrap justify-center gap-2">
                    {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = idx + 1;
                      } else if (page <= 3) {
                        pageNumber = idx + 1;
                      } else if (page >= totalPages - 2) {
                        pageNumber = totalPages - 4 + idx;
                      } else {
                        pageNumber = page - 2 + idx;
                      }

                      return (
                        <Button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          variant={page === pageNumber ? "default" : "outline"}
                          size="sm"
                          className={`w-9 px-0 ${page === pageNumber ? "btn-gold text-white" : ""}`}
                          data-testid={`page-${pageNumber}`}
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    variant="outline"
                    size="sm"
                    data-testid="next-page"
                  >
                    Next
                  </Button>

                  <span className="w-full text-center text-sm text-gray-600 mt-2 sm:w-auto sm:mt-0 sm:ml-4">
                    Page {page} of {totalPages} ({totalProducts} products)
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ShopPage;
