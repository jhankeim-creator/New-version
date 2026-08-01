// Utilities for product variants (color, size, ...).
//
// Many imported products list their available options inside the free-text
// description (e.g. "Color: Red, Blue, Green" or "Sizes: S-2XL") instead of
// as structured data. These helpers extract those options so the storefront can
// render them as selectable choices before "Add to Cart".

import { expandSizeGroup, expandSizeToken } from './sizeRange';

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
 * Split a description into "Label: value" clauses.
 * Imports often store one flat string like:
 *   "Brand: Gucci. Category: Polo. Sizes: S-2XL. Reference: ..."
 * A naive regex that captures values to end-of-line would swallow every later
 * label into the first value — so we stop each value at the next period.
 */
function extractLabeledClauses(description) {
  const clauses = [];
  const re = /([A-Za-z][A-Za-z \-/]{0,24}?)\s*[:：]\s*([^.\n\r]+)\.?/g;
  let match;
  while ((match = re.exec(description)) !== null) {
    clauses.push({ name: match[1].trim(), valuesRaw: match[2].trim() });
  }
  return clauses;
}

/**
 * Extract variant groups from a free-text description.
 * Returns an array like: [{ name: "Color", values: ["Red", "Blue"] }, ...]
 */
export function parseVariantsFromDescription(description) {
  if (!description || typeof description !== 'string') return [];

  const groups = [];
  const seen = new Set();

  for (const { name: rawName, valuesRaw } of extractLabeledClauses(description)) {
    if (!rawName || !valuesRaw) continue;

    let values = valuesRaw
      .split(VALUE_SPLIT)
      .map((v) => v.trim())
      .filter(Boolean);

    // Expand wholesale size ranges ("S-2XL", "39-45") into real choices.
    if (/^sizes?$/i.test(rawName) && values.length === 1) {
      const expanded = expandSizeToken(values[0]);
      if (expanded.length >= 2) values = expanded;
    }

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

    groups.push(expandSizeGroup({ name, values: [...new Set(values)] }));
  }
  return groups;
}

/** Normalize a structured variants array coming from the product model. */
export function normalizeVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .filter((v) => v && v.name && Array.isArray(v.values) && v.values.length > 0)
    .map((v) => {
      let values = [...new Set(v.values.map((x) => String(x).trim()).filter(Boolean))];
      // Expand a lone size-range token stored in structured data too.
      if (/^sizes?$/i.test(String(v.name)) && values.length === 1) {
        const expanded = expandSizeToken(values[0]);
        if (expanded.length >= 2) values = expanded;
      }
      // Carry optional per-value price adjustments ({ value: delta }).
      const prices = {};
      if (v.prices && typeof v.prices === 'object') {
        for (const value of values) {
          const delta = Number(v.prices[value]);
          if (!Number.isNaN(delta) && delta !== 0) prices[value] = delta;
        }
      }
      return expandSizeGroup({ name: titleCase(String(v.name)), values, prices });
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
