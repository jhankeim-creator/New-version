"""
Import products from the tangma2088.com wholesale photo-album network into the
Kayee01 MongoDB, preserving the site's SECTION -> BRAND -> product structure.

SOURCE NETWORK (all share the same "yg_shop" template)
------------------------------------------------------
  * m.tangma2088.com     -> clothing, organised by TYPE (T-Shirt, Polo, ...)
  * mbags.tangma2088.com -> bags, top categories are BRANDS
  * mshoes.tangma2088.com-> shoes, top categories are BRANDS
  * macc.tangma2088.com  -> accessories: Jewelry, Glasses, Belts, Watches,
                            Hats, Perfume, Socks, Scarf

Every product page carries a real listing date (``<div class="list-time">``),
a brand + size range + code in its title, and belongs to a section. It has NO
price.

TAXONOMY WE PRODUCT
-------------------
Each imported product is classified as SECTION -> BRAND, mirroring the source:

  * ``section``      -> e.g. "Bags", "Shoes", "Jewelry", "T-Shirt"
  * ``brand``        -> e.g. "LV", "Gucci", "Amiri"
  * ``category``     -> slug "<section>-<brand>" (e.g. "bags-lv"); when no brand
                        can be determined it falls back to the section slug.

A Category document is upserted per ``category`` slug carrying its ``section`` /
``section_slug`` so the storefront can group brands under their section.
The generic "Fashion" clothing bucket is intentionally skipped.

USAGE
-----
Dry run (no DB, just crawl + report):

    python sync_tangma_products.py --domains bags --per-root-limit 5 --dry-run

Full replacement (delete existing catalog first, prices start at 0):

    export MONGO_URL="..." DB_NAME="kayee01_db"
    python sync_tangma_products.py --domains clothing,bags,shoes,acc \
        --since 2025-12-01 --per-root-limit 25 --replace

Prices are seeded to 0 once and never overwritten, so manual pricing survives
re-runs (idempotent by source_id).
"""

import argparse
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import quote, urljoin

import requests

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")

# --- source domains + how each is organised ---
CLOTHING_BASE = "https://m.tangma2088.com/"
ACC_BASE = "https://macc.tangma2088.com/"
BAGS_BASE = "https://mbags.tangma2088.com/"
SHOES_BASE = "https://mshoes.tangma2088.com/"

# clothing: explicit type sections (Fashion / cat 170 deliberately excluded)
CLOTHING_SEEDS = [
    ("11", "T-Shirt"), ("10", "Polo"), ("394", "Jacket"),
    ("87630", "Down Jacket"), ("58658", "Swimwear"), ("345535", "Kids"),
]
# accessories TYPE sections (Jewelry & Watches are handled separately, by brand)
ACC_TYPE_SEEDS = [
    ("392", "Glasses"), ("391", "Glasses"), ("28251", "Glasses"),
    ("393", "Belts"), ("385", "Hats"), ("384", "Hats"), ("168165", "Hats"),
    ("386", "Hats"), ("263724", "Perfume"), ("380", "Socks"),
    ("70206", "Socks"), ("390", "Scarf"),
]
# Brand-organised sections reached from a listing page (brands are sub-cats).
JEWELRY_LIST = ("43569", "jewelry", "All Jewelry", "Jewelry")   # id, slug, parent name, noun
WATCHES_LIST = ("383", "watches", "All Watches", "Watch")

# --- regexes over the very regular yg_shop template HTML ---
ANCHOR_RE = re.compile(r'<a\s+title="(?P<title>[^"]*)"\s+href="(?P<href>[^"]+)"\s*>(?P<body>.*?)</a>', re.S)
LISTTIME_RE = re.compile(r'class="list-time">\s*([0-9]{4}-[0-9]{2}-[0-9]{2})')
IMG_SRC_RE = re.compile(r'<img[^>]*\ssrc="([^"]+)"', re.S)
PRODUCT_IMG_RE = re.compile(r'src="([^"]*upfile/product/[^"]+)"')
CATEGORY_HREF_RE = re.compile(r'^category(?:en)?_(\d+)\.html')
PRODUCT_HREF_RE = re.compile(r'^producten?_(\d+)_0\.html')

