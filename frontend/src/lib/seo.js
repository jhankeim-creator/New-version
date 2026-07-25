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

/**
 * Automatic per-page SEO: sets the document title, meta description,
 * Open Graph / Twitter tags and canonical URL.
 */
export function useSeo({ title, description, image, path } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Luxury Fashion & Designer Accessories`;
    const desc = description || DEFAULT_DESC;
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}${path || window.location.pathname}`
      : '';

    document.title = fullTitle;
    setMeta('name', 'description', desc);

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
