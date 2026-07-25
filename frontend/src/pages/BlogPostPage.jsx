import { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CartContext } from '../App';
import { resolveImageUrl } from '../lib/utils';
import { useSeo } from '../lib/seo';
import Footer from '../components/Footer';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import axios from 'axios';

const BlogPostPage = () => {
  const { slug } = useParams();
  const { API } = useContext(CartContext);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/blog/${slug}`);
        setPost(res.data);
      } catch (e) {
        console.error('Failed to load post:', e);
        setPost(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [API, slug]);

  useSeo({
    title: post?.title,
    description: post?.excerpt,
    image: post?.cover_image ? resolveImageUrl(post.cover_image) : undefined,
    path: `/blog/${slug}`,
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link to="/blog" className="inline-flex items-center text-sm text-ink-muted hover:text-gold-600 mb-8">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Journal
          </Link>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
            </div>
          ) : !post ? (
            <div className="text-center py-20 text-ink-muted">Article not found.</div>
          ) : (
            <article>
              <p className="eyebrow mb-3">Editorial</p>
              <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight" style={{ fontFamily: 'Playfair Display' }}>
                {post.title}
              </h1>
              <p className="flex items-center gap-2 text-sm text-gold-600 mb-8">
                <CalendarDays className="h-4 w-4" />
                {post.date_label || ''} · {post.author || 'Kayee01 Editorial'}
              </p>
              {post.cover_image && (
                <div className="rounded-xl overflow-hidden mb-10 shadow-card">
                  <img src={resolveImageUrl(post.cover_image)} alt={post.title} className="w-full object-cover" />
                </div>
              )}
              <div
                className="blog-content"
                dangerouslySetInnerHTML={{ __html: post.content || '' }}
              />
              <div className="mt-12 pt-8 border-t border-gold-100 text-center">
                <Link
                  to="/shop"
                  className="btn-gold inline-flex items-center rounded-full px-8 py-3 text-white font-medium"
                >
                  Shop the Collection
                </Link>
              </div>
            </article>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BlogPostPage;
