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
import { Edit, Trash2, Plus, Copy, Search, Package, LayoutGrid, Upload, ImageOff } from 'lucide-react';
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [scanningBroken, setScanningBroken] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
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
        // limit=0 returns every product (not just the first 100) and
        // sort=popular surfaces featured / best-selling products first.
        axios.get(`${API}/products?limit=0&sort=popular`),
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

  const scanBrokenImages = async () => {
    setScanningBroken(true);
    try {
      const dry = await axios.post(
        `${API}/products/maintenance/broken-images?apply=false`,
        {},
        { headers: authHeaders() }
      );
      const count = dry.data?.broken_count || 0;
      if (count === 0) {
        toast.success('No products with broken images found');
        return;
      }
      if (!window.confirm(`Found ${count} product(s) whose images are all broken. Delete them permanently?`)) {
        return;
      }
      const res = await axios.post(
        `${API}/products/maintenance/broken-images?apply=true`,
        {},
        { headers: authHeaders() }
      );
      toast.success(`Deleted ${res.data?.deleted || 0} product(s) with broken images`);
      await loadData();
    } catch (err) {
      console.error('Broken image scan failed:', err);
      toast.error('Broken image scan failed');
    } finally {
      setScanningBroken(false);
    }
  };

  const backfillSizesAndImages = async () => {
    setBackfilling(true);
    try {
      const dry = await axios.post(
        `${API}/products/maintenance/backfill-variants-and-images?apply=false`,
        {},
        { headers: authHeaders() }
      );
      const needVar = dry.data?.products_needing_variants || 0;
      const needImg = dry.data?.categories_needing_images || 0;
      if (needVar === 0 && needImg === 0) {
        toast.success('Sizes and category images are already up to date');
        return;
      }
      if (
        !window.confirm(
          `Fill Size options on ${needVar} product(s) and images on ${needImg} categor${needImg === 1 ? 'y' : 'ies'}?`
        )
      ) {
        return;
      }
      const res = await axios.post(
        `${API}/products/maintenance/backfill-variants-and-images?apply=true`,
        {},
        { headers: authHeaders() }
      );
      toast.success(
        `Updated ${res.data?.variants_written || 0} products, ${res.data?.images_written || 0} categories`
      );
      await loadData();
    } catch (err) {
      console.error('Backfill failed:', err);
      toast.error('Backfill failed');
    } finally {
      setBackfilling(false);
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
      name: product.name || '',
      description: product.description || '',
      price: product.price != null ? product.price.toString() : '',
      images: Array.isArray(product.images) ? product.images.join(', ') : '',
      category: product.category || '',
      stock: product.stock != null ? product.stock.toString() : '',
      featured: product.featured || false,
      has_variants: product.has_variants || false,
      variants: Array.isArray(product.variants) ? product.variants : [],
      variant_options: Array.isArray(product.variant_options) ? product.variant_options : []
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
        featured: false,
        has_variants: product.has_variants || false,
        variants: Array.isArray(product.variants) ? product.variants : [],
        variant_options: Array.isArray(product.variant_options) ? product.variant_options : []
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
      featured: false,
      has_variants: false,
      variants: [],
      variant_options: []
    });
    setEditingProduct(null);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : undefined);

  const runBulk = async (fn, successMsg) => {
    setBulkBusy(true);
    try {
      for (const id of selectedIds) {
        // sequential to stay gentle on the free-tier backend
        await fn(id); // eslint-disable-line no-await-in-loop
      }
      toast.success(successMsg);
      setSelectedIds([]);
      await loadData();
    } catch (e) {
      toast.error('Bulk action failed on one or more items');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = () => {
    if (!window.confirm(`Delete ${selectedIds.length} selected product(s)? This cannot be undone.`)) return;
    runBulk(
      (id) => axios.delete(`${API}/products/${id}`, { headers: authHeaders() }),
      'Selected products deleted'
    );
  };

  const bulkSetFeatured = (featured) => {
    runBulk(
      (id) => axios.put(`${API}/products/${id}`, { featured }, { headers: authHeaders() }),
      featured ? 'Marked as featured' : 'Removed from featured'
    );
  };

  const bulkAssignCategory = () => {
    if (!bulkCategory) {
      toast.error('Choose a category first');
      return;
    }
    runBulk(
      (id) => axios.put(`${API}/products/${id}`, { category: bulkCategory }, { headers: authHeaders() }),
      'Category updated for selected products'
    );
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={backfillSizesAndImages}
            variant="outline"
            disabled={backfilling}
            data-testid="backfill-sizes-images-button"
          >
            {backfilling ? 'Filling…' : 'Fill sizes & category images'}
          </Button>
          <Button
            onClick={scanBrokenImages}
            variant="outline"
            disabled={scanningBroken}
            data-testid="scan-broken-images-button"
          >
            <ImageOff className="mr-2 h-4 w-4" />
            {scanningBroken ? 'Scanning…' : 'Remove broken images'}
          </Button>
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

      {/* Bulk actions toolbar */}
      {pageProducts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-cream border border-gold-100">
          <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#a9832f]"
              checked={pageProducts.every((p) => selectedIds.includes(p.id))}
              onChange={(e) =>
                setSelectedIds(
                  e.target.checked
                    ? Array.from(new Set([...selectedIds, ...pageProducts.map((p) => p.id)]))
                    : selectedIds.filter((id) => !pageProducts.some((p) => p.id === id))
                )
              }
            />
            Select page
          </label>
          <span className="text-sm text-ink-muted">{selectedIds.length} selected</span>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="border border-gold-200 rounded-md px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Move to category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkAssignCategory}>Apply</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkSetFeatured(true)}>Feature</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkSetFeatured(false)}>Unfeature</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} className="text-red-600 hover:text-red-700" onClick={bulkDelete}>Delete</Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds([])}>Clear</Button>
            </div>
          )}
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gold-200 rounded-xl bg-cream">
          <Package className="h-10 w-10 mx-auto text-gold-400 mb-3" />
          <p className="text-ink-muted">No products match your filters.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageProducts.map((product) => (
          <div key={product.id} className={`group border rounded-xl p-4 bg-white shadow-card hover:shadow-luxe transition-all ${selectedIds.includes(product.id) ? 'border-gold-400 ring-1 ring-gold-300' : 'border-black/5'}`} data-testid={`product-item-${product.id}`}>
            <div className="relative mb-3 overflow-hidden rounded-lg bg-cream">
              <img
                src={resolveImageUrl(product.images[0])}
                alt={product.name}
                className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <label className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 backdrop-blur border border-gold-100 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#a9832f]"
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleSelect(product.id)}
                  aria-label={`Select ${product.name}`}
                />
              </label>
              <span className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-[11px] font-medium text-ink-soft border border-gold-100">
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