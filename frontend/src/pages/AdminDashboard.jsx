import { useState, useEffect, useContext } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { CartContext } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import AdminProducts from '../components/AdminProducts';
import AdminOrders from '../components/AdminOrders';
import AdminCategories from '../components/AdminCategories';
import AdminDashboardStats from '../components/admin/AdminDashboard';
import AdminCoupons from '../components/admin/AdminCoupons';
import AdminCustomers from '../components/admin/AdminCustomers';
import CategoryManager from '../components/admin/CategoryManager';
import AdminProductAdd from '../components/admin/AdminProductAdd';
import AdminSettings from '../components/admin/AdminSettings';
import AdminTeam from '../components/admin/AdminTeam';
import axios from 'axios';
import { toast } from 'sonner';
import { Package, ShoppingCart, Users, DollarSign, Home, LayoutDashboard, Tag, UserCircle, FolderTree, Settings, Plus, UsersRound } from 'lucide-react';

const AdminDashboard = () => {
  const { user, token, API } = useContext(CartContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !token) {
      toast.error('Please login to access admin dashboard');
      navigate('/admin/login');
      return;
    }
    if (user.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
  }, [user, token]);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1
              className="text-4xl md:text-5xl font-bold"
              style={{ fontFamily: 'Playfair Display' }}
              data-testid="admin-dashboard-title"
            >
              Admin Dashboard
            </h1>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              data-testid="back-to-store-button"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Store
            </Button>
          </div>

          {/* Management Tabs */}
          <Card>
            <CardContent className="p-6">
              <Tabs defaultValue="dashboard">
                <TabsList className="mb-6 flex flex-wrap gap-2">
                  <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="add-product" data-testid="tab-add-product" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Product
                  </TabsTrigger>
                  <TabsTrigger value="products" data-testid="tab-products" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Products
                  </TabsTrigger>
                  <TabsTrigger value="orders" data-testid="tab-orders" className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Orders
                  </TabsTrigger>
                  <TabsTrigger value="customers" data-testid="tab-customers" className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    Customers
                  </TabsTrigger>
                  <TabsTrigger value="coupons" data-testid="tab-coupons" className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Coupons
                  </TabsTrigger>
                  <TabsTrigger value="categories" data-testid="tab-categories" className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    Categories
                  </TabsTrigger>
                  <TabsTrigger value="team" data-testid="tab-team" className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    Team
                  </TabsTrigger>
                  <TabsTrigger value="settings" data-testid="tab-settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="dashboard">
                  <AdminDashboardStats />
                </TabsContent>
                
                <TabsContent value="add-product">
                  <AdminProductAdd />
                </TabsContent>
                
                <TabsContent value="products">
                  <AdminProducts />
                </TabsContent>
                
                <TabsContent value="orders">
                  <AdminOrders />
                </TabsContent>
                
                <TabsContent value="customers">
                  <AdminCustomers />
                </TabsContent>
                
                <TabsContent value="coupons">
                  <AdminCoupons />
                </TabsContent>
                
                <TabsContent value="categories">
                  <CategoryManager />
                </TabsContent>
                
                <TabsContent value="team">
                  <AdminTeam />
                </TabsContent>
                
                <TabsContent value="settings">
                  <AdminSettings />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;