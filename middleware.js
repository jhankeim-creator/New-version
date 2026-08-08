/**
 * Serve crawler-friendly HTML for product/blog URLs.
 *
 * Fixes Google Search Console issues common to this CRA SPA:
 * - Soft 404: missing products used to return HTTP 200 + homepage shell
 * - Duplicate canonical: SPA index.html pointed every URL at kayee01.com/
 * - Page with redirect: UUID product URLs now 301 to the slug canonical
 * - Thin/empty JS shell: bots get real title/description/schema HTML
 */

const API_ORIGIN = "https://api.kayee01.com";

const BOT_UA =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex(bot|images)|facebookexternalhit|facebot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|amazonbot|discordbot|whatsapp|telegrambot|skypeuripreview|redditbot|rogerbot|screaming frog|chrome-lighthouse|lighthouse/i;

export const config = {
  matcher: ["/product/:path*", "/blog/:path*"],
};

function notFoundHtml(kind) {
  const label = kind === "blog" ? "Article" : "Product";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${label} not found | Kayee01</title>
<meta name="robots" content="noindex, follow"/>
<link rel="canonical" href="https://kayee01.com/shop"/>
</head>
<body>
<main>
  <h1>${label} not found</h1>
  <p>This page is no longer available.</p>
  <p><a href="https://kayee01.com/shop">Continue shopping</a></p>
</main>
</body>
</html>`;
}

export default async function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!BOT_UA.test(ua)) {
    return; // humans → normal SPA
  }

  const { pathname } = new URL(request.url);
  let target = null;
  let kind = "product";

  const productMatch = pathname.match(/^\/product\/([^/]+)\/?$/);
  if (productMatch) {
    target = `${API_ORIGIN}/seo/product/${encodeURIComponent(productMatch[1])}`;
    kind = "product";
  }

  const blogMatch = pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (blogMatch) {
    target = `${API_ORIGIN}/seo/blog/${encodeURIComponent(blogMatch[1])}`;
    kind = "blog";
  }

  if (!target) {
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: { Accept: "text/html", "User-Agent": ua },
      redirect: "manual",
    });

    // UUID → slug canonical (or other SEO redirects)
    if (upstream.status === 301 || upstream.status === 302 || upstream.status === 308) {
      const loc = upstream.headers.get("location");
      if (loc) {
        return Response.redirect(loc, upstream.status === 302 ? 302 : 301);
      }
    }

    if (upstream.status === 404) {
      const body = (await upstream.text().catch(() => "")) || notFoundHtml(kind);
      return new Response(body, {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=120",
          "x-robots-tag": "noindex, follow",
          "x-kayee-seo": "bot-404",
        },
      });
    }

    if (!upstream.ok) {
      // Propagate 5xx so GSC sees a real server error instead of a soft 404 shell
      if (upstream.status >= 500) {
        return new Response("Upstream SEO error", {
          status: upstream.status,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return;
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
