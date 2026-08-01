// Utilities for product variants (color, size, ...).
//
// Many imported products list their available options inside the free-text
// description (e.g. "Color: Red, Blue, Green" or "Sizes: S / M / L") instead of
// as structured data. These helpers extract those options so the storefront can
// render them as selectable choices before "Add to Cart".

// Labels we confidently treat as a variant axis even when the values are terse.
const KNOWN_LABELS = /^(colou?rs?|sizes?|materials?|styles?|options?|variants?|models?)$/i;

// Value separators seen in the wild, including CJK punctuation used by the
// wholesale sources this store imports from.
const VALUE_SPLIT = /\s*[,/|、，；;]\s*/;

function titleCase(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract variant groups from a free-text description.
 * Returns an array like: [{ name: "Color", values: ["Red", "Blue"] }, ...]
 */
export function parseVariantsFromDescription(description) {
  if (!description || typeof description !== 'string') return [];

  const groups = [];
  const seen = new Set();
  // Match "Label: value1, value2, ..." on its own line or clause.
  const lineRe = /([A-Za-z][A-Za-z \-/]{0,24}?)\s*[:：]\s*([^\n\r]+)/g;

  const lines = description.split(/\r?\n/);
  for (const line of lines) {
    lineRe.lastIndex = 0;
    let match;
    while ((match = lineRe.exec(line)) !== null) {
      const rawName = match[1].trim();
      const rawValues = match[2].trim();
      if (!rawName || !rawValues) continue;

      const values = rawValues
        .split(VALUE_SPLIT)
        .map((v) => v.trim())
        .filter(Boolean);

      // Need at least two distinct, terse values to be a real choice.
      if (values.length < 2) continue;
      if (values.some((v) => v.length > 24 || v.split(/\s+/).length > 4)) continue;

      const key = rawName.toLowerCase();
      const isKnown = KNOWN_LABELS.test(key);
      // For unknown labels, only accept short single/double-word labels to
      // avoid turning ordinary sentences ("Note: ...") into variants.
      if (!isKnown && rawName.split(/\s+/).length > 2) continue;

      const name = titleCase(rawName);
      const dedupKey = name.toLowerCase();
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      groups.push({ name, values: [...new Set(values)] });
    }
  }
  return groups;
}

/** Normalize a structured variants array coming from the product model. */
export function normalizeVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .filter((v) => v && v.name && Array.isArray(v.values) && v.values.length > 0)
    .map((v) => {
      const values = [...new Set(v.values.map((x) => String(x).trim()).filter(Boolean))];
      // Carry optional per-value price adjustments ({ value: delta }).
      const prices = {};
      if (v.prices && typeof v.prices === 'object') {
        for (const value of values) {
          const delta = Number(v.prices[value]);
          if (!Number.isNaN(delta) && delta !== 0) prices[value] = delta;
        }
      }
      return { name: titleCase(String(v.name)), values, prices };
    })
    .filter((v) => v.values.length > 0);
}

/**
 * Combine structured product variants with those parsed from the description,
 * preferring the structured definition when both define the same axis.
 */
export function getProductVariantGroups(product) {
  if (!product) return [];
  const structured = normalizeVariants(product.variants);
  const parsed = parseVariantsFromDescription(product.description);
  const byName = new Map();
  for (const g of structured) byName.set(g.name.toLowerCase(), g);
  for (const g of parsed) {
    if (!byName.has(g.name.toLowerCase())) byName.set(g.name.toLowerCase(), g);
  }
  return Array.from(byName.values());
}

/**
 * Total price adjustment for the currently-selected variant values, summing the
 * optional per-value deltas defined on the variant groups. Returns 0 when none.
 */
export function variantPriceDelta(groups, selected) {
  if (!Array.isArray(groups) || !selected) return 0;
  let delta = 0;
  for (const g of groups) {
    const value = selected[g.name];
    if (value && g.prices && typeof g.prices[value] === 'number') {
      delta += g.prices[value];
    }
  }
  return delta;
}

/** Build a short human-readable label, e.g. "Color: Red, Size: M". */
export function formatSelectedVariants(selected) {
  if (!selected) return '';
  return Object.entries(selected)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

/** Stable cart key so the same product with different options is a separate line. */
export function buildCartKey(productId, selected) {
  if (!selected || Object.keys(selected).length === 0) return productId;
  const parts = Object.keys(selected)
    .sort()
    .map((k) => `${k}=${selected[k]}`);
  return `${productId}::${parts.join('|')}`;
}
