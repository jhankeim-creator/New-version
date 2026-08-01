import React, { useState, useContext, useEffect } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'sonner';
import { User, Package, Heart, MessageCircle, Mail, Phone, MapPin, Calendar, LogOut, ShoppingBag, Clock, Star, TrendingUp, LayoutDashboard, ArrowRight } from 'lucide-react';

const AccountPage = () => {
  const { user, token, API, setUser, setToken, logout } = useContext(CartContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    wishlistCount: 0
  });
  
  // Profile form
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    country: user?.country || ''
  });

  // Contact support form
  const [supportData, setSupportData] = useState({
    subject: '',
    message: ''
  });

  useEffect(() => {
    if (!user || !token) {
      toast.error('Please login to access your account');
      navigate('/login');
      return;
    }
    loadOrders();
    loadWishlist();
  }, [user, token]);

  const loadOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
      
      // Calculate stats
      const total = response.data.reduce((sum, order) => sum + order.total, 0);
      setStats(prev => ({
        ...prev,
        totalOrders: response.data.length,
        totalSpent: total
      }));
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const loadWishlist = async () => {
    try {
      const response = await axios.get(`${API}/wishlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Backend returns a plain list of products
      setWishlist(Array.isArray(response.data) ? response.data : (response.data.items || []));
      setStats(prev => ({
        ...prev,
        wishlistCount: Array.isArray(response.data) ? response.data.length : (response.data.items?.length || 0)
      }));
    } catch (error) {
      console.error('Failed to load wishlist:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.put(`${API}/users/profile`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/support/contact`, {
        ...supportData,
        user_email: user.email,
        user_name: user.name
      });
      toast.success('Your message has been sent! We\'ll get back to you soon.');
      setSupportData({ subject: '', message: '' });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const removeFromWishlist = async (productId) => {
    try {
      await axios.delete(`${API}/wishlist/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWishlist(wishlist.filter(item => item.product_id !== productId));
      toast.success('Removed from wishlist');
    } catch (error) {
      toast.error('Failed to remove from wishlist');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Professional Header with Stats - Mobile Optimized */}
          <div className="bg-white rounded-xl md:rounded-2xl shadow-lg p-4 md:p-8 mb-6 md:mb-8">
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8941f] flex items-center justify-center text-white text-xl md:text-2xl font-bold flex-shrink-0">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl md:text-3xl font-bold truncate" style={{ fontFamily: 'Playfair Display' }}>
                      {user.name}
                    </h1>
                    <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 md:gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-600 flex-shrink-0 text-xs md:text-sm"
                >
                  <LogOut className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>

            {/* Stats Cards - Mobile Optimized */}
            <div className="grid grid-cols-3 gap-2 md:gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 md:p-6 rounded-lg md:rounded-xl border border-blue-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-2">
                  <ShoppingBag className="h-5 w-5 md:h-8 md:w-8 text-blue-600 mb-1 md:mb-0" />
                  <span className="text-xl md:text-3xl font-bold text-blue-600">{stats.totalOrders}</span>
                </div>
                <p className="text-xs md:text-sm text-blue-800 font-medium">Orders</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 md:p-6 rounded-lg md:rounded-xl border border-green-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-2">
                  <TrendingUp className="h-5 w-5 md:h-8 md:w-8 text-green-600 mb-1 md:mb-0" />
                  <span className="text-lg md:text-3xl font-bold text-green-600">${stats.totalSpent.toFixed(0)}</span>
                </div>
                <p className="text-xs md:text-sm text-green-800 font-medium">Spent</p>
              </div>

              <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-3 md:p-6 rounded-lg md:rounded-xl border border-pink-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-2">
                  <Heart className="h-5 w-5 md:h-8 md:w-8 text-pink-600 mb-1 md:mb-0" />
                  <span className="text-xl md:text-3xl font-bold text-pink-600">{stats.wishlistCount}</span>
                </div>
                <p className="text-xs md:text-sm text-pink-800 font-medium">Wishlist</p>
              </div>
            </div>
          </div>

          {/* Mobile-Optimized Tabs */}
          <Tabs defaultValue="overview" className="space-y-4 md:space-y-6">
            <TabsList className="grid grid-cols-5 gap-1 md:gap-2 bg-white p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-md w-full overflow-x-auto">
              <TabsTrigger
                value="overview"
                className="flex flex-col items-center justify-center gap-1 md:gap-2 py-2 md:py-4 px-1 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#d4af37] data-[state=active]:to-[#b8941f] data-[state=active]:text-white rounded-md md:rounded-lg transition-all min-w-0"
              >
                <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium truncate w-full text-center">Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="profile" 
                className="flex flex-col items-center justify-center gap-1 md:gap-2 py-2 md:py-4 px-1 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#d4af37] data-[state=active]:to-[#b8941f] data-[state=active]:text-white rounded-md md:rounded-lg transition-all min-w-0"
              >
                <User className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium truncate w-full text-center">Profile</span>
              </TabsTrigger>
              <TabsTrigger 
                value="orders" 
                className="flex flex-col items-center justify-center gap-1 md:gap-2 py-2 md:py-4 px-1 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#d4af37] data-[state=active]:to-[#b8941f] data-[state=active]:text-white rounded-md md:rounded-lg transition-all relative min-w-0"
              >
                <Package className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium truncate w-full text-center">Orders</span>
                {orders.length > 0 && (
                  <span className="absolute -top-1 -right-1 md:top-0 md:right-0 bg-red-500 text-white text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 rounded-full leading-none">{orders.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="wishlist" 
                className="flex flex-col items-center justify-center gap-1 md:gap-2 py-2 md:py-4 px-1 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#d4af37] data-[state=active]:to-[#b8941f] data-[state=active]:text-white rounded-md md:rounded-lg transition-all relative min-w-0"
              >
                <Heart className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium truncate w-full text-center">Wishlist</span>
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 md:top-0 md:right-0 bg-red-500 text-white text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 rounded-full leading-none">{wishlist.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="support" 
                className="flex flex-col items-center justify-center gap-1 md:gap-2 py-2 md:py-4 px-1 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#d4af37] data-[state=active]:to-[#b8941f] data-[state=active]:text-white rounded-md md:rounded-lg transition-all min-w-0"
              >
                <MessageCircle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium truncate w-full text-center">Support</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Recent Orders */}
                <Card className="shadow-lg border-0 lg:col-span-2">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-[#d4af37]" />
                        Recent Orders
                      </CardTitle>
                      <CardDescription>Your latest purchases at a glance</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {orders.length === 0 ? (
                      <div className="text-center py-10">
                        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600 mb-4">You haven't placed any orders yet.</p>
                        <Button onClick={() => navigate('/shop')} className="bg-[#d4af37] hover:bg-[#b8941f]">
                          Start Shopping
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orders.slice(0, 4).map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between gap-3 border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => navigate(`/track-order?order=${order.order_number}`)}
                          >
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{order.order_number}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(order.created_at).toLocaleDateString()} • {order.items.length} item(s)
                              </p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                                order.status === 'completed' || order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {order.status}
                              </span>
                              <span className="font-bold text-[#d4af37]">${order.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick actions + wishlist preview */}
                <div className="space-y-4 md:space-y-6">
                  <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-2">
                      <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/shop')}>
                        Continue Shopping <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/track-order')}>
                        Track an Order <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg border-0">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Heart className="h-4 w-4 text-pink-600" /> Wishlist
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {wishlist.length === 0 ? (
                        <p className="text-sm text-gray-500">No saved items yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {wishlist.slice(0, 3).map((item) => (
                            <div
                              key={item.product_id}
                              className="flex items-center gap-3 cursor-pointer"
                              onClick={() => navigate(`/product/${item.product_id}`)}
                            >
                              <img
                                src={resolveImageUrl(item.product_image)}
                                alt={item.product_name}
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.product_name}</p>
                                <p className="text-sm text-[#d4af37] font-bold">${item.product_price.toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-[#d4af37]" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>Update your account details and preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={profileData.name}
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={profileData.country}
                          onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={profileData.address}
                          onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={profileData.city}
                          onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="bg-[#d4af37] hover:bg-[#b8941f]"
                      disabled={loading}
                    >
                      {loading ? 'Updating...' : 'Update Profile'}
                    </Button>
                  </form>

                  <div className="mt-8 pt-8 border-t">
                    <h3 className="font-semibold mb-4">Account Details</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Member since {new Date(user.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-[#d4af37]" />
                    Order History
                  </CardTitle>
                  <CardDescription>Track and manage all your purchases</CardDescription>
                </CardHeader>
                <CardContent>
                  {orders.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-xl font-semibold mb-2">No Orders Yet</h3>
                      <p className="text-gray-600 mb-4">Start shopping to see your orders here!</p>
                      <Button
                        onClick={() => navigate('/shop')}
                        className="bg-[#d4af37] hover:bg-[#b8941f]"
                      >
                        Start Shopping
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold">{order.order_number}</h3>
                              <p className="text-sm text-gray-600">
                                {new Date(order.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded text-sm ${
                              order.status === 'completed' ? 'bg-green-100 text-green-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              {order.items.length} item(s) • ${order.total.toFixed(2)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/track-order?order=${order.order_number}`)}
                            >
                              Track Order
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wishlist Tab */}
            <TabsContent value="wishlist">
              <Card>
                <CardHeader>
                  <CardTitle>My Wishlist</CardTitle>
                  <CardDescription>Items you've saved for later</CardDescription>
                </CardHeader>
                <CardContent>
                  {wishlist.length === 0 ? (
                    <div className="text-center py-12">
                      <Heart className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-xl font-semibold mb-2">Your Wishlist is Empty</h3>
                      <p className="text-gray-600 mb-4">Save items you love to buy later!</p>
                      <Button
                        onClick={() => navigate('/shop')}
                        className="bg-[#d4af37] hover:bg-[#b8941f]"
                      >
                        Browse Products
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {wishlist.map((item) => (
                        <div key={item.product_id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                          <img
                            src={resolveImageUrl(item.product_image)}
                            alt={item.product_name}
                            className="w-full h-48 object-cover"
                          />
                          <div className="p-4">
                            <h3 className="font-semibold mb-2 line-clamp-1">{item.product_name}</h3>
                            <p className="text-lg font-bold text-[#d4af37] mb-2">
                              ${item.product_price.toFixed(2)}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-[#d4af37] hover:bg-[#b8941f]"
                                onClick={() => navigate(`/product/${item.product_id}`)}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFromWishlist(item.product_id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Support Tab */}
            <TabsContent value="support">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Support</CardTitle>
                  <CardDescription>Need help? Send us a message</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSupportSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        placeholder="What can we help you with?"
                        value={supportData.subject}
                        onChange={(e) => setSupportData({ ...supportData, subject: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="Describe your issue or question..."
                        rows={6}
                        value={supportData.message}
                        onChange={(e) => setSupportData({ ...supportData, message: e.target.value })}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="bg-[#d4af37] hover:bg-[#b8941f]"
                      disabled={loading}
                    >
                      {loading ? 'Sending...' : 'Send Message'}
                    </Button>
                  </form>

                  <div className="mt-8 pt-8 border-t">
                    <h3 className="font-semibold mb-4">Other Ways to Reach Us</h3>
                    <div className="space-y-3">
                      <a href="mailto:support@kayee01.com" className="flex items-center gap-3 text-gray-600 hover:text-[#d4af37]">
                        <Mail className="h-5 w-5" />
                        <span>support@kayee01.com</span>
                      </a>
                      <a href="https://wa.me/1234567890" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-600 hover:text-[#d4af37]">
                        <Phone className="h-5 w-5" />
                        <span>WhatsApp Support</span>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AccountPage;