ZH_MAP = {
    "短袖": "Short Sleeve", "短T": "T-Shirt", "短翻领": "Polo", "翻领": "Polo",
    "风衣": "Trench Coat", "外套夹克": "Jacket", "外套": "Coat", "夹克": "Jacket",
    "牛仔": "Denim", "棒球服": "Baseball Jacket", "羽绒": "Down Jacket",
    "泳装": "Swimwear", "春夏款童装": "Kids", "童装": "Kids", "时装": "Fashion",
    "款式": "Styles", "分类": "Category", "新款": "New", "不退换": "",
    "高版本": "High Edition", "瑜伽服": "Yoga", "恤": "Shirt", "短": "Short",
    "T恤": "T-Shirt",
}

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
# Singular noun used to build a professional product name per section.
SECTION_NOUN = {
    "Bags": "Bag", "Shoes": "Shoes", "Jewelry": "Jewelry", "Glasses": "Glasses",
    "Belts": "Belt", "Watches": "Watch", "Hats": "Hat", "Perfume": "Perfume",
    "Socks": "Socks", "Scarf": "Scarf", "T-Shirt": "T-Shirt", "Polo": "Polo",
    "Jacket": "Jacket", "Down Jacket": "Down Jacket", "Swimwear": "Swimwear",
    "Kids": "Kids Set", "Coat": "Coat", "Hoodie": "Hoodie", "Sweater": "Sweater",
    "Denim": "Denim", "Shorts": "Shorts", "Pants": "Pants", "Dress": "Dress",
}

_TYPE_WORDS = {w for needle, _ in TYPE_KEYWORDS for w in needle.replace("-", " ").split()}
# Accessory / product-type words to strip out of a brand so we get "YSL" not
# "YSL belt", "Zegna" not "Zegna Glasses", "Loewe" not "Loewe keyring", etc.
_ACCESSORY_WORDS = {
    "keyring", "keychain", "glasses", "glass", "belt", "belts", "scarf", "silk",
    "sock", "socks", "cap", "caps", "hat", "hats", "bucket", "watch", "watches",
    "perfume", "shoe", "shoes", "bag", "bags", "slipper", "slippers", "sneaker",
    "sneakers", "plain", "luggage", "jewelry", "jewellery", "clock", "women",
    "womens", "men", "mens", "ladies", "lady", "female", "male",
}
_STRIP_WORDS = _TYPE_WORDS | _ACCESSORY_WORDS
_SIZE_TOKEN_RE = re.compile(r'^[A-Za-z0-9]{1,3}-[A-Za-z0-9]{1,4}$')

# Generic (non-brand) category names to skip on bags/shoes brand listings.
GENERIC_NAMES = {
    "new", "arrival", "new arrival", "factory", "factory b", "factory c",
    "hot", "recommend", "more", "original", "luggage all", "all",
    "other", "others", "photos", "photo",
}
# Words to strip when turning a top-category title into a clean brand name.
_BRAND_STRIP = re.compile(
    r'\b(20\d{2}|1:1|original|factory|new|arrival|hot|recommend|kid|kids|2026|2025)\b',
    re.I,
)
TRAILING_DATE_RE = re.compile(r'\s+\d{3,4}(?:[A-Za-z]+)?$')
TRAILING_RANGE_RE = re.compile(r'\s+\d+\s*[-~]\s*\d+\s*天$')


def fetch(url, delay, session, retries=3):
    last_err = None
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=25)
            resp.raise_for_status()
            time.sleep(delay)
            return resp.content.decode("gb2312", errors="replace")
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(min(2 ** attempt, 8))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def clean_text(text):
    text = (text or "").strip()
    for zh, en in ZH_MAP.items():
        text = text.replace(zh, f" {en} " if en else " ")
    return re.sub(r'\s+', ' ', text).strip()


def clean_title(title):
    title = TRAILING_RANGE_RE.sub('', title or "")
    title = TRAILING_DATE_RE.sub('', title)
    return clean_text(title)


def slugify(text):
    text = clean_text(text).lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return re.sub(r'-{2,}', '-', text).strip('-')


