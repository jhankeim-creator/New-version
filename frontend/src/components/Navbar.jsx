import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Search, LogOut, Heart, ChevronDown, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { CartContext } from '../App';
import { buildCategoryTree, displayCategoryName } from '../lib/utils';
import { Button } from './ui/button';
import Logo from './Logo';
import SearchBar from './SearchBar';
import { useI18n } from '../i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './ui/dropdown-menu';

const Navbar = () => {
  const { cartCount, user, logout, API } = useContext(CartContext);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categoryTree, setCategoryTree] = useState([]);
  const [openMobileCats, setOpenMobileCats] = useState({});
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();

  const toggleMobileCat = (slug) =>
    setOpenMobileCats((prev) => ({ ...prev, [slug]: !prev[slug] }));

  const goToCategory = (slug) => {
    setIsMobileMenuOpen(false);
    navigate(`/shop/${slug}`);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let active = true;
    axios.get(`${API}/categories/with-counts`)
      .then((res) => {
        if (!active) return;
        // Build the full mother -> sub-category -> brand tree. Do NOT pre-filter
        // by product_count: mother categories (e.g. Jewelry) hold no products
        // directly, so buildCategoryTree aggregates counts and prunes empties.
        setCategoryTree(buildCategoryTree(res.data || []));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [API]);

  // Desktop: nested fly-out submenus (mother -> sub-category -> brand).
  const renderDesktopNodes = (nodes) =>
    nodes.map((node) =>
      node.children && node.children.length > 0 ? (
        <DropdownMenuSub key={node.slug}>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <span className="flex-1">{displayCategoryName(node.name)}</span>
            <span className="ml-2 text-xs opacity-60">{node.total}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-[70vh] overflow-y-auto w-56">
            <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => goToCategory(node.slug)}>
              All {displayCategoryName(node.name)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {renderDesktopNodes(node.children)}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : (
        <DropdownMenuItem key={node.slug} className="cursor-pointer" onClick={() => goToCategory(node.slug)}>
          <span className="flex-1">{displayCategoryName(node.name)}</span>
          <span className="ml-2 text-xs opacity-60">{node.total}</span>
        </DropdownMenuItem>
      )
    );

  // Mobile: nested, collapsible indented list.
  const renderMobileNodes = (nodes, depth = 0) =>
    nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isOpen = !!openMobileCats[node.slug];
      return (
        <div key={node.slug}>
          <div className="flex items-center justify-between">
            <button
              className={`flex-1 text-left py-1.5 ${depth === 0 ? 'font-semibold text-gray-800' : 'text-sm text-gray-600'} hover:text-[#d4af37]`}
              onClick={() => goToCategory(node.slug)}
            >
              {displayCategoryName(node.name)}
              <span className="ml-2 text-xs text-gray-400">{node.total}</span>
            </button>
            {hasChildren && (
              <button
                className="p-1 text-gray-500"
                aria-label={`Expand ${displayCategoryName(node.name)}`}
                onClick={() => toggleMobileCat(node.slug)}
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          {hasChildren && isOpen && (
            <div className="pl-3 border-l border-gold-100 ml-1">
              {renderMobileNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-[0_4px_20px_-8px_rgba(20,17,15,0.25)] border-gold-100'
          : 'bg-white/90 backdrop-blur-sm border-transparent'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Logo size={38} />

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <SearchBar />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="nav-link">
              {t('nav.home')}
            </Link>
            <Link to="/shop" className="nav-link">
              {t('nav.shopAll')}
            </Link>
            {categoryTree.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="nav-link inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer">
                    Categories <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto w-60">
                  <DropdownMenuLabel className="text-xs uppercase tracking-wider text-gray-400">
                    Shop by category
                  </DropdownMenuLabel>
                  {renderDesktopNodes(categoryTree)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link to="/blog" className="nav-link">
              Blog
            </Link>
            <Link to="/track-order" className="nav-link">
              {t('nav.trackOrder')}
            </Link>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Language toggle */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
                title={t('common.language')}
              >
                {lang.toUpperCase()}
              </Button>
            </div>
            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/account')}>
                    {t('nav.myAccount')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-orders')}>
                    {t('nav.myOrders')}
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      {t('nav.adminDashboard')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/login')}
                data-testid="login-button"
                title={t('nav.loginTitle')}
              >
                <User className="h-5 w-5" />
              </Button>
            )}

            {/* Wishlist - Visible on both mobile and desktop */}
            <Link to="/wishlist" className="relative" data-testid="wishlist-button">
              <Button variant="ghost" size="icon" title="Wishlist">
                <Heart className="h-5 w-5" />
              </Button>
            </Link>

            {/* Cart - Visible on both mobile and desktop */}
            <Link to="/cart" className="relative" data-testid="cart-button">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#d4af37] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden relative z-[10000]"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="mobile-menu-toggle"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-3">
            {/* Mobile Search Bar */}
            <div className="px-2 py-2">
              <SearchBar />
            </div>
            
            <Link
              to="/"
              className="block py-2 text-gray-700 hover:text-[#d4af37]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('nav.home')}
            </Link>
            <Link
              to="/shop"
              className="block py-2 text-gray-700 hover:text-[#d4af37]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('nav.shopAll')}
            </Link>
            {categoryTree.length > 0 && (
              <div className="py-1">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Categories</p>
                <div className="max-h-72 overflow-y-auto pl-2 border-l border-gold-100">
                  {renderMobileNodes(categoryTree)}
                </div>
              </div>
            )}
            <Link
              to="/blog"
              className="block py-2 text-gray-700 hover:text-[#d4af37]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              to="/track-order"
              className="block py-2 text-gray-700 hover:text-[#d4af37]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('nav.trackOrder')}
            </Link>
            <Link
              to="/wishlist"
              className="block py-2 text-gray-700 hover:text-[#d4af37]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('nav.wishlist')}
            </Link>
            <Link
              to="/my-orders"
              className="block py-2 text-gray-700 hover:text-[#d4af37]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t('nav.myOrders')}
            </Link>

            {/* Mobile language toggle */}
            <button
              className="block py-2 text-left w-full text-gray-700 hover:text-[#d4af37]"
              onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
            >
              {t('common.language')}: {lang.toUpperCase()}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;