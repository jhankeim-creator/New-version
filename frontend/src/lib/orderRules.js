// Storefront display rules mirrored from backend/order_rules.py.

const JEWELRY_CAT_ROOTS = [
  'jewelry', 'necklace', 'bracelet', 'earrings', 'earring', 'ring', 'brooch', 'pendant',
];
const JEWELRY_SECTIONS = new Set([
  'all jewelry', 'jewelry', 'necklace', 'bracelet', 'earrings', 'earring', 'ring', 'brooch',
  'other jewelry', 'jewelry-other',
]);

export const WATCH_JEWELRY_SOLD_MIN = 5;
export const WATCH_JEWELRY_SOLD_MAX = 70;
export const BAGS_SOLD_MIN = 10;
export const BAGS_SOLD_MAX = 50;

function tagsBlob(product) {
  const tags = product?.tags;
  if (Array.isArray(tags)) return tags.join(' ').toLowerCase();
  return String(tags || '').toLowerCase();
}

function hashSeed(seed) {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function deterministicInt(seed, lo, hi) {
  const span = hi - lo + 1;
  return lo + (hashSeed(seed) % span);
}

export function isWatchProduct(product) {
  const cat = String(product?.category || '').trim().toLowerCase();
  const section = String(product?.section || product?.type_name || '').trim().toLowerCase();
  if (cat.startsWith('electronics') || section === 'electronics' || section === 'all electronics') {
    return false;
  }
  if (cat === 'smart-watch' || cat === 'smartwatch') return false;
  if (cat === 'watches' || cat === 'watch') return true;
  if (cat.startsWith('watches-') || cat.startsWith('watch-')) return true;
  if (section === 'watches' || section === 'watch' || section === 'all watches') return true;
  const blob = tagsBlob(product);
  return blob.includes('watch') && !blob.includes('smart');
}

export function isJewelryProduct(product) {
  const cat = String(product?.category || '').trim().toLowerCase();
  const section = String(product?.section || product?.type_name || '').trim().toLowerCase();
  for (const root of JEWELRY_CAT_ROOTS) {
    if (cat === root || cat.startsWith(`${root}-`)) return true;
  }
  if (JEWELRY_SECTIONS.has(section) || section.includes('jewelry')) return true;
  const blob = tagsBlob(product);
  return ['jewelry', 'necklace', 'bracelet', 'earring', 'brooch'].some((k) => blob.includes(k));
}

export function isBagProduct(product) {
  const cat = String(product?.category || '').trim().toLowerCase();
  const section = String(product?.section || product?.type_name || '').trim().toLowerCase();
  if (cat === 'bags' || cat === 'bag' || cat.startsWith('bags-') || cat.startsWith('bag-')) {
    return true;
  }
  if (section === 'bags' || section === 'bag' || section === 'all bags') return true;
  const blob = tagsBlob(product);
  return blob.includes('bag') || blob.includes('luggage');
}

export function getDisplaySalesCount(product) {
  if (typeof product?.display_sales_count === 'number') {
    return product.display_sales_count;
  }
  const seed = product?.id || product?.source_id || product?.name || 'x';
  if (isBagProduct(product)) {
    return deterministicInt(seed, BAGS_SOLD_MIN, BAGS_SOLD_MAX);
  }
  if (isWatchProduct(product) || isJewelryProduct(product)) {
    return deterministicInt(seed, WATCH_JEWELRY_SOLD_MIN, WATCH_JEWELRY_SOLD_MAX);
  }
  return 0;
}

export function soldCountLabel(product) {
  const count = getDisplaySalesCount(product);
  if (!count) return null;
  return `${count} sold`;
}

export function isPurchasable(product, displayPrice) {
  if (typeof product?.purchasable === 'boolean') return product.purchasable;
  const price = Number(displayPrice ?? product?.price ?? 0);
  const stock = Number(product?.stock ?? 0);
  return price > 0 && stock > 0;
}