def clean_brand_name(name):
    """Turn a category/album title into a clean brand, e.g. '2026 LV Original'
    -> 'LV', 'Gucci 2026 0729' -> 'Gucci', 'Kid shoes' -> '' (generic)."""
    t = clean_title(name)
    t = _BRAND_STRIP.sub(' ', t)
    tokens = [w for w in t.split() if w.lower() not in _STRIP_WORDS]
    return re.sub(r'\s+', ' ', " ".join(tokens)).strip()


def is_generic(name):
    """True for names that are not real brands (generic buckets, codes, single
    letters), so they collapse to a section-only category."""
    b = clean_text(name).lower()
    if not b or b in GENERIC_NAMES:
        return True
    if len(b) < 2:
        return True
    if re.fullmatch(r'[a-z]\d*', b):        # "b", "c0730"
        return True
    if re.fullmatch(r'[\d\W]+', b):          # pure numbers / punctuation
        return True
    return False


def detect_type(text):
    low = clean_text(text).lower()
    for needle, label in TYPE_KEYWORDS:
        if needle in low:
            return label
    return ""


def brand_of(title):
    """Brand = leading words before a size range / batch code, type words removed."""
    out = []
    for tok in clean_title(title).split():
        if _SIZE_TOKEN_RE.match(tok) or re.search(r'\d', tok):
            break
        out.append(tok)
    out = [w for w in out if w.lower() not in _STRIP_WORDS]
    return " ".join(out).strip()


def size_of(title):
    m = re.search(r'\b([A-Z0-9]{1,3}-[A-Z0-9]{1,4})\b', title or "")
    return m.group(1) if m else ""


# Product code = an alphanumeric token containing BOTH a letter and a digit
# (e.g. "8ylr3283", "M27330", "cztx7155"), used to build a clean, unique name.
_CODE_RE = re.compile(r'\b(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{3,}\b')


def clean_model(parent_title, brand):
    """Extract a human model name from the parent album title, e.g.
    'Rolex Day Date 0720' -> 'Day Date', 'LV Danube M14685' -> 'Danube'.
    Returns '' when nothing descriptive remains (codes/sizes/dates only)."""
    t = clean_title(parent_title or "")
    brand_words = {w.lower() for w in (brand or "").split()}
    out = []
    for tok in t.split():
        low = tok.lower()
        if low in brand_words or low in _STRIP_WORDS:
            continue
        if _SIZE_TOKEN_RE.match(tok) or re.search(r'\d', tok):  # sizes/dims/codes
            continue
        if "cm" in low or "mm" in low:
            continue
        out.append(tok)
    model = " ".join(out).strip()
    # avoid single-letter / junk models
    return model if len(model) >= 3 else ""


def ref_code(title, fallback):
    """Pick a clean product code from the title, ignoring dimension tokens
    (e.g. '21X6X16CM') and sizes; fall back to the source id."""
    cands = []
    for c in _CODE_RE.findall(clean_title(title)):
        cl = c.lower()
        if "cm" in cl or "mm" in cl:            # dimensions like 21x6x16cm
            continue
        if re.fullmatch(r'\d+x[\dx.]*', cl):    # 20x30, 20x30x10
            continue
        if re.fullmatch(r'\d?x{0,2}l|xl|xxl|xxxl', cl):  # sizes 3XL/XXL/XL
            continue
        cands.append(c)
    if not cands:
        return fallback[:12].upper()
    return max(cands, key=len)[:12].upper()  # longest looks most like a real code


def parse_items(html):
    for m in ANCHOR_RE.finditer(html):
        title = m.group("title")
        href = m.group("href").strip()
        body = m.group("body")
        if title == "Fashion Album" or not href:
            continue
        date_m = LISTTIME_RE.search(body)
        img_m = IMG_SRC_RE.search(body)
        prod_m = PRODUCT_HREF_RE.match(href)
        cat_m = CATEGORY_HREF_RE.match(href)
        if prod_m:
            kind, sid = "product", prod_m.group(1)
        elif cat_m:
            kind, sid = "category", cat_m.group(1)
        else:
            continue
        yield {
            "kind": kind, "id": sid, "title": title, "href": href,
            "date": date_m.group(1) if date_m else None,
            "thumb": img_m.group(1) if img_m else None,
        }


