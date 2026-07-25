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
import { Edit, Trash2, Plus, Copy, Search, Package, LayoutGrid, Upload } from 'lucide-react';
import ProductVariants from './ProductVariants';

const AdminProducts = () => {
  const { API, token } = useContext(CartContext);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const perPage = 24;
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

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchQuery]);

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/v2/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.url;
      if (url) {
        setFormData((prev) => ({
          ...prev,
          images: prev.images ? `${prev.images}, ${url}` : url,
        }));
        toast.success('Image uploaded');
      }
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

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

  const categoryName = (slug) => {
    const c = categories.find((cat) => cat.slug === slug);
    return c ? c.name : (slug || 'Uncategorized');
  };

  // Count products per category slug (normalized)
  const countFor = (slug) => products.filter((p) => (p.category || '') === slug).length;
  const usedCategorySlugs = Array.from(new Set(products.map((p) => p.category || '')));
  const orderedCategories = [
    ...categories.filter((c) => usedCategorySlugs.includes(c.slug)),
    ...(usedCategorySlugs.includes('') ? [{ id: '__uncat', slug: '', name: 'Uncategorized' }] : []),
  ];

  const query = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    const inCategory = selectedCategory === 'all' || (p.category || '') === selectedCategory;
    const matchesQuery =
      !query ||
      p.name?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query);
    return inCategory && matchesQuery;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageProducts = filteredProducts.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Manage Products</h2>
          <p className="text-sm text-ink-muted mt-1">
            {products.length} products across {orderedCategories.length} categories
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="btn-gold text-white"
          data-testid="add-product-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name or description..."
          className="pl-9"
          data-testid="admin-product-search"
        />
      </div>

      {/* Category filter (normalized by category with counts) */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-ink text-white border-ink'
              : 'bg-white text-ink-soft border-gold-100 hover:border-gold-300'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          All
          <span className="text-xs opacity-70">{products.length}</span>
        </button>
        {orderedCategories.map((cat) => (
          <button
            key={cat.id || cat.slug}
            onClick={() => setSelectedCategory(cat.slug)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === cat.slug
                ? 'bg-ink text-white border-ink'
                : 'bg-white text-ink-soft border-gold-100 hover:border-gold-300'
            }`}
          >
            {cat.name}
            <span className="text-xs opacity-70">{countFor(cat.slug)}</span>
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gold-200 rounded-xl bg-cream">
          <Package className="h-10 w-10 mx-auto text-gold-400 mb-3" />
          <p className="text-ink-muted">No products match your filters.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageProducts.map((product) => (
          <div key={product.id} className="group border border-black/5 rounded-xl p-4 bg-white shadow-card hover:shadow-luxe transition-all" data-testid={`product-item-${product.id}`}>
            <div className="relative mb-3 overflow-hidden rounded-lg bg-cream">
              <img
                src={resolveImageUrl(product.images[0])}
                alt={product.name}
                className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-[11px] font-medium text-ink-soft border border-gold-100">
                {categoryName(product.category)}
              </span>
            </div>
            <h3 className="font-semibold mb-1 line-clamp-1">{product.name}</h3>
            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-gold-600">${product.price.toFixed(2)}</span>
              {typeof product.stock === 'number' && (
                <span className={`text-xs ${product.stock > 0 ? 'text-ink-muted' : 'text-red-500'}`}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              )}
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
      )}

      {/* Pagination */}
      {filteredProducts.length > perPage && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
            Previous
          </Button>
          <span className="text-sm text-ink-muted">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
            Next
          </Button>
        </div>
      )}

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
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="images">Images *</Label>
                <label className="inline-flex items-center gap-1.5 text-sm text-gold-600 cursor-pointer hover:text-gold-700">
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={uploading} />
                </label>
              </div>
              <Textarea
                id="images"
                value={formData.images}
                onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                placeholder="Upload above, or paste image URLs (comma-separated)"
                required
                rows={2}
              />
              {formData.images && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.images.split(',').map((u) => u.trim()).filter(Boolean).map((u, i) => (
                    <img key={i} src={resolveImageUrl(u)} alt="" className="h-14 w-14 object-cover rounded border border-black/5" />
                  ))}
                </div>
              )}
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