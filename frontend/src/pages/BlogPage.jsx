import { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../App';
import { resolveImageUrl } from '../lib/utils';
import { useSeo } from '../lib/seo';
import Footer from '../components/Footer';
import { ArrowRight, CalendarDays } from 'lucide-react';
import axios from 'axios';

const BlogPage = () => {
  const { API } = useContext(CartContext);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: 'Journal',
    description: 'Weekly style notes and product highlights from the Kayee01 editorial team.',
    path: '/blog',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/blog?limit=24`);
        setPosts(res.data || []);
      } catch (e) {
        console.error('Failed to load blog:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [API]);

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center mb-12">
            <p className="eyebrow mb-3">The Journal</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
              Style Notes & Highlights
            </h1>
            <div className="gold-divider" />
            <p className="text-ink-muted mt-4 max-w-xl">
              A fresh editorial every week, spotlighting the pieces we love from the collection.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 text-ink-muted">
              The first article is on its way — check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id || post.slug}
                  to={`/blog/${post.slug}`}
                  className="group block overflow-hidden rounded-xl border border-black/5 shadow-card hover:shadow-luxe hover:-translate-y-1 transition-all duration-300 bg-white"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-cream">
                    <img
                      src={resolveImageUrl(post.cover_image)}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <p className="flex items-center gap-2 text-xs text-gold-600 mb-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {post.date_label || ''}
                    </p>
                    <h2 className="font-serif text-xl font-bold mb-2 line-clamp-2" style={{ fontFamily: 'Playfair Display' }}>
                      {post.title}
                    </h2>
                    <p className="text-sm text-ink-muted line-clamp-3 mb-4">{post.excerpt}</p>
                    <span className="inline-flex items-center text-sm font-medium text-ink group-hover:text-gold-600 transition-colors">
                      Read article <ArrowRight className="ml-1.5 h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BlogPage;