def gallery_images(html, cap):
    urls, seen = [], set()
    for raw in PRODUCT_IMG_RE.findall(html):
        enc = quote(raw, safe=":/?&=%")
        if enc not in seen:
            seen.add(enc)
            urls.append(enc)
        if cap and len(urls) >= cap:
            break
    return urls


def _seed(base, href, root_key, group, parent_slug, parent_name, noun,
          type_name="", brand_hint=""):
    return dict(base=base, href=href, root_key=root_key, group=group,
                parent_slug=parent_slug, parent_name=parent_name, noun=noun,
                type_name=type_name, brand_hint=brand_hint)


def brand_seeds_from(base, list_href, parent_slug, parent_name, noun, session, delay):
    """Build one brand-mode seed per sub-category found on a listing page
    (used for bags/shoes homepages and the Jewelry/Watches section pages)."""
    seeds = []
    try:
        html = fetch(urljoin(base, list_href), delay, session)
    except RuntimeError as exc:
        print(f"  ! could not load {parent_name}: {exc}", file=sys.stderr)
        return seeds
    for it in parse_items(html):
        if it["kind"] != "category":
            continue
        brand = clean_brand_name(it["title"])
        if is_generic(brand):
            continue
        seeds.append(_seed(base, it["href"], f"{parent_slug}:{brand.lower()}",
                           "brand", parent_slug, parent_name, noun, brand_hint=brand))
    return seeds


def build_seeds(domains, session, delay):
    """Return the root frames to crawl.

    group='type'  -> leaf category is the TYPE (T-Shirt, Belt, ...) under a
    parent (All Clothes / All Accessories). Used where products span too many
    niche brands to make per-brand categories worthwhile.
    group='brand' -> leaf category is the BRAND (LV, Rolex, ...) under a parent
    (All Bags / All Shoes / All Jewelry / All Watches). Used where the source is
    organised by brand.
    """
    seeds = []
    if "clothing" in domains:
        for cid, typ in CLOTHING_SEEDS:
            seeds.append(_seed(CLOTHING_BASE, f"categoryen_{cid}.html", f"clothing:{typ}",
                               "type", "clothing", "All Clothes", SECTION_NOUN.get(typ, typ),
                               type_name=typ))
    if "acc" in domains:
        for cid, typ in ACC_TYPE_SEEDS:
            seeds.append(_seed(ACC_BASE, f"categoryen_{cid}.html", f"accessories:{typ}",
                               "type", "accessories", "All Accessories", SECTION_NOUN.get(typ, typ),
                               type_name=typ))
    if "bags" in domains:
        seeds += brand_seeds_from(BAGS_BASE, "defaulten.html", "bags", "All Bags", "Bag", session, delay)
    if "shoes" in domains:
        seeds += brand_seeds_from(SHOES_BASE, "defaulten.html", "shoes", "All Shoes", "Shoes", session, delay)
    if "jewelry" in domains:
        cid, slug, pname, noun = JEWELRY_LIST
        seeds += brand_seeds_from(ACC_BASE, f"categoryen_{cid}.html", slug, pname, noun, session, delay)
    if "watches" in domains:
        cid, slug, pname, noun = WATCHES_LIST
        seeds += brand_seeds_from(ACC_BASE, f"categoryen_{cid}.html", slug, pname, noun, session, delay)
    return seeds


def leaf_category(group, type_name, brand, parent_slug, parent_name):
    """Compute (leaf_slug, leaf_name, parent_slug, parent_name) for a product."""
    if group == "type":
        return slugify(type_name), type_name, parent_slug, parent_name
    # group == "brand": leaf = brand (e.g. LV) under the parent (All Bags/...)
    if brand:
        return f"{parent_slug}-{slugify(brand)}", brand, parent_slug, parent_name
    return parent_slug, parent_name, "", ""


