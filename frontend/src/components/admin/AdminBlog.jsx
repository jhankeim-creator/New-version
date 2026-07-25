import { useState, useEffect, useContext } from 'react';
import { CartContext } from '../../App';
import { Button } from '../ui/button';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, Trash2, ExternalLink, RefreshCw } from 'lucide-react';

const AdminBlog = () => {
  const { API, token } = useContext(CartContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/blog?limit=50`);
      setPosts(res.data || []);
    } catch (e) {
      console.error('Failed to load blog posts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/blog/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Article generated: ${res.data.title}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate article');
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await axios.delete(`${API}/blog/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Article deleted');
      load();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Blog</h2>
          <p className="text-sm text-ink-muted mt-1">
            A new article is written automatically every week from your products (no API key needed). You can also generate one now.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={generate} disabled={generating} className="btn-gold text-white">
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? 'Writing…' : 'Generate article now'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-ink-muted">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gold-200 rounded-xl bg-cream text-ink-muted">
          No articles yet. Click “Generate article now” to create the first one.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id || post.slug} className="flex items-center justify-between gap-4 border border-black/5 rounded-xl p-4 bg-white">
              <div className="min-w-0">
                <h3 className="font-semibold line-clamp-1">{post.title}</h3>
                <p className="text-sm text-ink-muted line-clamp-1">{post.excerpt}</p>
                <p className="text-xs text-gold-600 mt-1">{post.date_label}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                </a>
                <Button onClick={() => remove(post.id || post.slug)} variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminBlog;
