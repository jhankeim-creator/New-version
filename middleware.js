/**
 * Serve crawler-friendly HTML for product/blog URLs.
 *
 * The CRA storefront is a client-rendered SPA (#root is empty without JS).
 * Google often leaves those URLs in "Crawled – currently not indexed".
 * Bots hitting /product/* or /blog/* are rewritten to the API SEO HTML
 * endpoints which include real title, description, image and schema.
 * Humans still get the normal React app.
 */

const API_ORIGIN = "https://api.kayee01.com";

const BOT_UA =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex(bot|images)|facebookexternalhit|facebot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|amazonbot|discordbot|whatsapp|telegrambot|skypeuripreview|redditbot|rogerbot|screaming frog|chrome-lighthouse|lighthouse/i;

export const config = {
  matcher: ["/product/:path*", "/blog/:path*"],
};

export default async function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!BOT_UA.test(ua)) {
    return; // humans → normal SPA
  }

  const { pathname } = new URL(request.url);
  let target = null;

  const productMatch = pathname.match(/^\/product\/([^/]+)\/?$/);
  if (productMatch) {
    target = `${API_ORIGIN}/seo/product/${encodeURIComponent(productMatch[1])}`;
  }

  const blogMatch = pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (blogMatch) {
    target = `${API_ORIGIN}/seo/blog/${encodeURIComponent(blogMatch[1])}`;
  }

  if (!target) {
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: { Accept: "text/html", "User-Agent": ua },
    });
    if (!upstream.ok) {
      return; // fall back to SPA (e.g. 404 → React handles it)
    }
    const html = await upstream.text();
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=600",
        "x-robots-tag": "index, follow",
        "x-kayee-seo": "bot-prerender",
      },
    });
  } catch {
    return;
  }
}