def build_product(item, base, group, type_name, brand, parent_slug, parent_name,
                  noun, images, parent_title=""):
    raw_title = clean_title(item["title"])
    size = size_of(item["title"])
    leaf_slug, leaf_name, p_slug, p_name = leaf_category(
        group, type_name, brand, parent_slug, parent_name)
    disp_type = type_name or noun

    # Professional name: prefer "<Brand> <Model>" from the album title
    # (e.g. "Rolex Day Date", "LV Danube"); otherwise "<Brand> <Type> <REF>".
    model = clean_model(parent_title, brand)
    code = ref_code(item["title"], item["id"])
    if model:
        name = " ".join(w for w in [brand, model] if w).strip()
    else:
        name = " ".join(w for w in [brand, noun] if w).strip()
        name = f"{name} {code}" if code else name

    desc_bits = []
    if brand:
        desc_bits.append(f"Brand: {brand}.")
    desc_bits.append(f"Category: {disp_type}.")
    if size:
        desc_bits.append(f"Sizes: {size}.")
    if raw_title:
        desc_bits.append(f"Reference: {raw_title}.")

    tags = [t for t in {(brand or "").lower(), leaf_slug, p_slug, "imported"} if t]

    return {
        "name": name or f"{disp_type} {item['id']}",
        "description": " ".join(desc_bits),
        "category": leaf_slug,
        "category_name": leaf_name,
        "parent_slug": p_slug,
        "parent_name": p_name,
        "section_name": disp_type,
        "brand": brand,
        "size": size,
        "images": images,
        "tags": tags,
        "date": item["date"],
        "source_id": item["id"],
        "source_url": urljoin(base, item["href"]),
    }


def crawl(seeds, since_date, limit, per_root, per_category, per_album,
          max_images, delay, dry_run, session):
    collected, visited, root_counts, cat_counts, album_counts = [], set(), {}, {}, {}
    skipped_old = 0
    stack = [(s["base"], s["href"], s["root_key"], None, s["group"], s["parent_slug"],
              s["parent_name"], s["noun"], s["type_name"], s["brand_hint"])
             for s in reversed(seeds)]

    while stack:
        if limit and len(collected) >= limit:
            break
        (base, href, root_key, parent_title, group, parent_slug,
         parent_name, noun, type_name, brand_hint) = stack.pop()
        if per_root and root_counts.get(root_key, 0) >= per_root:
            continue
        key = (base, href.split("?")[0])
        if key in visited:
            continue
        visited.add(key)

        try:
            html = fetch(urljoin(base, href), delay, session)
        except RuntimeError as exc:
            print(f"  ! skip {href}: {exc}", file=sys.stderr)
            continue

        subcats = []
        for it in parse_items(html):
            if it["kind"] == "category":
                subcats.append(it)
                continue
            if it["kind"] == "product":
                if per_root and root_counts.get(root_key, 0) >= per_root:
                    continue
                if since_date and it["date"]:
                    try:
                        d = datetime.strptime(it["date"], "%Y-%m-%d").date()
                    except ValueError:
                        d = None
                    if d and d < since_date:
                        skipped_old += 1
                        continue
                # Resolve brand + leaf category first so a full category is
                # skipped BEFORE we spend a request fetching its gallery.
                brand = brand_hint or brand_of(it["title"]) or clean_brand_name(parent_title or "")
                if is_generic(brand):
                    brand = ""
                cat_slug = leaf_category(group, type_name, brand, parent_slug, parent_name)[0]
                # Per-category cap only limits brand leaves; type leaves are
                # bounded by --per-root-limit instead.
                if group == "brand" and per_category and cat_counts.get(cat_slug, 0) >= per_category:
                    continue
                # Per-album cap: keep only a few products per model album (e.g.
                # per Rolex model) so a category shows model VARIETY instead of
                # 30 items from the first album.
                album_key = (root_key, parent_title or "")
                if per_album and album_counts.get(album_key, 0) >= per_album:
                    continue
                try:
                    images = gallery_images(fetch(urljoin(base, it["href"]), delay, session), max_images)
                except RuntimeError as exc:
                    print(f"  ! skip product {it['href']}: {exc}", file=sys.stderr)
                    images = []
                if not images and it.get("thumb"):
                    images = [quote(it["thumb"], safe=":/?&=%")]
                if not images:
                    continue
                record = build_product(it, base, group, type_name, brand, parent_slug,
                                       parent_name, noun, images, parent_title)
                collected.append(record)
                root_counts[root_key] = root_counts.get(root_key, 0) + 1
                cat_counts[cat_slug] = cat_counts.get(cat_slug, 0) + 1
                album_counts[album_key] = album_counts.get(album_key, 0) + 1
                if dry_run:
                    print(f"  [{len(collected):>4}] {record['date'] or '????-??-??'} "
                          f"| {record['category']:<20} | {len(images):>2}i | {record['name']}")
                if limit and len(collected) >= limit:
                    break
        # Push sub-categories so they are processed in PAGE ORDER (top first),
        # e.g. Rolex "Date Just, Day Date, Daytona, ..." before "Lovers".
        for it in reversed(subcats):
            stack.append((base, it["href"], root_key, it["title"], group,
                          parent_slug, parent_name, noun, type_name, brand_hint))
    return collected, skipped_old


