"""
Import products from the tangma2088.com wholesale photo-album catalog into the
Kayee01 MongoDB `products` collection, preserving the site's classification.

WHAT IT DOES
------------
The source site (https://m.tangma2088.com) is organised as:

    category (categoryen_<id>.html)   e.g. "T Shirt" -> "Amiri T Shirt"
      -> product  (producten_<id>_0.html)   one design, e.g. "Amiri S-XXL syt134"
          -> photo (productinfoen_<id>.html) individual gallery images

Each product carries a real listing date (``<div class="list-time">YYYY-MM-DD``),
a brand + size range + reference code in its title (e.g. "Amiri S-XXL syt134"),
and a category (from the breadcrumb). It does NOT carry a price.

This importer walks the category tree, keeps only products whose listing date is
on/after a cutoff (default 2025-12-01, i.e. "end of 2025 onward"), and upserts a
product document per design with:

  * name         -> cleaned title (brand + size + code, Chinese words translated)
  * category     -> slug of the parent category (a Category doc is upserted too)
  * images       -> full-size gallery image URLs (hot-linked, like the existing
                    qiqiyg images already used by this project)
  * description  -> brand / size / reference, so nothing is lost
  * price        -> 0  (set manually later in Admin; NEVER overwritten on re-runs)
  * source_site / source_id / source_url -> for idempotent re-imports

USAGE
-----
Dry run (no DB, just crawl + report) -- safe, needs only `requests`:

    python sync_tangma_products.py --categories 881 --limit 5 --dry-run

Real import (needs MONGO_URL + DB_NAME, run from the backend venv):

    export MONGO_URL="mongodb://127.0.0.1:27017" DB_NAME="kayee01_db"
    python sync_tangma_products.py --categories 11,10,394 --since 2025-12-01

Notes:
  * ``--categories`` are numeric category ids from the site (see the homepage).
    Common clothing roots: 11=T-Shirt, 10=Polo, 394=Jacket, 87630=Down,
    170=Fashion, 58658=Swimwear, 345535=Kids.
  * Prices are left at 0 on first insert and are never changed afterwards, so you
    can safely re-run to pick up new arrivals without losing your pricing.
"""

import argparse
import re
import sys
import time
import uuid
from datetime import datetime, timezone, date
from urllib.parse import quote, urljoin

import requests

BASE = "https://m.tangma2088.com/"
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")

# --- regexes over the very regular yg_shop template HTML ---
ANCHOR_RE = re.compile(r'<a\s+title="(?P<title>[^"]*)"\s+href="(?P<href>[^"]+)"\s*>(?P<body>.*?)</a>', re.S)
LISTTIME_RE = re.compile(r'class="list-time">\s*([0-9]{4}-[0-9]{2}-[0-9]{2})')
IMG_SRC_RE = re.compile(r'<img[^>]*\ssrc="([^"]+)"', re.S)
PRODUCT_IMG_RE = re.compile(r'src="([^"]*upfile/product/[^"]+)"')

CATEGORY_HREF_RE = re.compile(r'^category(?:en)?_(\d+)\.html')
PRODUCT_HREF_RE = re.compile(r'^producten?_(\d+)_0\.html')

# Chinese -> English clean-ups for names / categories.
ZH_MAP = {
    "短袖": "Short Sleeve", "短T": "T-Shirt", "短翻领": "Polo", "翻领": "Polo",
    "风衣": "Trench Coat", "外套夹克": "Jacket", "外套": "Coat", "夹克": "Jacket",
    "牛仔": "Denim", "棒球服": "Baseball Jacket", "羽绒": "Down Jacket",
    "泳装": "Swimwear", "春夏款童装": "Kids", "童装": "Kids", "时装": "Fashion",
    "款式": "Styles", "分类": "Category", "新款": "New", "不退换": "",
    "高版本": "High Edition", "瑜伽服": "Yoga", "恤": "Shirt", "短": "Short",
    "T恤": "T-Shirt",
}

# Trailing "MMDD" / "MM-DD天" style date tags the site appends to titles.
TRAILING_DATE_RE = re.compile(r'\s+\d{3,4}(?:[A-Za-z]+)?$')
TRAILING_RANGE_RE = re.compile(r'\s+\d+\s*[-~]\s*\d+\s*天$')

