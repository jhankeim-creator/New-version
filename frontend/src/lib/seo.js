import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SITE_NAME = 'Kayee01';
/** Always use the production host so preview / wrong origins never poison canonicals. */
export const SITE_ORIGIN = 'https://kayee01.com';
const DEFAULT_DESC =
  'Kayee01 — luxury-inspired fashion, designer watches and premium accessories.';

/** Paths Google should not index (account, cart, auth, admin). */
const NOINDEX_PREFIXES = [
  '/cart',
  '/checkout',
  '/account',
  '/login',
  '/wishlist',
  '/my-orders',
  '/admin',
  '/forgot-password',
  '/reset-password',
  '/order-success',
];

function setMeta(attr, key, content) {
  if (content === undefined || content === null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  if (!href) return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Strip query/hash and trailing slash (except root). */
export function normalizeCanonicalPath(path) {
  let p = String(path || '/').split('?')[0].split('#')[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

export function absoluteCanonical(path) {
  const p = normalizeCanonicalPath(path);
  return p === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${p}`;
}

export function isNoIndexPath(pathname) {
  const p = normalizeCanonicalPath(pathname);
  return NOINDEX_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`)
  );
}

// Site-wide default keywords used as a baseline for every page.
const DEFAULT_KEYWORDS = [
  'Kayee01', 'luxury jewelry', 'designer watches', 'necklace', 'ring',
  'bracelet', 'brooch', 'earrings', 'designer bags', 'fashion accessories',
  'online store',
];

/** Normalize a keywords input (array or string) into a clean comma list. */
function normalizeKeywords(keywords) {
  const list = Array.isArray(keywords)
    ? keywords
    : String(keywords || '').split(',');
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const k = String(raw || '').trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

/** Build a keyword list for a product from its fields, tags and taxonomy. */
export function productKeywords(product) {
  if (!product) return [];
  const words = [];
  if (product.name) words.push(product.name);
  if (product.brand) words.push(product.brand);
  if (product.section) words.push(product.section);
  if (product.category) words.push(String(product.category).replace(/-/g, ' '));
  if (Array.isArray(product.tags)) words.push(...product.tags);
  return words;
}

/**
 * Automatic per-page SEO: sets the document title, meta description, keywords,
 * Open Graph / Twitter tags and canonical URL (always on kayee01.com, no query).
 */
export function useSeo({
  title,
  description,
  image,
  path,
  keywords,
  noindex = false,
} = {}) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | ${SITE_NAME}`
      : `${SITE_NAME} — Luxury Fashion & Designer Accessories`;
    const desc = description || DEFAULT_DESC;
    const rawPath =
      path ||
      (typeof window !== 'undefined' ? window.location.pathname : '/');
    const url = absoluteCanonical(rawPath);

    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    const kw = normalizeKeywords([...normalizeKeywords(keywords), ...DEFAULT_KEYWORDS]);
    setMeta('name', 'keywords', kw.join(', '));

    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    if (image) setMeta('property', 'og:image', image);

    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    if (image) setMeta('name', 'twitter:image', image);

    setCanonical(url);
  }, [title, description, image, path, noindex]);
}

/**
 * Site-wide SEO hygiene for Google Search Console:
 * - strip trailing slashes (duplicate URL signal)
 * - noindex private/account/cart routes that otherwise look like the homepage shell
 *
 * Does not override titles on public pages (those use useSeo themselves).
 */
export function SeoRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || '/';

  useEffect(() => {
    if (pathname.length > 1 && pathname.endsWith('/')) {
      navigate(
        {
          pathname: pathname.replace(/\/+$/, ''),
          search: location.search,
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    if (!isNoIndexPath(pathname)) return undefined;

    document.title = `${SITE_NAME}`;
    setMeta('name', 'robots', 'noindex, nofollow');
    setMeta('name', 'description', 'Private page');
    setCanonical(absoluteCanonical(pathname));

    return () => {
      // Public pages re-set robots via useSeo on mount.
      setMeta('name', 'robots', 'index, follow');
    };
  }, [pathname]);

  return null;
}
