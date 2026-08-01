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
    description: 'Editorial notes on craft, silhouette and quiet luxury from Kayee01.',
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
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="pt-32 pb-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <header className="mb-16 md:mb-20 max-w-2xl">
            <p className="text-xs tracking-[0.22em] uppercase text-[#8a7355] mb-4">Journal</p>
            <h1
              className="text-4xl md:text-5xl leading-tight text-[#1a1612] mb-5"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Notes on craft &amp; silhouette
            </h1>
            <p className="text-[#5c534a] text-lg leading-relaxed">
              Short editorial pieces — not promotions — about the designs we are looking at this week.
            </p>
          </header>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#8a7355]" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 text-[#5c534a]">
              The first article is on its way — check back soon.
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-[#ddd4c6]">
              {posts.map((post, idx) => (
                <article key={post.id || post.slug} className="py-10 md:py-12">
                  <Link
                    to={`/blog/${post.slug}`}
                    className={`group grid gap-8 md:gap-12 items-center ${
                      idx % 2 === 0 ? 'md:grid-cols-[1.15fr_1fr]' : 'md:grid-cols-[1fr_1.15fr]'
                    }`}
                  >
                    <div className={`${idx % 2 === 1 ? 'md:order-2' : ''}`}>
                      <div className="aspect-[16/10] overflow-hidden bg-[#ebe4d8]">
                        <img
                          src={resolveImageUrl(post.cover_image)}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    </div>
                    <div className={`${idx % 2 === 1 ? 'md:order-1' : ''}`}>
                      <p className="flex items-center gap-2 text-xs tracking-wide uppercase text-[#8a7355] mb-3">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {post.date_label || ''}
                        {post.author ? ` · ${post.author}` : ''}
                      </p>
                      <h2
                        className="text-2xl md:text-3xl text-[#1a1612] mb-4 leading-snug group-hover:text-[#6b5638] transition-colors"
                        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      >
                        {post.title}
                      </h2>
                      <p className="text-[#5c534a] leading-relaxed mb-6 line-clamp-3">
                        {post.excerpt}
                      </p>
                      <span className="inline-flex items-center text-sm tracking-wide text-[#1a1612] border-b border-[#1a1612]/pb-0.5 group-hover:border-[#8a7355] group-hover:text-[#8a7355] transition-colors">
                        Continue reading <ArrowRight className="ml-2 h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </article>
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
