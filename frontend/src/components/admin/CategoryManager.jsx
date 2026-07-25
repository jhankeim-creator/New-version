import { useEffect, useState, useContext } from 'react';
import { CartContext } from '../../App';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Edit, Trash2, FolderPlus, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const CategoryManager = () => {
  const { API, token } = useContext(CartContext);
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: null,
    image: ''
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadCategoriesTree();
  }, []);

  const loadCategoriesTree = async () => {
    try {
      const response = await axios.get(`${API}/v2/categories/tree`);
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/v2/categories`, null, {
        params: {
          name: formData.name,
          description: formData.description,
          parent_id: formData.parent_id,
          image: formData.image
        },
        headers: authHeaders
      });
      
      toast.success('Category created successfully!');
      setShowForm(false);
      setFormData({ name: '', description: '', parent_id: null, image: '' });
      loadCategoriesTree();
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    }
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Delete this category?')) return;
    
    try {
      await axios.delete(`${API}/v2/categories/${categoryId}`, { headers: authHeaders });
      toast.success('Category deleted!');
      loadCategoriesTree();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Categories</h2>
          <p className="text-gray-600">Manage product categories and subcategories</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#d4af37] hover:bg-[#b8941f]">
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? 'Cancel' : 'New Category'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Category Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="E.g. Watches, Clothing"
                  required
                />
              </div>
              
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Category description"
                  required
                />
              </div>
              
              <div>
                <Label>Parent Category (Optional)</Label>
                <select
                  className="w-full border rounded p-2"
                  value={formData.parent_id || ''}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
                >
                  <option value="">None (Main Category)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label>Image URL (Optional)</Label>
                <Input
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              
              <Button type="submit" className="bg-[#d4af37] hover:bg-[#b8941f]">
                Create Category
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((category) => (
          <Card key={category.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderPlus className="h-5 w-5 text-[#d4af37]" />
                    <h3 className="text-xl font-bold">{category.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {category.product_count || 0} products
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData({ ...category, parent_id: null });
                      setEditingId(category.id);
                      setShowForm(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>

              {category.subcategories && category.subcategories.length > 0 && (
                <div className="mt-4 pl-4 border-l-2 border-[#d4af37]/30">
                  <p className="text-sm font-semibold mb-2">Subcategories:</p>
                  {category.subcategories.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3" />
                        <span>{sub.name}</span>
                        <span className="text-xs text-gray-500">({sub.product_count || 0})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sub.id)}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderPlus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold mb-2">No categories yet</h3>
            <p className="text-gray-600 mb-4">Create your first category to organize products</p>
            <Button onClick={() => setShowForm(true)} className="bg-[#d4af37] hover:bg-[#b8941f]">
              <Plus className="h-4 w-4 mr-2" />
              Create First Category
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CategoryManager;