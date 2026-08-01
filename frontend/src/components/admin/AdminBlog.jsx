import { useState, useEffect, useContext } from 'react';
import { CartContext } from '../../App';
import { Button } from '../ui/button';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, Trash2, ExternalLink, RefreshCw, BookOpen } from 'lucide-react';

const AdminBlog = () => {
  const { API, token } = useContext(CartContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const auth = { Authorization: `Bearer ${token}` };

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
      const res = await axios.post(`${API}/blog/generate`, {}, { headers: auth });
      toast.success(`Story: ${res.data.title}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate article');
    } finally {
      setGenerating(false);
    }
  };

  const seedBrands = async () => {
    setSeeding(true);
    try {
      const res = await axios.post(`${API}/blog/generate-brands?max_posts=10`, {}, { headers: auth });
      toast.success(res.data?.message || `Generated ${res.data?.count || 0} brand stories`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to seed brand stories');
    } finally {
      setSeeding(false);
    }
  };

  const repair = async () => {
    setRepairing(true);
    try {
      const res = await axios.post(`${API}/blog/repair`, {}, { headers: auth });
      toast.success(
        `Updated ${res.data?.updated || 0}; removed ${res.data?.duplicates_removed || 0} duplicates`
      );
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to repair articles');
    } finally {
      setRepairing(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await axios.delete(`${API}/blog/${id}`, { headers: auth });
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
          <p className="text-sm text-ink-muted mt-1 max-w-xl">
            Brand history articles (Chanel, Rolex, LV…). Each generate creates a <strong>new unique story</strong> for the next brand — not the same weekly promo twice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={repair} disabled={repairing} variant="outline">
            {repairing ? 'Repairing…' : 'Repair & dedupe'}
          </Button>
          <Button onClick={seedBrands} disabled={seeding} variant="outline">
            <BookOpen className="mr-2 h-4 w-4" />
            {seeding ? 'Writing houses…' : 'Seed 10 brand stories'}
          </Button>
          <Button onClick={generate} disabled={generating} className="btn-gold text-white">
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? 'Writing…' : 'Next brand story'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-ink-muted">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gold-200 rounded-xl bg-cream text-ink-muted">
          No articles yet. Click “Seed 10 brand stories” to fill the journal with house histories.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id || post.slug} className="flex items-center justify-between gap-4 border border-black/5 rounded-xl p-4 bg-white">
              <div className="min-w-0">
                <h3 className="font-semibold line-clamp-1">{post.title}</h3>
                <p className="text-sm text-ink-muted line-clamp-1">{post.excerpt}</p>
                <p className="text-xs text-gold-600 mt-1">
                  {post.date_label}
                  {post.brand_name ? ` · ${post.brand_name}` : ''}
                </p>
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
