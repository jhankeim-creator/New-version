import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../../App';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Users, Mail, Phone, Package, DollarSign, Crown, Search, Trash2, Edit } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const AdminCustomers = () => {
  const { API, token } = useContext(CartContext);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    loadCustomers();
  }, [filterGroup]);

  const loadCustomers = async () => {
    try {
      const params = {};
      if (filterGroup && filterGroup !== 'all') {
        params.group = filterGroup;
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await axios.get(`${API}/admin/customers`, { params, headers });
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (customerId) => {
    if (!window.confirm('Delete this customer and all their data?')) return;
    
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      await axios.delete(`${API}/admin/customers/${customerId}`, { headers });
      toast.success('Customer deleted successfully');
      loadCustomers();
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('Failed to delete customer');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGroupBadgeStyle = (group) => {
    switch (group) {
      case 'vip':
        return 'bg-purple-100 text-purple-700';
      case 'wholesale':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
          Customer Management
        </h1>
        <p className="text-gray-600">Manage your customers and view their order history</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold">{customers.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">VIP Customers</p>
                <p className="text-2xl font-bold">
                  {customers.filter(c => c.customer_group === 'vip').length}
                </p>
              </div>
              <Crown className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ${customers.reduce((sum, c) => sum + c.total_spent, 0).toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold">
                  {customers.reduce((sum, c) => sum + c.total_orders, 0)}
                </p>
              </div>
              <Package className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="wholesale">Wholesale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customers ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Customer</th>
                  <th className="text-left p-3 font-semibold">Contact</th>
                  <th className="text-left p-3 font-semibold">Group</th>
                  <th className="text-left p-3 font-semibold">Orders</th>
                  <th className="text-left p-3 font-semibold">Total Spent</th>
                  <th className="text-left p-3 font-semibold">Last Order</th>
                  <th className="text-left p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="text-sm text-gray-600">{customer.email}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {customer.phone && (
                          <>
                            <Phone className="h-4 w-4" />
                            {customer.phone}
                          </>
                        )}
                        {!customer.phone && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getGroupBadgeStyle(customer.customer_group)}`}>
                        {customer.customer_group.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-semibold">{customer.total_orders}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-[#d4af37]">${customer.total_spent.toFixed(2)}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-sm text-gray-600">
                        {customer.last_order_date 
                          ? new Date(customer.last_order_date).toLocaleDateString()
                          : '-'}
                      </p>
                    </td>
                    <td className="p-3">
                      <Button
                        onClick={() => deleteCustomer(customer.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold mb-2">No customers found</h3>
                <p className="text-gray-600">
                  {searchTerm || filterGroup !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Customers will appear here after their first order'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCustomers;
