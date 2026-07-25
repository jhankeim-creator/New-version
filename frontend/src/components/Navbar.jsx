import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Search, LogOut, Heart, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { CartContext } from '../App';
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
} from './ui/dropdown-menu';

const Navbar = () => {
  const { cartCount, user, logout, API } = useContext(CartContext);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let active = true;
    const UMBRELLAS = ['jewelry', 'watches', 'fashion'];
    axios.get(`${API}/categories/with-counts`)
      .then((res) => {
        if (!active) return;
        const cats = (res.data || []).filter((c) => c.product_count > 0 || UMBRELLAS.includes(c.slug));
        setCategories(cats);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [API]);

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
            {categories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="nav-link inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer">
                    Categories <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto w-56">
                  {categories.map((cat) => (
                    <DropdownMenuItem key={cat.id} onClick={() => navigate(`/shop/${cat.slug}`)}>
                      {cat.name}
                    </DropdownMenuItem>
                  ))}
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
            {categories.length > 0 && (
              <div className="py-1">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Categories</p>
                <div className="max-h-52 overflow-y-auto pl-2 border-l border-gold-100">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/shop/${cat.slug}`}
                      className="block py-1.5 text-gray-700 hover:text-[#d4af37]"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))}
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