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
