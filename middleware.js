/**
 * Serve crawler-friendly HTML for product/blog URLs, and resiliently proxy
 * sitemap/robots to the API (Render free tier cold-starts often cause GSC 5xx).
 *
 * Fixes Google Search Console issues common to this CRA SPA:
 * - Soft 404: missing products used to return HTTP 200 + homepage shell
 * - Duplicate canonical: SPA index.html pointed every URL at kayee01.com/
 * - Page with redirect: UUID product URLs now 301 to the slug canonical
 * - Thin/empty JS shell: bots get real title/description/schema HTML
 * - Server error (5xx): retry upstream before surfacing errors to Googlebot
 */

const API_ORIGIN = "https://api.kayee01.com";

const BOT_UA =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex(bot|images)|facebookexternalhit|facebot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|amazonbot|discordbot|whatsapp|telegrambot|skypeuripreview|redditbot|rogerbot|screaming frog|chrome-lighthouse|lighthouse/i;

export const config = {
  matcher: [
    "/product/:path*",
    "/blog/:path*",
    "/sitemap.xml",
    "/sitemap-:name.xml",
    "/robots.txt",
  ],
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch API origin with retries — Render free cold starts often return 502/503/504 once. */
async function fetchUpstream(target, init, attempts = 4) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const upstream = await fetch(target, init);
      if (upstream.status >= 500 && i < attempts - 1) {
        await sleep(350 * (i + 1));
        continue;
      }
      return upstream;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await sleep(350 * (i + 1));
        continue;
      }
    }
  }
  throw lastError || new Error("upstream fetch failed");
}

function serviceUnavailable(message) {
  return new Response(message, {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "retry-after": "60",
      "cache-control": "no-store",
      "x-kayee-seo": "bot-503",
    },
  });
}

async function proxyXmlOrText(request, target, contentType) {
  try {
    const upstream = await fetchUpstream(target, {
      headers: {
        Accept: contentType,
        "User-Agent": request.headers.get("user-agent") || "Kayee01-SEO-Proxy",
      },
      redirect: "manual",
    });
    if (upstream.status >= 500) {
      return serviceUnavailable("Sitemap temporarily unavailable");
    }
    if (!upstream.ok) {
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: {
          "content-type": contentType,
          "cache-control": "no-store",
        },
      });
    }
    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=900, s-maxage=900",
        "x-kayee-seo": "sitemap-proxy",
      },
    });
  } catch {
    return serviceUnavailable("Sitemap temporarily unavailable");
  }
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  // Always proxy sitemap/robots with retries (Vercel rewrite alone fails on cold API).
  if (pathname === "/sitemap.xml") {
    return proxyXmlOrText(request, `${API_ORIGIN}/sitemap.xml`, "application/xml; charset=utf-8");
  }
  const sitemapChunk = pathname.match(/^\/sitemap-([a-z0-9-]+)\.xml$/i);
  if (sitemapChunk) {
    return proxyXmlOrText(
      request,
      `${API_ORIGIN}/sitemap-${encodeURIComponent(sitemapChunk[1])}.xml`,
      "application/xml; charset=utf-8"
    );
  }
  if (pathname === "/robots.txt") {
    return proxyXmlOrText(request, `${API_ORIGIN}/robots.txt`, "text/plain; charset=utf-8");
  }

  const ua = request.headers.get("user-agent") || "";
  if (!BOT_UA.test(ua)) {
    return; // humans → normal SPA
  }

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
    const upstream = await fetchUpstream(target, {
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
      // After retries, tell Google to come back soon instead of a hard 502.
      if (upstream.status >= 500) {
        return serviceUnavailable("Upstream SEO temporarily unavailable");
      }
      return;
    }

    const html = await upstream.text();
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=600, s-maxage=600",
        "x-robots-tag": "index, follow",
        "x-kayee-seo": "bot-prerender",
      },
    });
  } catch {
    return serviceUnavailable("Upstream SEO temporarily unavailable");
  }
}
