import { Link } from 'react-router-dom';
import { resolveImageUrl, displayCategoryName } from '../lib/utils';

/** First usable image walking a category tree node. */
export function categoryTileImage(node) {
  if (!node) return '';
  const img = (node.image || '').trim();
  // Category-page stubs like ".../upfile/category/" are not real images.
  if (img && !/\/upfile\/category\/?$/i.test(img)) return img;
  for (const ch of node.children || []) {
    const child = categoryTileImage(ch);
    if (child) return child;
  }
  return '';
}

/**
 * Professional category tiles: solid dark label bar + forced white titles
 * (global h3 { color } would otherwise make names unreadable on photos).
 */
export default function CategoryTiles({ nodes = [], className = '' }) {
  if (!nodes.length) return null;

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 ${className}`}>
      {nodes.map((node) => {
        const name = displayCategoryName(node.name);
        const count = node.total ?? node.product_count ?? 0;
        const image = categoryTileImage(node);
        const initial = (name || '?').charAt(0).toUpperCase();
        return (
          <Link
            key={node.slug}
            to={`/shop/${node.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-xl bg-[#1a1714] shadow-card ring-1 ring-black/10 hover:ring-[#d4af37]/70 hover:shadow-luxe transition-all duration-300"
            data-testid={`category-tile-${node.slug}`}
          >
            <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#2a2520] to-[#14110f]">
              {/* Always-visible monogram so a missing/broken photo never looks empty */}
              <div
                className="absolute inset-0 flex items-center justify-center select-none"
                aria-hidden="true"
              >
                <span className="text-5xl font-bold text-white/15">{initial}</span>
              </div>
              {image ? (
                <img
                  src={resolveImageUrl(image)}
                  alt={name}
                  loading="lazy"
                  className="relative z-[1] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Keep the monogram fallback instead of a blank dark square.
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
            <div className="relative z-10 border-t border-white/10 bg-[#14110f] px-3 py-3 sm:px-4 sm:py-3.5">
              <h3 className="on-media-title text-base sm:text-lg font-bold leading-snug tracking-tight mb-0.5 line-clamp-2">
                {name}
              </h3>
              <p className="text-xs sm:text-sm text-white/75">
                {count} item{count === 1 ? '' : 's'}
                {node.children?.length ? ' · browse' : ''}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
