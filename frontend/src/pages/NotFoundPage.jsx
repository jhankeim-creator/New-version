import { Link } from 'react-router-dom';
import { useSeo } from '../lib/seo';
import { Button } from '../components/ui/button';

/** Client-side 404 for unknown routes (SPA still returns HTTP 200). */
export default function NotFoundPage() {
  useSeo({
    title: 'Page not found',
    description: 'This page does not exist on Kayee01.',
    path: '/404',
    noindex: true,
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="text-sm tracking-[0.2em] uppercase text-[#8a7355] mb-3">404</p>
      <h1 className="text-3xl font-semibold mb-3">Page not found</h1>
      <p className="text-[#5c534a] mb-8 max-w-md">
        The link may be broken or the page was removed.
      </p>
      <div className="flex gap-3">
        <Button asChild className="bg-[#d4af37] hover:bg-[#b8941f]">
          <Link to="/">Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/shop">Shop</Link>
        </Button>
      </div>
    </div>
  );
}
