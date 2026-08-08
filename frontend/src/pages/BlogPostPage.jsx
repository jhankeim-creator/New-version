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
    description: post?.excerpt || (post ? undefined : 'This article is no longer available.'),
    image: post?.cover_image ? resolveImageUrl(post.cover_image) : undefined,
    path: post ? `/blog/${slug}` : '/blog',
    noindex: !loading && !post,
  });

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="pt-28 pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link
            to="/blog"
            className="inline-flex items-center text-sm text-[#5c534a] hover:text-[#1a1612] mb-10"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All journal notes
          </Link>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#8a7355]" />
            </div>
          ) : !post ? (
            <div className="text-center py-20 text-[#5c534a]">Article not found.</div>
          ) : (
            <article>
              <p className="text-xs tracking-[0.22em] uppercase text-[#8a7355] mb-4">Editorial</p>
              <h1
                className="text-3xl md:text-5xl text-[#1a1612] mb-5 leading-[1.15]"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {post.title}
              </h1>
              <p className="flex items-center gap-2 text-sm text-[#8a7355] mb-10">
                <CalendarDays className="h-4 w-4" />
                {post.date_label || ''} · {post.author || 'Kayee01 Editorial'}
              </p>

              {post.cover_image && (
                <figure className="mb-12 -mx-4 md:mx-0">
                  <img
                    src={resolveImageUrl(post.cover_image)}
                    alt={post.title}
                    className="w-full max-h-[520px] object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </figure>
              )}

              <div
                className="blog-content"
                dangerouslySetInnerHTML={{ __html: post.content || '' }}
              />

              <footer className="mt-16 pt-8 border-t border-[#ddd4c6]">
                <p className="text-[#5c534a] text-sm mb-4">
                  Looking for something specific? Explore the full collection at your own pace.
                </p>
                <Link
                  to="/shop"
                  className="inline-flex text-sm tracking-wide text-[#1a1612] border-b border-[#1a1612] pb-0.5 hover:text-[#8a7355] hover:border-[#8a7355] transition-colors"
                >
                  Browse the shop
                </Link>
              </footer>
            </article>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BlogPostPage;
