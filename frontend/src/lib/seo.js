import { useEffect } from 'react';

const SITE_NAME = 'Kayee01';
const DEFAULT_DESC =
  'Kayee01 — luxury-inspired fashion, designer watches and premium accessories.';

function setMeta(attr, key, content) {
  if (!content) return;
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
 * Open Graph / Twitter tags and canonical URL.
 */
export function useSeo({ title, description, image, path, keywords } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Luxury Fashion & Designer Accessories`;
    const desc = description || DEFAULT_DESC;
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}${path || window.location.pathname}`
      : '';

    document.title = fullTitle;
    setMeta('name', 'description', desc);
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
  }, [title, description, image, path]);
}
