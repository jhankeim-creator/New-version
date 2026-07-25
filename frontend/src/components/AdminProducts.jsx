import { useState, useEffect, useContext } from 'react';
import { resolveImageUrl } from '../lib/utils';
import { CartContext } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import { Edit, Trash2, Plus, Copy } from 'lucide-react';
import ProductVariants from './ProductVariants';

const AdminProducts = () => {
  const { API, token } = useContext(CartContext);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    images: '',
    category: '',
    stock: '',
    featured: false,
    has_variants: false,
    variants: [],
    variant_options: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/categories`)
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        images: formData.images.split(',').map(img => img.trim())
      };

      if (editingProduct) {
        await axios.put(`${API}/products/${editingProduct.id}`, productData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Product updated successfully');
      } else {
        await axios.post(`${API}/products`, productData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Product created successfully');
      }

      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      images: product.images.join(', '),
      category: product.category,
      stock: product.stock.toString(),
      featured: product.featured
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await axios.delete(`${API}/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Product deleted successfully');
      loadData();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleDuplicate = async (product) => {
    try {
      const duplicatedProduct = {
        name: `${product.name} (Copy)`,
        description: product.description,
        price: product.price,
        images: product.images,
        category: product.category,
        stock: product.stock,
        featured: false
      };

      await axios.post(`${API}/products`, duplicatedProduct, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Product duplicated successfully');
      loadData();
    } catch (error) {
      console.error('Failed to duplicate product:', error);
      toast.error('Failed to duplicate product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      images: '',
      category: '',
      stock: '',
      featured: false
    });
    setEditingProduct(null);
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manage Products</h2>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-[#d4af37] hover:bg-[#b8941f] text-white"
          data-testid="add-product-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => (
          <div key={product.id} className="border rounded-lg p-4" data-testid={`product-item-${product.id}`}>
            <img
              src={resolveImageUrl(product.images[0])}
              alt={product.name}
              className="w-full h-40 object-cover mb-3"
            />
            <h3 className="font-semibold mb-1 line-clamp-1">{product.name}</h3>
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-[#d4af37]">${product.price.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleEdit(product)}
                variant="outline"
                size="sm"
                className="flex-1"
                data-testid={`edit-product-${product.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleDuplicate(product)}
                variant="outline"
                size="sm"
                className="flex-1 text-blue-600 hover:text-blue-700"
                data-testid={`duplicate-product-${product.id}`}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleDelete(product.id)}
                variant="outline"
                size="sm"
                className="flex-1 text-red-600 hover:text-red-700"
                data-testid={`delete-product-${product.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="stock">Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Product Variants Component */}
            <ProductVariants formData={formData} setFormData={setFormData} />
            
            <div>
              <Label htmlFor="images">Image URLs (comma-separated) *</Label>
              <Textarea
                id="images"
                value={formData.images}
                onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                required
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="featured" className="cursor-pointer">Featured Product</Label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1 bg-[#d4af37] hover:bg-[#b8941f] text-white">
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;