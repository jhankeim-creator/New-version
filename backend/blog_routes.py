"""
Blog module.

Generates weekly editorial articles about the products in the store WITHOUT
any external AI API key. The "writer" is a deterministic, template + phrase-bank
content generator seeded by the ISO week number, so each week produces a fresh,
varied article assembled from real product data (names, categories).

Articles are generated lazily: whenever the blog is fetched and the newest post
is older than 7 days (or there are no posts), a new one is created. An admin can
also trigger generation manually.
"""
import os
import re
import sys
import random
import uuid
import html
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.append(str(THIS_DIR))
from server import User, get_current_admin  # noqa: E402

blog_router = APIRouter(prefix="/api/blog", tags=["blog"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "kayee01_db")]
UPLOADS_DIR = THIS_DIR / "uploads"

GENERATION_INTERVAL_DAYS = 7


def slugify(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-") or "post"


# ---- Phrase banks (rotated by week for variety, no external AI needed) ----
_THEMES = [
    ("Notes from the Atelier", "featured"),
    ("Quiet Luxury, This Week", "featured"),
    ("Fresh Arrivals Worth a Second Look", "is_new"),
    ("Pieces with Presence", "best_seller"),
    ("A Considered Edit", "featured"),
    ("Style Notes from Kayee01", "featured"),
]

_INTROS = [
    "Every week we step back from the full collection and write about a few pieces that feel especially of-the-moment — less a sales roundup, more a short note on craft and silhouette.",
    "These pages are for lingering: a closer look at texture, proportion, and the details that make a piece worth keeping.",
    "Luxury, for us, lives in finish and restraint. Here are a handful of items that caught the editorial eye this week.",
    "From understated staples to quieter statement pieces, this week's edit favours design you can live with.",
]

_PRODUCT_LEADS = [
    "We keep returning to",
    "Worth sitting with is",
    "A quiet favourite is",
    "This week we noticed",
    "Holding our attention is",
    "Among the stronger silhouettes is",
]

_PRODUCT_NOTES = [
    "It balances presence and restraint — the kind of piece that elevates the everyday without shouting.",
    "The finish rewards a closer look; it is as much about how it feels as how it photographs.",
    "Versatile enough for daily wear, refined enough for the occasions that matter.",
    "Clean lines and thoughtful proportions make it easy to style across seasons.",
    "Understated, but unmistakably considered — the detail people notice second.",
]

_CLOSERS = [
    "If something here resonates, you will find it — and more — among the full collection.",
    "This is only a short edit; the shop holds the wider story.",
    "Take your time with the pieces that speak to you. Good design rarely needs a hard sell.",
    "Browse the collection when you are ready — we will keep writing about what is worth noticing.",
]


def _esc(text: str) -> str:
    return html.escape(str(text or ""), quote=True)


def _clean(text: str, limit: int = 220) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    # Drop factory / wholesale noise that reads like an ad.
    text = re.sub(
        r"(?i)\b(factory direct price|wholesale|oem|dropship|replica|mirror quality)\b[^.]*\.?",
        "",
        text,
    )
    text = re.sub(r"\s+", " ", text).strip(" ,.-")
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def _product_href(product: dict) -> str:
    ident = product.get("slug") or product.get("id") or ""
    return f"/product/{ident}" if ident else "/shop"


def _is_usable_image_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if not u or "does-not-exist" in u.lower():
        return False
    if u.startswith("http://") or u.startswith("https://"):
        return True
    if u.startswith("//"):
        return True
    return False


async def _local_upload_exists(path: str) -> bool:
    if not path.startswith("/uploads/"):
        return False
    name = os.path.basename(path)
    if (UPLOADS_DIR / name).is_file():
        return True
    doc = await db.media_files.find_one({"filename": name}, {"_id": 1})
    return bool(doc)


async def _cover_is_healthy(url: str) -> bool:
    if _is_usable_image_url(url):
        return True
    if url and url.startswith("/uploads/"):
        return await _local_upload_exists(url)
    return False


def _pick_cover_from_products(products: List[dict]) -> str:
    """Prefer durable absolute CDN images over fragile local /uploads paths."""
    for p in products:
        for img in p.get("images") or []:
            if _is_usable_image_url(img):
                return img.strip()
    return ""


def build_article(products: List[dict], categories: List[dict], stats: dict) -> dict:
    """Assemble an editorial weekly article — prose first, not a product advert."""
    now = datetime.now(timezone.utc)
    week_seed = int(now.strftime("%Y%W"))
    rng = random.Random(week_seed)

    title_base, _flag = _THEMES[week_seed % len(_THEMES)]
    date_label = now.strftime("%B %d, %Y")
    title = f"{title_base} — {date_label}"

    cat_names = {c.get("slug"): c.get("name") for c in categories}

    def catname(slug):
        return cat_names.get(slug) or (slug or "Accessories").replace("-", " ").title()

    picks = products[:5]
    cover_image = _pick_cover_from_products(picks)

    parts = []
    parts.append(f"<p class=\"blog-lede\">{_esc(rng.choice(_INTROS))}</p>")

    # Soft context — numbers without a hard sales pitch
    total = stats.get("total", 0)
    top_cats = stats.get("top_categories", [])
    if total:
        if top_cats:
            names = ", ".join(catname(s) for s, _n in top_cats[:3])
            parts.append(
                f"<p>Across the collection right now — some {total} pieces — "
                f"categories such as { _esc(names) } are especially active. "
                f"Below, a short reading of a few we would linger on.</p>"
            )
        else:
            parts.append(
                f"<p>The collection holds some {total} pieces at the moment. "
                f"Here is a brief note on a few that stood out this week.</p>"
            )

    for i, p in enumerate(picks):
        name = p.get("name") or "This piece"
        cat = catname(p.get("category", ""))
        desc = _clean(p.get("description", ""), 180)
        note = rng.choice(_PRODUCT_NOTES)
        lead = rng.choice(_PRODUCT_LEADS)
        href = _product_href(p)
        img = ""
        for candidate in p.get("images") or []:
            if _is_usable_image_url(candidate):
                img = candidate.strip()
                break

        parts.append('<section class="blog-piece">')
        if img:
            parts.append(
                f'<figure class="blog-figure">'
                f'<a href="{_esc(href)}">'
                f'<img src="{_esc(img)}" alt="{_esc(name)}" loading="lazy" />'
                f"</a>"
                f"<figcaption>{_esc(cat)}</figcaption>"
                f"</figure>"
            )
        parts.append(f"<h2>{_esc(name)}</h2>")
        body = f"{lead} <em>{_esc(name)}</em>."
        if desc and desc.lower() not in name.lower():
            body += f" { _esc(desc) }"
        body += f" { _esc(note) }"
        parts.append(f"<p>{body}</p>")
        parts.append(
            f'<p class="blog-inline-link"><a href="{_esc(href)}">View details</a></p>'
        )
        parts.append("</section>")
        if i < len(picks) - 1:
            parts.append('<hr class="blog-rule" />')

    parts.append(f"<p class=\"blog-closer\">{_esc(rng.choice(_CLOSERS))}</p>")
    content_html = "\n".join(parts)

    excerpt = _clean(re.sub(r"<[^>]+>", "", parts[0]), 160)
    slug = f"{slugify(title_base)}-{now.strftime('%Y-%m-%d')}"

    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "slug": slug,
        "excerpt": excerpt,
        "content": content_html,
        "cover_image": cover_image,
        "product_ids": [p.get("id") for p in picks if p.get("id")],
        "author": "Kayee01 Editorial",
        "tags": ["editorial", "weekly", "journal"],
        "published": True,
        "date_label": date_label,
        "created_at": now.isoformat(),
        "format_version": 2,
    }


async def _select_products() -> List[dict]:
    """Prefer featured / new / best-seller products with usable images."""
    query = {"$or": [{"featured": True}, {"is_new": True}, {"best_seller": True}]}
    products = await db.products.find(query, {"_id": 0}).limit(40).to_list(40)
    if len(products) < 4:
        products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).limit(24).to_list(24)
    # Prefer rows that have at least one absolute image URL
    with_imgs = [
        p for p in products
        if any(_is_usable_image_url(i) for i in (p.get("images") or []))
    ]
    pool = with_imgs or products
    random.Random(int(datetime.now(timezone.utc).strftime("%Y%W"))).shuffle(pool)
    return pool


async def generate_post() -> Optional[dict]:
    highlights = await _select_products()
    if not highlights:
        return None
    categories = await db.categories.find({}, {"_id": 0}).to_list(200)

    import collections
    all_products = await db.products.find(
        {}, {"_id": 0, "category": 1, "price": 1, "is_new": 1, "on_sale": 1}
    ).to_list(length=None)
    cat_counter = collections.Counter(
        p.get("category") for p in all_products if p.get("category")
    )
    prices = [
        p.get("price") for p in all_products
        if isinstance(p.get("price"), (int, float)) and 0 < p.get("price") < 10_000_000
    ]
    stats = {
        "total": len(all_products),
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
        "top_categories": cat_counter.most_common(6),
        "new_count": sum(1 for p in all_products if p.get("is_new")),
        "sale_count": sum(1 for p in all_products if p.get("on_sale")),
    }

    post = build_article(highlights, categories, stats)
    await db.blog_posts.insert_one(dict(post))
    return post


async def _repair_post_cover(post: dict) -> dict:
    """Fix broken / missing covers (common when /uploads files are gone)."""
    cover = post.get("cover_image") or ""
    if await _cover_is_healthy(cover):
        # Still prefer upgrading relative uploads to absolute CDN when possible
        if _is_usable_image_url(cover):
            return post

    ids = [i for i in (post.get("product_ids") or []) if i]
    products = []
    if ids:
        products = await db.products.find(
            {"id": {"$in": ids}}, {"_id": 0, "images": 1}
        ).to_list(20)
    new_cover = _pick_cover_from_products(products)
    if not new_cover:
        fallback = await db.products.find(
            {"featured": True}, {"_id": 0, "images": 1}
        ).limit(12).to_list(12)
        if not fallback:
            fallback = await db.products.find({}, {"_id": 0, "images": 1}).limit(12).to_list(12)
        new_cover = _pick_cover_from_products(fallback)

    if new_cover and new_cover != cover:
        post["cover_image"] = new_cover
        key = {"id": post["id"]} if post.get("id") else {"slug": post.get("slug")}
        await db.blog_posts.update_one(key, {"$set": {"cover_image": new_cover}})
    return post


async def _rewrite_legacy_post(post: dict) -> dict:
    """Upgrade ad-like v1 articles to editorial v2 HTML when product data exists."""
    if post.get("format_version", 1) >= 2:
        return post
    content = post.get("content") or ""
    looks_legacy = (
        "This week's highlights" in content
        or "· best seller" in content
        or "· on sale" in content
        or "Shop the Collection" in content
    )
    if not looks_legacy:
        post["format_version"] = 2
        return post

    ids = [i for i in (post.get("product_ids") or []) if i]
    products = []
    if ids:
        products = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(20)
    if len(products) < 2:
        products = await _select_products()
    if not products:
        return post

    categories = await db.categories.find({}, {"_id": 0}).to_list(200)
    stats = {"total": await db.products.count_documents({}), "top_categories": []}
    rebuilt = build_article(products, categories, stats)
    updates = {
        "content": rebuilt["content"],
        "excerpt": rebuilt["excerpt"],
        "cover_image": rebuilt["cover_image"] or post.get("cover_image") or "",
        "product_ids": rebuilt["product_ids"],
        "format_version": 2,
        "tags": ["editorial", "weekly", "journal"],
    }
    post.update(updates)
    key = {"id": post["id"]} if post.get("id") else {"slug": post.get("slug")}
    await db.blog_posts.update_one(key, {"$set": updates})
    return post


async def _prepare_post(post: dict, *, full: bool = False) -> dict:
    post = await _repair_post_cover(post)
    if full:
        post = await _rewrite_legacy_post(post)
    return post


async def _maybe_generate_weekly():
    """Create a new post if the latest is older than the interval (lazy cron)."""
    try:
        latest = await db.blog_posts.find({}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        needs = True
        if latest:
            try:
                last_dt = datetime.fromisoformat(latest[0]["created_at"])
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                needs = (datetime.now(timezone.utc) - last_dt) >= timedelta(days=GENERATION_INTERVAL_DAYS)
            except Exception:
                needs = False
        if needs:
            await generate_post()
    except Exception:
        pass


@blog_router.get("")
@blog_router.get("/")
async def list_posts(limit: int = 20):
    await _maybe_generate_weekly()
    limit = max(1, min(limit, 50))
    posts = await db.blog_posts.find({"published": True}, {"_id": 0, "content": 0}) \
        .sort("created_at", -1).limit(limit).to_list(limit)
    repaired = []
    for post in posts:
        repaired.append(await _prepare_post(post, full=False))
    return repaired


@blog_router.get("/{slug}")
async def get_post(slug: str):
    post = await db.blog_posts.find_one({"slug": slug}, {"_id": 0})
    if not post:
        post = await db.blog_posts.find_one({"id": slug}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return await _prepare_post(post, full=True)


@blog_router.post("/generate")
async def admin_generate(admin: User = Depends(get_current_admin)):
    post = await generate_post()
    if not post:
        raise HTTPException(status_code=400, detail="No products available to write about")
    return {"message": "Article generated", "slug": post["slug"], "title": post["title"]}


@blog_router.post("/repair")
async def admin_repair(admin: User = Depends(get_current_admin)):
    """Rewrite legacy ad-style posts and fix broken covers."""
    posts = await db.blog_posts.find({}, {"_id": 0}).to_list(200)
    fixed = 0
    for post in posts:
        before = (post.get("cover_image"), post.get("format_version"), post.get("content"))
        after = await _prepare_post(dict(post), full=True)
        if (
            after.get("cover_image") != before[0]
            or after.get("format_version") != before[1]
            or after.get("content") != before[2]
        ):
            fixed += 1
    return {"message": "Blog posts repaired", "updated": fixed, "scanned": len(posts)}


@blog_router.delete("/{post_id}")
async def admin_delete(post_id: str, admin: User = Depends(get_current_admin)):
    result = await db.blog_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        result = await db.blog_posts.delete_one({"slug": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Deleted"}
