"""Detect and block AI scrapers / aggressive bots from harvesting catalog data."""

from __future__ import annotations

import re
from typing import Optional

# Legitimate search/social preview crawlers (allowed limited SEO HTML).
SEO_CRAWLER_UA = re.compile(
    r"googlebot|bingbot|slurp|duckduckbot|"
    r"facebookexternalhit|facebot|twitterbot|linkedinbot|"
    r"pinterest|applebot|discordbot|whatsapp|telegrambot|"
    r"chrome-lighthouse|lighthouse",
    re.I,
)

# AI training / LLM / bulk scraping agents — blocked from catalog + SEO dumps.
AI_SCRAPER_UA = re.compile(
    r"gptbot|chatgpt-user|oai-searchbot|"
    r"claudebot|claude-web|anthropic-ai|"
    r"google-extended|gemini|bard|"
    r"ccbot|cohere-ai|perplexitybot|youbot|"
    r"bytespider|amazonbot|meta-externalagent|"
    r"applebot-extended|diffbot|omgili|omgilibot|"
    r"img2dataset|scrapy|python-requests|aiohttp|"
    r"curl/|wget/|go-http-client|java/|libwww-perl|"
    r"semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|"
    r"screaming frog|httrack|nikto|sqlmap|masscan|"
    r"headlesschrome|phantomjs|selenium|puppeteer|playwright",
    re.I,
)

# API paths that must never be bulk-harvested by automation.
PROTECTED_API_PREFIXES = (
    "/api/products",
    "/api/v2/products",
    "/api/v2/media",
    "/api/blog",
    "/api/categories",
    "/api/orders/quote",
    "/api/orders",
    "/seo/product/",
    "/seo/blog/",
    "/sitemap",
)

PUBLIC_ALLOW_PREFIXES = (
    "/api/health",
    "/api/settings/checkout-payments",
    "/api/settings/shipping-methods",
    "/api/settings/social-links",
    "/api/settings/announcement",
    "/api/coupons/validate",
    "/robots.txt",
)


def client_ip(request) -> str:
    fwd = (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-forwarded-for")
        or ""
    ).split(",")[0].strip()
    return fwd or (request.client.host if request.client else "unknown")


def user_agent(request) -> str:
    return request.headers.get("user-agent") or ""


def is_seo_crawler(ua: str) -> bool:
    return bool(SEO_CRAWLER_UA.search(ua or ""))


def is_ai_scraper(ua: str) -> bool:
    if not ua or len(ua.strip()) < 8:
        return True
    if is_seo_crawler(ua):
        return False
    return bool(AI_SCRAPER_UA.search(ua))


def is_protected_path(path: str) -> bool:
    if not path:
        return False
    if any(path.startswith(p) for p in PUBLIC_ALLOW_PREFIXES):
        return False
    return any(path.startswith(p) for p in PROTECTED_API_PREFIXES)


def should_block_request(request) -> bool:
    path = request.url.path or ""
    if request.method not in ("GET", "HEAD", "POST"):
        return False
    if not is_protected_path(path):
        return False
    return is_ai_scraper(user_agent(request))


def robots_txt_extra_blocks() -> str:
    """robots.txt rules that tell well-behaved AI crawlers to stay away."""
    agents = [
        "GPTBot",
        "ChatGPT-User",
        "OAI-SearchBot",
        "ClaudeBot",
        "Claude-Web",
        "anthropic-ai",
        "Google-Extended",
        "CCBot",
        "cohere-ai",
        "PerplexityBot",
        "Bytespider",
        "Amazonbot",
        "meta-externalagent",
        "Applebot-Extended",
        "Diffbot",
        "Omgilibot",
        "YouBot",
        "img2dataset",
        "FacebookBot",
    ]
    lines = []
    for agent in agents:
        lines.append(f"User-agent: {agent}")
        lines.append("Disallow: /")
        lines.append("")
    return "\n".join(lines)


def security_headers() -> dict[str, str]:
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "X-Robots-Tag": "noai, noimageai",
    }