# Garment types used to build a clean "brand + type" category, so per-batch code
# noise in album titles (e.g. "Amiri T Shirt 12y") does not create junk
# categories. Order matters: the first match wins. Values are the normalised
# category label; several source phrases map to the same label.
TYPE_KEYWORDS = [
    ("baseball jacket", "Jacket"), ("down jacket", "Down Jacket"),
    ("trench coat", "Coat"), ("short sleeve", "T-Shirt"), ("t-shirt", "T-Shirt"),
    ("t shirt", "T-Shirt"), ("polo", "Polo"), ("hoodie", "Hoodie"),
    ("sweater", "Sweater"), ("sweatshirt", "Sweatshirt"), ("jacket", "Jacket"),
    ("coat", "Coat"), ("denim", "Denim"), ("swimwear", "Swimwear"),
    ("shorts", "Shorts"), ("pants", "Pants"), ("dress", "Dress"),
    ("skirt", "Skirt"), ("vest", "Vest"), ("yoga", "Yoga"), ("kids", "Kids"),
    ("shirt", "Shirt"),
]


def detect_type(text: str) -> str:
    low = clean_text(text).lower()
    for needle, label in TYPE_KEYWORDS:
        if needle in low:
            return label
    return ""


# Known top-level source category ids -> garment type, so the type is carried
# down the whole crawl even when individual album/product titles omit it.
SEED_TYPE = {
    "11": "T-Shirt", "10": "Polo", "394": "Jacket", "87630": "Down Jacket",
    "170": "Fashion", "58658": "Swimwear", "345535": "Kids",
}

_TYPE_WORDS = {w for needle, _ in TYPE_KEYWORDS for w in needle.replace("-", " ").split()}
_SIZE_TOKEN_RE = re.compile(r'^[A-Za-z0-9]{1,3}-[A-Za-z0-9]{1,4}$')


def fetch(url: str, delay: float, session: requests.Session, retries: int = 3) -> str:
    """GET a page and decode the gb2312 (mixed) markup, with light retries."""
    last_err = None
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=25)
            resp.raise_for_status()
            time.sleep(delay)
            return resp.content.decode("gb2312", errors="replace")
        except Exception as exc:  # noqa: BLE001 - network best-effort
            last_err = exc
            time.sleep(min(2 ** attempt, 8))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def clean_text(text: str) -> str:
    """Translate common Chinese tokens and collapse whitespace."""
    text = text.strip()
    for zh, en in ZH_MAP.items():
        text = text.replace(zh, f" {en} " if en else " ")
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def clean_title(title: str) -> str:
    title = TRAILING_RANGE_RE.sub('', title)
    title = TRAILING_DATE_RE.sub('', title)
    return clean_text(title)


def slugify(text: str) -> str:
    text = clean_text(text).lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return re.sub(r'-{2,}', '-', text).strip('-') or "misc"


def brand_of(title: str) -> str:
    """Best-effort brand = leading words before any size range / batch code,
    with garment-type words removed (e.g. "Amiri M-7XL 12yn01" -> "Amiri",
    "Satoshi Nakamoto M-2XL cztx" -> "Satoshi Nakamoto", "M-2XL cztx" -> "")."""
    out = []
    for tok in clean_title(title).split():
        if _SIZE_TOKEN_RE.match(tok) or re.search(r'\d', tok):
            break
        out.append(tok)
    out = [w for w in out if w.lower() not in _TYPE_WORDS]
    return " ".join(out).strip()


def size_of(title: str) -> str:
    m = re.search(r'\b([A-Z0-9]{1,3}-[A-Z0-9]{1,4})\b', title)
    return m.group(1) if m else ""


def parse_items(html: str):
    """Yield dicts for each anchor: kind, id, title, href, date, thumb."""
    for m in ANCHOR_RE.finditer(html):
        title = m.group("title")
        href = m.group("href").strip()
        body = m.group("body")
        if title == "Fashion Album" or not href:
            continue
        date_m = LISTTIME_RE.search(body)
        img_m = IMG_SRC_RE.search(body)
        cat_m = CATEGORY_HREF_RE.match(href)
        prod_m = PRODUCT_HREF_RE.match(href)
        if prod_m:
            kind, sid = "product", prod_m.group(1)
        elif cat_m:
            kind, sid = "category", cat_m.group(1)
        else:
            continue
        yield {
            "kind": kind,
            "id": sid,
            "title": title,
            "href": href,
            "date": date_m.group(1) if date_m else None,
            "thumb": img_m.group(1) if img_m else None,
        }


