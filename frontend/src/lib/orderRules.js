// Purchase rules mirrored from backend/order_rules.py (MOQ + purchasability).

const JEWELRY_CAT_ROOTS = [
  'jewelry', 'necklace', 'bracelet', 'earrings', 'earring', 'ring', 'brooch', 'pendant',
];
const JEWELRY_SECTIONS = new Set([
  'all jewelry', 'jewelry', 'necklace', 'bracelet', 'earrings', 'earring', 'ring', 'brooch',
  'other jewelry', 'jewelry-other',
]);

export const WATCH_JEWELRY_MIN_ORDER_QTY = 5;
export const WATCH_JEWELRY_MAX_ORDER_QTY = 70;
export const BAGS_MIN_ORDER_QTY = 10;
export const BAGS_MAX_ORDER_QTY = 50;

function tagsBlob(product) {
  const tags = product?.tags;
  if (Array.isArray(tags)) return tags.join(' ').toLowerCase();
  return String(tags || '').toLowerCase();
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

export function getOrderQuantityLimits(product) {
  if (typeof product?.min_order_quantity === 'number') {
    const min = product.min_order_quantity;
    const max = product.max_order_quantity ?? null;
    return { min, max };
  }
  if (isBagProduct(product)) {
    return { min: BAGS_MIN_ORDER_QTY, max: BAGS_MAX_ORDER_QTY };
  }
  if (isWatchProduct(product) || isJewelryProduct(product)) {
    return { min: WATCH_JEWELRY_MIN_ORDER_QTY, max: WATCH_JEWELRY_MAX_ORDER_QTY };
  }
  return { min: 0, max: null };
}

export function isPurchasable(product, displayPrice) {
  if (typeof product?.purchasable === 'boolean') return product.purchasable;
  const price = Number(displayPrice ?? product?.price ?? 0);
  const stock = Number(product?.stock ?? 0);
  return price > 0 && stock > 0;
}

export function clampQuantity(product, quantity, displayPrice) {
  const { min, max } = getOrderQuantityLimits(product);
  const stock = Number(product?.stock ?? 0);
  let qty = Math.max(0, Number(quantity) || 0);
  if (min > 0) qty = Math.max(qty, min);
  if (max != null) qty = Math.min(qty, max);
  if (stock > 0) qty = Math.min(qty, stock);
  if (!isPurchasable(product, displayPrice)) return 0;
  return qty;
}

export function validateCartQuantity(product, quantity, displayPrice) {
  const { min, max } = getOrderQuantityLimits(product);
  const qty = Number(quantity) || 0;
  if (!isPurchasable(product, displayPrice)) {
    return 'This product is not available for purchase yet.';
  }
  if (qty < min) {
    return min > 0 ? `Minimum order is ${min} units.` : 'Invalid quantity.';
  }
  if (max != null && qty > max) {
    return `Maximum order is ${max} units.`;
  }
  const stock = Number(product?.stock ?? 0);
  if (stock > 0 && qty > stock) {
    return `Only ${stock} left in stock.`;
  }
  return null;
}

export function minOrderLabel(product) {
  const { min, max } = getOrderQuantityLimits(product);
  if (min <= 0) return null;
  if (max != null) return `Minimum order: ${min} · Maximum: ${max}`;
  return `Minimum order: ${min}`;
}
