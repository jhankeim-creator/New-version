import { useEffect, useState, useContext } from 'react';
import { CartContext } from '../../App';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Tag, Trash2, Edit } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const AdminCoupons = () => {
  const { API, token } = useContext(CartContext);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    minimum_purchase: '0',
    max_uses: '',
    active: true,
    valid_until: ''
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await axios.get(`${API}/admin/coupons`, { headers });
      setCoupons(response.data);
    } catch (error) {
      console.error('Failed to load coupons:', error);
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        minimum_purchase: parseFloat(formData.minimum_purchase) || 0,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null
      };

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      await axios.post(`${API}/admin/coupons`, payload, { headers });
      toast.success('Coupon created successfully!');
      setShowForm(false);
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        minimum_purchase: '0',
        max_uses: '',
        active: true,
        valid_until: ''
      });
      loadCoupons();
    } catch (error) {
      console.error('Failed to create coupon:', error);
      toast.error(error.response?.data?.detail || 'Failed to create coupon');
    }
  };

  const handleDelete = async (couponId) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      await axios.delete(`${API}/admin/coupons/${couponId}`, { headers });
      toast.success('Coupon deleted successfully!');
      loadCoupons();
    } catch (error) {
      console.error('Failed to delete coupon:', error);
      toast.error('Failed to delete coupon');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
            Coupons & Promo Codes
          </h1>
          <p className="text-gray-600">Create and manage discount codes for your store</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#d4af37] hover:bg-[#b8941f]"
        >
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? 'Cancel' : 'New Coupon'}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Coupon</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Coupon Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SUMMER20"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="discount_type">Discount Type *</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discount_value">
                    Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'percentage' ? '20' : '10.00'}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="minimum_purchase">Minimum Purchase ($)</Label>
                  <Input
                    id="minimum_purchase"
                    type="number"
                    step="0.01"
                    value={formData.minimum_purchase}
                    onChange={(e) => setFormData({ ...formData, minimum_purchase: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="max_uses">Max Uses (Leave empty for unlimited)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                    placeholder="100"
                  />
                </div>

                <div>
                  <Label htmlFor="valid_until">Valid Until (Optional)</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>

              <Button type="submit" className="bg-[#d4af37] hover:bg-[#b8941f]">
                Create Coupon
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Coupons List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coupons.map((coupon) => (
          <Card key={coupon.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-[#d4af37]" />
                  <h3 className="text-xl font-bold">{coupon.code}</h3>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${
                  coupon.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {coupon.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-semibold">
                    {coupon.discount_type === 'percentage' 
                      ? `${coupon.discount_value}%` 
                      : `$${coupon.discount_value}`}
                  </span>
                </div>

                {coupon.minimum_purchase > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Min Purchase:</span>
                    <span className="font-semibold">${coupon.minimum_purchase}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Uses:</span>
                  <span className="font-semibold">
                    {coupon.uses_count} {coupon.max_uses ? `/ ${coupon.max_uses}` : '/ ∞'}
                  </span>
                </div>

                {coupon.valid_until && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Expires:</span>
                    <span className="font-semibold">
                      {new Date(coupon.valid_until).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(coupon.id)}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {coupons.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold mb-2">No coupons yet</h3>
            <p className="text-gray-600 mb-4">Create your first coupon to start offering discounts</p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#d4af37] hover:bg-[#b8941f]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Coupon
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminCoupons;
