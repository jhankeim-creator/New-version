import { useEffect, useState, useContext } from 'react';
import { CartContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const AdminDashboard = ({ onNavigate }) => {
  const { API, token } = useContext(CartContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await axios.get(`${API}/admin/dashboard/stats`, { headers });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Failed to load dashboard statistics</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Sales",
      value: `$${stats.today_sales.toFixed(2)}`,
      subtitle: `${stats.today_orders} orders`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Week Sales",
      value: `$${stats.week_sales.toFixed(2)}`,
      subtitle: `${stats.week_orders} orders`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Total Customers",
      value: stats.total_customers,
      subtitle: "All time",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Pending Orders",
      value: stats.pending_orders,
      subtitle: "Needs attention",
      icon: ShoppingCart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      goTo: "orders"
    },
    {
      title: "Low Stock Items",
      value: stats.low_stock_products,
      subtitle: "Needs restock",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      goTo: "products"
    },
    {
      title: "Total Sales",
      value: `$${stats.total_sales.toFixed(2)}`,
      subtitle: `${stats.total_orders} total orders`,
      icon: Package,
      color: "text-[#d4af37]",
      bgColor: "bg-yellow-50"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
          Dashboard Overview
        </h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your store.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card
            key={index}
            onClick={() => stat.goTo && onNavigate && onNavigate(stat.goTo)}
            className={`hover:shadow-lg transition-shadow ${stat.goTo && onNavigate ? 'cursor-pointer' : ''}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.sales_chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#d4af37" 
                strokeWidth={2}
                dot={{ fill: '#d4af37' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.top_products.slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{product.name}</p>
                    <p className="text-xs text-gray-600">Sales: {product.sales_count || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#d4af37]">${product.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-600">Stock: {product.stock}</p>
                  </div>
                </div>
              ))}
              {stats.top_products.length === 0 && (
                <p className="text-center text-gray-500 py-4">No products yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recent_orders.slice(0, 5).map((order, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{order.order_number}</p>
                    <p className="text-xs text-gray-600">{order.user_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#d4af37]">${order.total.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
              {stats.recent_orders.length === 0 && (
                <p className="text-center text-gray-500 py-4">No recent orders</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
