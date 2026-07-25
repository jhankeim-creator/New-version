import { useState, useEffect, useContext, useCallback } from 'react';
import { resolveImageUrl } from '../../lib/utils';
import { CartContext } from '../../App';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Video } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import ProductVariants from '../ProductVariants';

const AdminProductAdd = () => {
  const { API, token } = useContext(CartContext);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    category: '',
    stock: '',
    sku: '',
    meta_title: '',
    meta_description: '',
    tags: '',
    featured: false,
    on_sale: false,
    is_new: false,
    best_seller: false,
    has_variants: false,
    variants: [],
    variant_options: [],
    auto_topup: false
  });
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      // Use the same category system as the storefront and product editor
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const onDropImages = useCallback(async (acceptedFiles) => {
    setUploadingImages(true);
    
    for (const file of acceptedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post(`${API}/v2/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (response.data.type === 'image') {
          setImages(prev => [...prev, response.data.url]);
        } else {
          setVideos(prev => [...prev, response.data.url]);
        }
        
        toast.success(`${file.name} uploaded!`);
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setUploadingImages(false);
  }, [API]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropImages,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov']
    },
    multiple: true
  });

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        category: formData.category,
        stock: parseInt(formData.stock) || 0,
        sku: formData.sku || null,
        images: images,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        featured: formData.featured,
        on_sale: formData.on_sale,
        is_new: formData.is_new,
        best_seller: formData.best_seller,
        has_variants: formData.has_variants,
        variants: formData.variants,
        variant_options: formData.variant_options,
        tags: (() => {
          const baseTags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
          if (formData.auto_topup && !baseTags.includes('topup')) baseTags.push('topup');
          return baseTags;
        })()
      };

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      await axios.post(`${API}/products`, productData, { headers });
      
      toast.success('Product created successfully!');
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        price: '',
        compare_at_price: '',
        category: '',
        stock: '',
        sku: '',
        meta_title: '',
        meta_description: '',
        tags: '',
        featured: false,
        on_sale: false,
        is_new: false,
        best_seller: false,
        has_variants: false,
        variants: [],
        variant_options: [],
        auto_topup: false
      });
      setImages([]);
      setVideos([]);
      
    } catch (error) {
      console.error('Failed to create product:', error);
      toast.error(error.response?.data?.detail || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
          Add New Product
        </h2>
        <p className="text-gray-600">Create a new product with images, videos and SEO</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="E.g. Rolex Submariner..."
                required
              />
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed product description..."
                rows={6}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="299.99"
                  required
                />
              </div>

              <div>
                <Label>Compare at Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.compare_at_price}
                  onChange={(e) => setFormData({ ...formData, compare_at_price: e.target.value })}
                  placeholder="399.99 (if on sale)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stock Quantity *</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="50"
                  required
                />
              </div>

              <div>
                <Label>SKU</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="PROD-001"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Variants */}
        <ProductVariants formData={formData} setFormData={setFormData} />

        {/* Images & Videos */}
        <Card>
          <CardHeader>
            <CardTitle>Media (Images & Videos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-[#d4af37] bg-yellow-50' : 'border-gray-300 hover:border-[#d4af37]'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              {uploadingImages ? (
                <p className="text-gray-600">Uploading...</p>
              ) : isDragActive ? (
                <p className="text-[#d4af37] font-semibold">Drop files here...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2 font-semibold">Drag & drop images/videos here</p>
                  <p className="text-sm text-gray-500 mb-3">or</p>
                  <Button type="button" variant="outline" className="mb-2">
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files from Computer
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">Supports: JPG, PNG, GIF, WebP, MP4, MOV</p>
                  <p className="text-xs text-gray-400">Max file size: 10MB per file</p>
                </div>
              )}
            </div>

            {/* Add Image by URL */}
            <div className="border-t pt-4">
              <Label>Or Add Image by URL</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (imageUrl.trim()) {
                      setImages(prev => [...prev, imageUrl.trim()]);
                      setImageUrl('');
                      toast.success('Image URL added!');
                    }
                  }}
                  disabled={!imageUrl.trim()}
                >
                  Add URL
                </Button>
              </div>
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
              <div>
                <Label className="mb-2 block">Images ({images.length})</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((url, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={resolveImageUrl(url)}
                          alt={`Product ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Previews */}
            {videos.length > 0 && (
              <div>
                <Label className="mb-2 block">Videos ({videos.length})</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {videos.map((url, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-video overflow-hidden rounded-lg bg-gray-100">
                        <video
                          src={resolveImageUrl(url)}
                          className="w-full h-full object-cover"
                          controls
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Category *</Label>
              <select
                className="w-full border rounded p-2"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* SEO */}
        <Card>
          <CardHeader>
            <CardTitle>SEO & Meta Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Meta Title</Label>
              <Input
                value={formData.meta_title}
                onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                placeholder="SEO optimized title"
              />
            </div>

            <div>
              <Label>Meta Description</Label>
              <Textarea
                value={formData.meta_description}
                onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                placeholder="SEO optimized description (160 characters)"
                rows={3}
              />
            </div>

            <div>
              <Label>Tags (comma separated)</Label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="rolex, luxury, watch, submariner"
              />
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Product Badges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Featured Product</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.on_sale}
                  onChange={(e) => setFormData({ ...formData, on_sale: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>On Sale</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_new}
                  onChange={(e) => setFormData({ ...formData, is_new: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>New Arrival</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.best_seller}
                  onChange={(e) => setFormData({ ...formData, best_seller: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Best Seller</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.auto_topup}
                  onChange={(e) => setFormData({ ...formData, auto_topup: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Auto Topup Product</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || images.length === 0 || !token}
            className="bg-[#d4af37] hover:bg-[#b8941f]"
          >
            {loading ? 'Creating...' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminProductAdd;