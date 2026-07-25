"""
Blog module.

Generates weekly editorial articles about the products in the store WITHOUT
any external AI API key. The "writer" is a deterministic, template + phrase-bank
content generator seeded by the ISO week number, so each week produces a fresh,
varied article assembled from real product data (names, prices, categories).

Articles are generated lazily: whenever the blog is fetched and the newest post
is older than 7 days (or there are no posts), a new one is created. An admin can
also trigger generation manually. This is more reliable than a cron job on hosts
that spin idle instances down (e.g. Render free tier).
"""
import os
import re
import sys
import random
import uuid
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

GENERATION_INTERVAL_DAYS = 7


def slugify(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-") or "post"


# ---- Phrase banks (rotated by week for variety, no external AI needed) ----
_THEMES = [
    ("This Week's Featured Finds", "featured"),
    ("Editor's Picks: Pieces We're Loving", "featured"),
    ("Fresh Arrivals Worth a Second Look", "is_new"),
    ("The Best Sellers Everyone's Talking About", "best_seller"),
    ("Curated Elegance: A Weekly Edit", "featured"),
    ("Style Notes: Standout Pieces of the Week", "featured"),
]

_INTROS = [
    "Every week our team combs through the collection to surface the pieces that feel especially right for the moment. Here is what earned a place in this week's edit.",
    "There is something quietly satisfying about a well-chosen piece. This week we gathered a handful of favourites that pair timeless craft with everyday wearability.",
    "Luxury is in the details — the weight of a watch, the drape of a fabric, the finish of a clasp. These are the items catching our eye right now.",
    "From understated staples to statement-making accents, this week's selection celebrates considered design and lasting quality.",
]

_PRODUCT_LEADS = [
    "A standout this week is",
    "We keep coming back to",
    "Hard to overlook is",
    "Worth a closer look is",
    "Adding polish to any look is",
    "Turning heads this week is",
]

_PRODUCT_NOTES = [
    "It balances presence and restraint — the kind of piece that quietly elevates the everyday.",
    "The craftsmanship shows in the finish, making it a dependable choice for gifting or treating yourself.",
    "It is versatile enough for daily wear yet refined enough for the occasions that matter.",
    "Thoughtful proportions and a clean silhouette make it easy to style season after season.",
    "It is the sort of detail that people notice — understated, but unmistakably considered.",
]

_CLOSERS = [
    "Explore the full collection to discover more pieces chosen with the same care.",
    "These are just a few highlights — browse the shop to find the piece that speaks to you.",
    "Ready to make one of these yours? Visit the shop and see them in full detail.",
    "Discover more curated favourites and find your next signature piece in the shop.",
]


def _price(p: dict) -> str:
    try:
        return f"${float(p.get('price', 0)):.2f}"
    except Exception:
        return ""


def _category_label(slug: str, categories: List[dict]) -> str:
    for c in categories:
        if c.get("slug") == slug:
            return c.get("name") or slug
    return (slug or "Accessories").replace("-", " ").title()


def _clean(text: str, limit: int = 220) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def build_article(products: List[dict], categories: List[dict]) -> dict:
    """Assemble a weekly article dict from product data."""
    now = datetime.now(timezone.utc)
    week_seed = int(now.strftime("%Y%W"))
    rng = random.Random(week_seed)

    title_base, _flag = _THEMES[week_seed % len(_THEMES)]
    date_label = now.strftime("%B %d, %Y")
    title = f"{title_base} — {now.strftime('%B %d, %Y')}"

    picks = products[:6]
    intro = rng.choice(_INTROS)

    cover_image = ""
    for p in picks:
        imgs = p.get("images") or []
        if imgs:
            cover_image = imgs[0]
            break

    parts = [f"<p>{intro}</p>"]
    used_leads = list(_PRODUCT_LEADS)
    used_notes = list(_PRODUCT_NOTES)
    rng.shuffle(used_leads)
    rng.shuffle(used_notes)

    for idx, p in enumerate(picks):
        name = p.get("name") or "this piece"
        price = _price(p)
        cat = _category_label(p.get("category", ""), categories)
        desc = _clean(p.get("description", ""), 200)
        lead = used_leads[idx % len(used_leads)]
        note = used_notes[idx % len(used_notes)]
        price_txt = f" (from <strong>{price}</strong>)" if price else ""
        parts.append(f"<h2>{name}</h2>")
        para = f"<p>{lead} <strong>{name}</strong>{price_txt}, a highlight from our {cat} range. "
        if desc:
            para += f"{desc} "
        para += f"{note}</p>"
        parts.append(para)

    parts.append(f"<p>{rng.choice(_CLOSERS)}</p>")
    content_html = "\n".join(parts)

    excerpt = _clean(intro, 160)
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
        "tags": ["editorial", "weekly", "products"],
        "published": True,
        "date_label": date_label,
        "created_at": now.isoformat(),
    }


async def _select_products() -> List[dict]:
    """Prefer featured / new / best-seller products, fall back to recent."""
    query = {"$or": [{"featured": True}, {"is_new": True}, {"best_seller": True}]}
    products = await db.products.find(query, {"_id": 0}).limit(24).to_list(24)
    if len(products) < 4:
        products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).limit(12).to_list(12)
    random.Random(int(datetime.now(timezone.utc).strftime("%Y%W"))).shuffle(products)
    return products


async def generate_post() -> Optional[dict]:
    products = await _select_products()
    if not products:
        return None
    categories = await db.blog_categories_cache.find({}, {"_id": 0}).to_list(100)
    if not categories:
        categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    post = build_article(products, categories)
    await db.blog_posts.insert_one(dict(post))
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
        # Never let blog generation break the listing endpoint
        pass


@blog_router.get("")
@blog_router.get("/")
async def list_posts(limit: int = 20):
    await _maybe_generate_weekly()
    limit = max(1, min(limit, 50))
    posts = await db.blog_posts.find({"published": True}, {"_id": 0, "content": 0}) \
        .sort("created_at", -1).limit(limit).to_list(limit)
    return posts


@blog_router.get("/{slug}")
async def get_post(slug: str):
    post = await db.blog_posts.find_one({"slug": slug}, {"_id": 0})
    if not post:
        post = await db.blog_posts.find_one({"id": slug}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@blog_router.post("/generate")
async def admin_generate(admin: User = Depends(get_current_admin)):
    post = await generate_post()
    if not post:
        raise HTTPException(status_code=400, detail="No products available to write about")
    return {"message": "Article generated", "slug": post["slug"], "title": post["title"]}


@blog_router.delete("/{post_id}")
async def admin_delete(post_id: str, admin: User = Depends(get_current_admin)):
    result = await db.blog_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        result = await db.blog_posts.delete_one({"slug": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Deleted"}