def gallery_images(html: str, cap: int) -> list:
    """Full-size product images from a producten_ detail page, URL-encoded."""
    urls, seen = [], set()
    for raw in PRODUCT_IMG_RE.findall(html):
        # encode spaces / special chars in the path while keeping the scheme+host
        enc = quote(raw, safe=":/?&=%")
        if enc not in seen:
            seen.add(enc)
            urls.append(enc)
        if cap and len(urls) >= cap:
            break
    return urls


def build_product(item, parent_title, images, root_type=""):
    title = clean_title(item["title"])
    brand = brand_of(item["title"])
    size = size_of(item["title"])

    # Classify as "Brand + Type" (e.g. "Amiri T-Shirt"). The garment type is
    # taken from the root category the crawl started at (most reliable), then
    # falls back to the product/parent titles. This keeps the site's
    # classification while dropping per-batch code noise from album titles.
    gtype = root_type or detect_type(item["title"]) or detect_type(parent_title or "")
    parts = [p for p in (brand, gtype) if p]
    if parts:
        category_name = " ".join(parts)
    elif parent_title:
        category_name = clean_title(parent_title)
    else:
        category_name = "Imported"
    category_slug = slugify(category_name)

    desc_bits = []
    if brand:
        desc_bits.append(f"Brand: {brand}.")
    if size:
        desc_bits.append(f"Sizes: {size}.")
    desc_bits.append(f"Reference: {title}.")
    description = " ".join(desc_bits)

    tags = [t for t in {brand.lower(), category_slug, "imported"} if t]

    return {
        "name": title or f"Product {item['id']}",
        "description": description,
        "category": category_slug,
        "category_name": category_name,
        "images": images,
        "size": size,
        "brand": brand,
        "tags": tags,
        "date": item["date"],
        "source_id": item["id"],
        "source_url": urljoin(BASE, item["href"]),
    }


def crawl(seed_category_ids, since_date, limit, max_images, delay, dry_run, session,
          type_override=""):
    """Depth-first crawl of the category tree, collecting product records."""
    collected = []
    visited_categories = set()
    skipped_old = 0
    stack = []
    for cid in reversed(seed_category_ids):
        root_type = type_override or SEED_TYPE.get(cid, "")
        stack.append((f"categoryen_{cid}.html", None, root_type))

    while stack:
        if limit and len(collected) >= limit:
            break
        href, parent_title, root_type = stack.pop()
        cat_id_m = CATEGORY_HREF_RE.match(href)
        cat_key = cat_id_m.group(1) if cat_id_m else href
        if cat_key in visited_categories:
            continue
        visited_categories.add(cat_key)

        url = urljoin(BASE, href)
        try:
            html = fetch(url, delay, session)
        except RuntimeError as exc:
            print(f"  ! skip {url}: {exc}", file=sys.stderr)
            continue

        for it in parse_items(html):
            if it["kind"] == "category":
                # push subcategory; its parent title is this page's category name
                stack.append((it["href"], it["title"], root_type))
            elif it["kind"] == "product":
                if since_date and it["date"]:
                    try:
                        d = datetime.strptime(it["date"], "%Y-%m-%d").date()
                    except ValueError:
                        d = None
                    if d and d < since_date:
                        skipped_old += 1
                        continue
                # Fetch the product detail page for the full gallery
                detail_url = urljoin(BASE, it["href"])
                try:
                    detail_html = fetch(detail_url, delay, session)
                    images = gallery_images(detail_html, max_images)
                except RuntimeError as exc:
                    print(f"  ! skip product {detail_url}: {exc}", file=sys.stderr)
                    images = []
                if not images and it.get("thumb"):
                    images = [quote(it["thumb"], safe=":/?&=%")]
                if not images:
                    continue
                record = build_product(it, parent_title, images, root_type)
                collected.append(record)
                if dry_run:
                    print(f"  [{len(collected):>4}] {record['date'] or '????-??-??'} "
                          f"| {record['category']:<22} | {len(images):>2} imgs | {record['name']}")
                if limit and len(collected) >= limit:
                    break
    return collected, skipped_old