async def upsert_products(records, stock, replace=False):
    import os
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL and DB_NAME must be set (or use --dry-run).")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    if replace:
        dp = (await db.products.delete_many({})).deleted_count
        dc = (await db.categories.delete_many({})).deleted_count
        print(f"Replace mode: deleted {dp} products and {dc} categories.")

    now = datetime.now(timezone.utc).isoformat()
    inserted = updated = 0
    categories_seen = set()
    parents_seen = set()

    for rec in records:
        parent_slug = rec["parent_slug"]
        parent_name = rec["parent_name"]
        # Ensure the PARENT category exists (top-level, no parent of its own).
        if parent_slug and parent_slug not in parents_seen:
            parents_seen.add(parent_slug)
            await db.categories.update_one(
                {"slug": parent_slug},
                {"$set": {"name": parent_name, "section": parent_name,
                          "section_slug": parent_slug, "parent": "", "parent_name": ""},
                 "$setOnInsert": {
                    "id": str(uuid.uuid4()), "slug": parent_slug,
                    "description": f"{parent_name} collection",
                    "image": rec["images"][0] if rec["images"] else "", "created_at": now}},
                upsert=True,
            )
        slug = rec["category"]
        if slug not in categories_seen:
            categories_seen.add(slug)
            # section/section_slug mirror the parent so the storefront groups
            # leaf categories under their parent without extra changes.
            await db.categories.update_one(
                {"slug": slug},
                {"$set": {
                    "name": rec["category_name"],
                    "section": parent_name,
                    "section_slug": parent_slug,
                    "parent": parent_slug,
                    "parent_name": parent_name,
                 },
                 "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "slug": slug,
                    "description": f"{rec['category_name']} - {parent_name}" if parent_name else rec["category_name"],
                    "image": rec["images"][0] if rec["images"] else "",
                    "created_at": now,
                 }},
                upsert=True,
            )

        set_fields = {
            "name": rec["name"], "description": rec["description"],
            "category": slug, "section": rec["parent_slug"],
            "section_name": rec["parent_name"], "type_name": rec["section_name"],
            "brand": rec["brand"],
            "images": rec["images"], "tags": rec["tags"], "is_new": True,
            "source_site": "tangma2088", "source_url": rec["source_url"],
            "updated_at": now,
        }
        # Structured Size variants from ranges like S-2XL / 39-45 so the
        # storefront can render selectable sizes (not a single opaque token).
        try:
            from size_range import size_variants_from_text
            variants = size_variants_from_text(
                rec.get("description") or "",
                rec.get("name") or "",
                rec.get("size") or "",
            )
            if variants:
                set_fields["variants"] = variants
                set_fields["has_variants"] = True
        except Exception:
            pass
        set_on_insert = {
            "id": str(uuid.uuid4()),
            "slug": f"{slugify(rec['name']) or 'product'}-{rec['source_id']}",
            "price": 0.0, "stock": stock, "featured": False, "on_sale": False,
            "created_at": now,
        }
        # Fill empty category images on update (not only on insert).
        if rec.get("images"):
            await db.categories.update_one(
                {
                    "slug": {"$in": [s for s in (slug, parent_slug) if s]},
                    "$or": [
                        {"image": {"$in": [None, ""]}},
                        {"image": {"$regex": r"/upfile/category/?$"}},
                    ],
                },
                {"$set": {"image": rec["images"][0]}},
            )
        res = await db.products.update_one(
            {"source_site": "tangma2088", "source_id": rec["source_id"]},
            {"$set": set_fields, "$setOnInsert": set_on_insert},
            upsert=True,
        )
        if res.upserted_id is not None:
            inserted += 1
        else:
            updated += 1

    client.close()
    return inserted, updated, len(categories_seen)


