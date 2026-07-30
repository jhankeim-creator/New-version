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

// Preferred display order of the top ("All X") sections.
export const PARENT_ORDER = ["clothing", "shoes", "bags", "jewelry", "watches", "accessories"];
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