async def upsert_products(records, stock, session_info):
    """Idempotently upsert products + their categories into MongoDB."""
    import os
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL and DB_NAME must be set for a real import "
                         "(export them, or run with --dry-run).")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    now = datetime.now(timezone.utc).isoformat()
    inserted = updated = 0
    categories_seen = {}

    for rec in records:
        # Ensure the category document exists (upsert by slug)
        slug = rec["category"]
        if slug not in categories_seen:
            categories_seen[slug] = rec
            await db.categories.update_one(
                {"slug": slug},
                {"$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "name": rec["category_name"],
                    "slug": slug,
                    "description": f"{rec['category_name']} imported from source catalog",
                    "image": rec["images"][0] if rec["images"] else "",
                    "created_at": now,
                }},
                upsert=True,
            )

        set_fields = {
            "name": rec["name"],
            "description": rec["description"],
            "category": slug,
            "images": rec["images"],
            "tags": rec["tags"],
            "is_new": True,
            "source_site": "tangma2088",
            "source_url": rec["source_url"],
            "updated_at": now,
        }
        # price/stock/slug are seeded once and never overwritten (so manual
        # pricing and any later edits survive re-imports). The slug is made
        # unique by appending the stable source id.
        set_on_insert = {
            "id": str(uuid.uuid4()),
            "slug": f"{slugify(rec['name'])}-{rec['source_id']}",
            "price": 0.0,
            "stock": stock,
            "featured": False,
            "on_sale": False,
            "created_at": now,
        }
        result = await db.products.update_one(
            {"source_site": "tangma2088", "source_id": rec["source_id"]},
            {"$set": set_fields, "$setOnInsert": set_on_insert},
            upsert=True,
        )
        if result.upserted_id is not None:
            inserted += 1
        else:
            updated += 1

    client.close()
    return inserted, updated, len(categories_seen)


def parse_args(argv):
    p = argparse.ArgumentParser(description="Import tangma2088 products into MongoDB.")
    p.add_argument("--categories", default="11",
                   help="Comma-separated source category ids to crawl (default: 11=T-Shirt).")
    p.add_argument("--since", default="2025-12-01",
                   help="Only import products listed on/after this date (YYYY-MM-DD).")
    p.add_argument("--limit", type=int, default=0,
                   help="Max products to import (0 = no limit).")
    p.add_argument("--max-images", type=int, default=8,
                   help="Max gallery images to keep per product (0 = all).")
    p.add_argument("--delay", type=float, default=0.4,
                   help="Delay in seconds between requests (be polite).")
    p.add_argument("--stock", type=int, default=10,
                   help="Initial stock for newly inserted products.")
    p.add_argument("--type", default="",
                   help="Force a garment type label for all seeds (e.g. 'Jacket'). "
                        "Overrides the built-in root-category type map.")
    p.add_argument("--dry-run", action="store_true",
                   help="Crawl and report only; do not touch MongoDB.")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    seed_ids = [c.strip() for c in args.categories.split(",") if c.strip()]
    since_date = None
    if args.since:
        try:
            since_date = datetime.strptime(args.since, "%Y-%m-%d").date()
        except ValueError:
            raise SystemExit(f"--since must be YYYY-MM-DD, got {args.since!r}")

    print("=" * 80)
    print("tangma2088 -> Kayee01 product import")
    print(f"  categories : {seed_ids}")
    print(f"  since      : {since_date} (products older than this are skipped)")
    print(f"  limit      : {args.limit or 'none'} | max images/product: {args.max_images or 'all'}")
    print(f"  mode       : {'DRY RUN (no DB writes)' if args.dry_run else 'IMPORT'}")
    print("=" * 80)

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Referer": BASE})

    records, skipped_old = crawl(
        seed_ids, since_date, args.limit, args.max_images, args.delay, args.dry_run, session,
        type_override=args.type,
    )

    print("-" * 80)
    print(f"Products collected : {len(records)}")
    print(f"Skipped (too old)  : {skipped_old}")

    if args.dry_run:
        cats = sorted({r["category"] for r in records})
        print(f"Distinct categories: {len(cats)} -> {', '.join(cats[:20])}"
              f"{' ...' if len(cats) > 20 else ''}")
        print("Dry run complete - no database changes were made.")
        return

    if not records:
        print("Nothing to import.")
        return

    import asyncio
    inserted, updated, ncats = asyncio.run(upsert_products(records, args.stock, session))
    print(f"Inserted new       : {inserted}")
    print(f"Updated existing   : {updated}")
    print(f"Categories ensured : {ncats}")
    print("Prices left at 0 for new products - set them in Admin.")
    print("Done.")


if __name__ == "__main__":
    main()
