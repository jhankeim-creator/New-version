import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");

// Resolve an image reference to an absolute URL.
// Backend-served uploads use relative paths like "/uploads/x.jpg"; since the
// frontend is hosted on a different origin (e.g. Vercel), these must be
// prefixed with the backend URL. Absolute URLs and data URIs pass through.
export function resolveImageUrl(path, fallback = "/placeholder.svg") {
  if (!path || typeof path !== "string") return fallback;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  if (path.startsWith("/uploads")) return `${BACKEND_URL}${path}`;
  return path;
}

// Top ("All X") parent categories and how leaf categories map to them. Used to
// group Section -> Brand in the storefront even if the backend API has not yet
// been redeployed to return the section/parent fields (falls back to inferring
// the parent from the category slug).
export const PARENT_NAMES = {
  clothing: "All Clothes",
  accessories: "All Accessories",
  bags: "All Bags",
  shoes: "All Shoes",
  jewelry: "All Jewelry",
  watches: "All Watches",
};

const TYPE_TO_PARENT = {
  "t-shirt": "clothing", polo: "clothing", jacket: "clothing",
  "down-jacket": "clothing", swimwear: "clothing", kids: "clothing",
  glasses: "accessories", belts: "accessories", hats: "accessories",
  perfume: "accessories", socks: "accessories", scarf: "accessories",
};

// Priority brands that should appear first within each category, in order.
export const PRIORITY_BRANDS = [
  "lv", "louis vuitton", "gucci", "balenciaga", "dior", "alexander mcqueen",
  "louboutin", "christian louboutin", "ugg", "rolex", "omega", "cartier",
  "chanel", "hermes", "prada", "versace", "bvlgari", "audemars piguet",
  "patek", "richard mille", "celine", "burberry", "fendi", "ysl",
  "saint laurent", "bottega", "amiri", "tiffany",
];

export function brandRank(name) {
  const n = (name || "").toLowerCase();
  const i = PRIORITY_BRANDS.findIndex((b) => n.includes(b));
  return i < 0 ? 999 : i;
}

// Preferred display order of the top ("All X") sections. The jewelry TYPE
// sections (necklace, ring, ...) are grouped right after the "jewelry" umbrella
// so they cluster together in the Categories menu.
export const PARENT_ORDER = [
  "clothing", "shoes", "bags",
  "jewelry", "necklace", "ring", "bracelet", "brooch", "earrings", "jewelry-other",
  "watches", "accessories",
];
export function parentRank(slug) {
  const i = PARENT_ORDER.indexOf(slug);
  return i < 0 ? 999 : i;
}

// Resolve a category's parent ({ slug, name }). Prefers backend-provided
// section fields; otherwise infers from the slug (e.g. "bags-lv" -> "bags",
// "t-shirt" -> "clothing").
export function categoryParent(cat) {
  if (!cat) return { slug: "", name: "" };
  if (cat.section_slug) {
    return { slug: cat.section_slug, name: cat.section || cat.section_slug };
  }
  const slug = cat.slug || "";
  if (TYPE_TO_PARENT[slug]) {
    const p = TYPE_TO_PARENT[slug];
    return { slug: p, name: PARENT_NAMES[p] };
  }
  const prefix = slug.split("-")[0];
  if (PARENT_NAMES[prefix]) return { slug: prefix, name: PARENT_NAMES[prefix] };
  return { slug, name: cat.name };
}

// Nicely display a mother-category name (drop the "All " prefix used by the
// importer, e.g. "All Bags" -> "Bags").
export function displayCategoryName(name) {
  return (name || "").replace(/^all\s+/i, "").trim() || name;
}

/**
 * Build a nested category tree from the flat list returned by
 * /categories/with-counts, using the backend `parent` field.
 *
 * - Each node gets `children` and a `total` = its own product_count plus the
 *   product_count of all descendants (so mother categories like "Jewelry",
 *   which hold no products directly, still count their sub-categories).
 * - Branches whose total is 0 are pruned so empty categories never show.
 * - Children are ordered by section priority, then brand priority, then count.
 *
 * This groups sub-categories UNDER their mother category (e.g. Jewelry ->
 * Necklace -> LV) instead of listing every category flat in one menu.
 */
export function buildCategoryTree(cats) {
  const list = Array.isArray(cats) ? cats : [];
  const bySlug = new Map();
  list.forEach((c) => {
    if (c && c.slug) bySlug.set(c.slug, { ...c, children: [], total: 0 });
  });

  const roots = [];
  bySlug.forEach((node) => {
    const parentSlug =
      node.parent && node.parent !== node.slug && bySlug.has(node.parent) ? node.parent : "";
    if (parentSlug) bySlug.get(parentSlug).children.push(node);
    else roots.push(node);
  });

  const sortNodes = (nodes) =>
    nodes.sort(
      (a, b) =>
        parentRank(a.slug) - parentRank(b.slug) ||
        brandRank(a.name) - brandRank(b.name) ||
        (b.total || 0) - (a.total || 0) ||
        String(a.name).localeCompare(String(b.name))
    );

  const computeTotal = (node) => {
    let t = node.product_count || 0;
    node.children.forEach((ch) => {
      t += computeTotal(ch);
    });
    node.total = t;
    sortNodes(node.children);
    return t;
  };
  roots.forEach(computeTotal);

  const prune = (nodes) =>
    nodes
      .filter((n) => (n.total || 0) > 0)
      .map((n) => ({ ...n, children: prune(n.children) }));

  const pruned = prune(roots);
  sortNodes(pruned);
  return pruned;
}
