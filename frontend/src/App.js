import React, { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Components
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import TrackOrderPage from './pages/TrackOrderPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MyOrders from './pages/MyOrders';
import Wishlist from './pages/Wishlist';
import LoginPage from './pages/LoginPage';
import AccountPage from './pages/AccountPage';
import FAQPage from './pages/FAQPage';
import TermsOfService from './pages/TermsOfService';
import RefundPolicy from './pages/RefundPolicy';
import WhatsAppButton from './components/WhatsAppButton';
import FloatingAnnouncement from './components/FloatingAnnouncement';
import GoogleAnalytics from './components/GoogleAnalytics';
import { I18nProvider } from './i18n';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Cart Context
export const CartContext = React.createContext();

function App() {
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    // Load user if token exists
    if (token) {
      loadUser();
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  };

  const addToCart = (product, quantity = 1) => {
    const existingItem = cart.find(item => item.id === product.id);
    let newCart;
    
    if (existingItem) {
      newCart = cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      newCart = [...cart, { ...product, quantity }];
    }
    
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    toast.success('Added to cart');
  };

  const updateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const newCart = cart.map(item =>
      item.id === productId ? { ...item, quantity } : item
    );
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const removeFromCart = (productId) => {
    const newCart = cart.filter(item => item.id !== productId);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    toast.success('Removed from cart');
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Wishlist function
  const addToWishlist = async (productId) => {
    try {
      if (!token) {
        // Add to localStorage for non-logged users
        const localWishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
        if (!localWishlist.includes(productId)) {
          localWishlist.push(productId);
          localStorage.setItem('wishlist', JSON.stringify(localWishlist));
          toast.success('Added to wishlist');
          return true;
        } else {
          toast.info('Already in wishlist');
          return false;
        }
      } else {
        // Add to backend for logged users
        const headers = { Authorization: `Bearer ${token}` };
        await axios.post(`${API}/wishlist/${productId}`, {}, { headers });
        toast.success('Added to wishlist');
        return true;
      }
    } catch (error) {
      if (error.response?.status === 409) {
        toast.info('Already in wishlist');
        return false;
      }
      toast.error('Failed to add to wishlist');
      console.error('Failed to add to wishlist:', error);
      return false;
    }
  };

  const isInWishlist = (productId) => {
    if (!token) {
      const localWishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      return localWishlist.includes(productId);
    }
    // For logged users, this would need to be loaded from backend
    // We'll handle this in the component level
    return false;
  };

  return (
    <I18nProvider>
      <CartContext.Provider value={{
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
        user,
        token,
        login,
        logout,
        API,
        addToWishlist,
        isInWishlist
      }}>
        <div className="App">
          <BrowserRouter>
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/shop/:category" element={<ShopPage />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
              <Route path="/track-order" element={<TrackOrderPage />} />
              <Route path="/my-orders" element={<MyOrders />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Routes>
            <WhatsAppButton />
            <FloatingAnnouncement />
            <GoogleAnalytics />
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </div>
      </CartContext.Provider>
    </I18nProvider>
  );
}

export default App;