def parse_args(argv):
    p = argparse.ArgumentParser(description="Import tangma2088 network products into MongoDB.")
    p.add_argument("--domains", default="clothing,bags,shoes,acc,jewelry,watches",
                   help="Comma list of sources: clothing,bags,shoes,acc,jewelry,watches.")
    p.add_argument("--since", default="2025-12-01",
                   help="Only import products listed on/after this date (YYYY-MM-DD).")
    p.add_argument("--limit", type=int, default=0, help="Global max products (0 = none).")
    p.add_argument("--per-root-limit", type=int, default=0,
                   help="Max products per root seed (brand or section) (0 = none).")
    p.add_argument("--per-category-limit", type=int, default=30,
                   help="Max products per leaf category (section-brand) (0 = none).")
    p.add_argument("--per-album-limit", type=int, default=0,
                   help="Max products per source album/model (e.g. per Rolex model) "
                        "for variety within a category (0 = none).")
    p.add_argument("--max-images", type=int, default=6, help="Max images/product (0 = all).")
    p.add_argument("--delay", type=float, default=0.3, help="Delay between requests (s).")
    p.add_argument("--stock", type=int, default=10, help="Initial stock for new products.")
    p.add_argument("--dry-run", action="store_true", help="Crawl + report only; no DB writes.")
    p.add_argument("--replace", action="store_true",
                   help="DELETE all products + categories first, then import.")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    domains = [d.strip() for d in args.domains.split(",") if d.strip()]
    since_date = None
    if args.since:
        try:
            since_date = datetime.strptime(args.since, "%Y-%m-%d").date()
        except ValueError:
            raise SystemExit(f"--since must be YYYY-MM-DD, got {args.since!r}")

    mode = "DRY RUN (no DB writes)" if args.dry_run else "IMPORT"
    if args.replace:
        mode += " + REPLACE (wipes existing products & categories)"
    print("=" * 80)
    print("tangma2088 network -> Kayee01 product import")
    print(f"  domains        : {domains}")
    print(f"  since          : {since_date}")
    print(f"  per-category   : {args.per_category_limit or 'none'} | per-root: {args.per_root_limit or 'none'} | global: {args.limit or 'none'}")
    print(f"  mode           : {mode}")
    print("=" * 80)

    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    seeds = build_seeds(domains, session, args.delay)
    print(f"Discovered {len(seeds)} root categories to crawl.")

    records, skipped_old = crawl(
        seeds, since_date, args.limit, args.per_root_limit, args.per_category_limit,
        args.per_album_limit, args.max_images, args.delay, args.dry_run, session,
    )

    print("-" * 80)
    print(f"Products collected : {len(records)}")
    print(f"Skipped (too old)  : {skipped_old}")

    if args.dry_run:
        secs = {}
        for r in records:
            secs[r["section_name"]] = secs.get(r["section_name"], 0) + 1
        print("By section:", ", ".join(f"{k}={v}" for k, v in sorted(secs.items())))
        cats = sorted({r["category"] for r in records})
        print(f"Distinct categories: {len(cats)}")
        if args.replace:
            print("REPLACE mode: a real run would DELETE all existing products "
                  "and categories, then insert the products above.")
        print("Dry run complete - no database changes were made.")
        return

    if not records:
        print("Nothing to import (crawl returned 0 products); DB left untouched.")
        return

    import asyncio
    inserted, updated, ncats = asyncio.run(
        upsert_products(records, args.stock, replace=args.replace))
    print(f"Inserted new       : {inserted}")
    print(f"Updated existing   : {updated}")
    print(f"Categories ensured : {ncats}")
    print("Prices left at 0 for new products - set them in Admin.")
    print("Done.")


if __name__ == "__main__":
    main()
