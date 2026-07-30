"""
Import JEWELRY from the tangma2088 network organised as

    All Jewelry  ->  TYPE (Necklace / Ring / Bracelet / Brooch / Earrings)
                 ->  BRAND (Cartier, Bvlgari, Chanel, ...)
                 ->  products

The public jewelry listing (macc.tangma2088.com, category 43569) is organised by
BRAND only. This script crawls each brand album, reads the product title (which
contains words like "Necklace", "Ring", "Bracelet", "Brooch", "Earring") and
classifies every product into a jewelry TYPE. Each product is filed under a leaf
category ``<type>-<brand>`` (e.g. ``necklace-cartier``) whose parent section is
the TYPE, so the storefront shows: Necklace -> [Cartier, Celine, ...] -> items.

It reuses the well-tested crawl/parse helpers from ``sync_tangma_products`` and
never touches non-jewelry products (idempotent by source_id, no --replace).

USAGE
-----
Dry run (crawl + report only):

    python sync_jewelry_products.py --limit 60 --per-category-limit 10 --dry-run

Real import (adds/updates jewelry only, prices start at 0):

    export MONGO_URL="..." DB_NAME="kayee01_db"
    python sync_jewelry_products.py --since 2024-01-01 --per-category-limit 40
"""

import argparse
import re
import sys
import uuid
from datetime import datetime, timezone
from urllib.parse import quote, urljoin

import requests

from sync_tangma_products import (
    UA, ACC_BASE, JEWELRY_LIST,
    fetch, parse_items, gallery_images, clean_title, clean_brand_name,
    is_generic, brand_of, slugify, ref_code, clean_model, size_of,
    brand_seeds_from,
)

# Ordered so more specific words win first ("earring" before "ring").
TYPE_RULES = [
    ("earrings", "Earrings"), ("earring", "Earrings"), ("ear stud", "Earrings"),
    ("ear clip", "Earrings"), ("ear-clip", "Earrings"), ("eardrop", "Earrings"),
    ("necklace", "Necklace"), ("pendant", "Necklace"), ("choker", "Necklace"),
    ("clavicle chain", "Necklace"), ("chain", "Necklace"),
    ("bracelet", "Bracelet"), ("bangle", "Bracelet"), ("cuff", "Bracelet"),
    ("anklet", "Bracelet"),
    ("brooch", "Brooch"), ("badge", "Brooch"), ("lapel pin", "Brooch"), ("pin", "Brooch"),
    ("ring", "Ring"),
]

TYPE_SLUG = {
    "Necklace": "necklace",
    "Ring": "ring",
    "Bracelet": "bracelet",
    "Brooch": "brooch",
    "Earrings": "earrings",
    "Other Jewelry": "jewelry-other",
}


def detect_jewelry_type(*texts):
    """Classify a jewelry TYPE from a product/album title, defaulting to
    'Other Jewelry' when no type keyword is present."""
    blob = " ".join(clean_title(t or "") for t in texts).lower()
    for needle, label in TYPE_RULES:
        # word-boundary before the needle so 'ring' does not match 'earring'
        if re.search(r'\b' + re.escape(needle), blob):
            return label
    return "Other Jewelry"


def build_jewelry_product(item, base, type_label, brand, images, parent_title=""):
    type_slug = TYPE_SLUG[type_label]
    brand_slug = slugify(brand) if brand else ""
    leaf_slug = f"{type_slug}-{brand_slug}" if brand_slug else type_slug
    leaf_name = brand or type_label

    raw_title = clean_title(item["title"])
    size = size_of(item["title"])
    code = ref_code(item["title"], item["id"])
    noun = "Jewelry" if type_label == "Other Jewelry" else type_label

    # Drop type/generic words from the album-derived model so we don't end up
    # with duplicated nouns like "LV Ring Ring" or "Gucci Necklace Necklace".
    _drop = {"necklace", "ring", "bracelet", "brooch", "brooh", "earring",
             "earrings", "suits", "suit", "jewelry", "jewellery", "bangle",
             "pendant", "choker", "set", "sets", "other"}
    model = clean_model(parent_title, brand)
    model = " ".join(w for w in model.split() if w.lower() not in _drop)

    if model:
        name = " ".join(w for w in [brand, model, noun] if w).strip()
    else:
        name = " ".join(w for w in [brand, noun] if w).strip()
        name = f"{name} {code}" if code else name

    desc_bits = []
    if brand:
        desc_bits.append(f"Brand: {brand}.")
    desc_bits.append(f"Category: {type_label}.")
    if size:
        desc_bits.append(f"Sizes: {size}.")
    if raw_title:
        desc_bits.append(f"Reference: {raw_title}.")

    tags = [t for t in {(brand or "").lower(), leaf_slug, type_slug, "jewelry", "imported"} if t]

    return {
        "name": name or f"{type_label} {item['id']}",
        "description": " ".join(desc_bits),
        "category": leaf_slug,
        "category_name": leaf_name,
        "type_slug": type_slug,
        "type_label": type_label,
        "brand": brand,
        "size": size,
        "images": images,
        "tags": tags,
        "date": item["date"],
        "source_id": item["id"],
        "source_url": urljoin(base, item["href"]),
    }


def crawl_jewelry(since_date, limit, per_category, per_brand, max_images,
                  delay, dry_run, session):
    seeds = brand_seeds_from(ACC_BASE, f"categoryen_{JEWELRY_LIST[0]}.html",
                             "jewelry", "All Jewelry", "Jewelry", session, delay)
    print(f"Discovered {len(seeds)} jewelry brand categories to crawl.")

    collected, visited = [], set()
    leaf_counts, brand_counts = {}, {}

    for seed in seeds:
        if limit and len(collected) >= limit:
            break
        brand_hint = seed.get("brand_hint", "")
        stack = [(seed["href"], None)]
        while stack:
            if limit and len(collected) >= limit:
                break
            href, parent_title = stack.pop()
            key = href.split("?")[0]
            if key in visited:
                continue
            visited.add(key)
            try:
                html = fetch(urljoin(ACC_BASE, href), delay, session)
            except RuntimeError as exc:
                print(f"  ! skip {href}: {exc}", file=sys.stderr)
                continue

            subcats = []
            for it in parse_items(html):
                if it["kind"] == "category":
                    subcats.append(it)
                    continue
                # product
                if since_date and it["date"]:
                    try:
                        d = datetime.strptime(it["date"], "%Y-%m-%d").date()
                    except ValueError:
                        d = None
                    if d and d < since_date:
                        continue
                brand = brand_hint or brand_of(it["title"]) or clean_brand_name(parent_title or "")
                if is_generic(brand):
                    brand = ""
                type_label = detect_jewelry_type(it["title"], parent_title)
                type_slug = TYPE_SLUG[type_label]
                brand_slug = slugify(brand) if brand else ""
                leaf_slug = f"{type_slug}-{brand_slug}" if brand_slug else type_slug

                if per_category and leaf_counts.get(leaf_slug, 0) >= per_category:
                    continue
                if per_brand and brand_slug and brand_counts.get(brand_slug, 0) >= per_brand:
                    continue

                try:
                    images = gallery_images(
                        fetch(urljoin(ACC_BASE, it["href"]), delay, session), max_images)
                except RuntimeError as exc:
                    print(f"  ! skip product {it['href']}: {exc}", file=sys.stderr)
                    images = []
                if not images and it.get("thumb"):
                    images = [quote(it["thumb"], safe=":/?&=%")]
                if not images:
                    continue

                rec = build_jewelry_product(it, ACC_BASE, type_label, brand, images, parent_title)
                collected.append(rec)
                leaf_counts[leaf_slug] = leaf_counts.get(leaf_slug, 0) + 1
                if brand_slug:
                    brand_counts[brand_slug] = brand_counts.get(brand_slug, 0) + 1
                if dry_run:
                    print(f"  [{len(collected):>4}] {rec['date'] or '????-??-??'} "
                          f"| {rec['category']:<22} | {len(images):>2}i | {rec['name']}")
                if limit and len(collected) >= limit:
                    break

            for it in reversed(subcats):
                stack.append((it["href"], it["title"]))

    return collected


async def upsert_jewelry(records, stock):
    import os
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL and DB_NAME must be set (or use --dry-run).")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    now = datetime.now(timezone.utc).isoformat()
    inserted = updated = 0
    types_seen, leaves_seen = set(), set()

    for rec in records:
        type_slug = rec["type_slug"]
        type_label = rec["type_label"]
        leaf_slug = rec["category"]

        # Ensure the TYPE section category exists (top-level jewelry type).
        if type_slug not in types_seen:
            types_seen.add(type_slug)
            await db.categories.update_one(
                {"slug": type_slug},
                {"$set": {"name": type_label, "section": "All Jewelry",
                          "section_slug": "jewelry", "parent": "jewelry",
                          "parent_name": "All Jewelry"},
                 "$setOnInsert": {
                    "id": str(uuid.uuid4()), "slug": type_slug,
                    "description": f"{type_label} - designer jewelry",
                    "image": rec["images"][0] if rec["images"] else "",
                    "created_at": now}},
                upsert=True,
            )

        # Ensure the leaf BRAND category exists under its TYPE section.
        if leaf_slug not in leaves_seen:
            leaves_seen.add(leaf_slug)
            await db.categories.update_one(
                {"slug": leaf_slug},
                {"$set": {"name": rec["category_name"], "section": type_label,
                          "section_slug": type_slug, "parent": type_slug,
                          "parent_name": type_label},
                 "$setOnInsert": {
                    "id": str(uuid.uuid4()), "slug": leaf_slug,
                    "description": f"{rec['category_name']} {type_label}",
                    "image": rec["images"][0] if rec["images"] else "",
                    "created_at": now}},
                upsert=True,
            )

        set_fields = {
            "name": rec["name"], "description": rec["description"],
            "category": leaf_slug, "section": type_slug,
            "section_name": type_label, "type_name": type_label,
            "brand": rec["brand"], "images": rec["images"], "tags": rec["tags"],
            "is_new": True, "source_site": "tangma2088",
            "source_url": rec["source_url"], "updated_at": now,
        }
        set_on_insert = {
            "id": str(uuid.uuid4()),
            "slug": f"{slugify(rec['name']) or 'jewelry'}-{rec['source_id']}",
            "price": 0.0, "stock": stock, "featured": False, "on_sale": False,
            "created_at": now,
        }
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
    return inserted, updated, len(leaves_seen)


def parse_args(argv):
    p = argparse.ArgumentParser(description="Import jewelry (type -> brand) into MongoDB.")
    p.add_argument("--since", default="2024-01-01",
                   help="Only import products listed on/after this date (YYYY-MM-DD).")
    p.add_argument("--limit", type=int, default=0, help="Global max products (0 = none).")
    p.add_argument("--per-category-limit", type=int, default=40,
                   help="Max products per leaf (type-brand) category (0 = none).")
    p.add_argument("--per-brand-limit", type=int, default=0,
                   help="Max products per brand across all types (0 = none).")
    p.add_argument("--max-images", type=int, default=5, help="Max images/product (0 = all).")
    p.add_argument("--delay", type=float, default=0.25, help="Delay between requests (s).")
    p.add_argument("--stock", type=int, default=10, help="Initial stock for new products.")
    p.add_argument("--dry-run", action="store_true", help="Crawl + report only; no DB writes.")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    since_date = None
    if args.since:
        try:
            since_date = datetime.strptime(args.since, "%Y-%m-%d").date()
        except ValueError:
            raise SystemExit(f"--since must be YYYY-MM-DD, got {args.since!r}")

    print("=" * 80)
    print("tangma2088 JEWELRY -> Kayee01 (All Jewelry -> Type -> Brand -> products)")
    print(f"  since        : {since_date}")
    print(f"  per-category : {args.per_category_limit or 'none'} | per-brand: {args.per_brand_limit or 'none'} | global: {args.limit or 'none'}")
    print(f"  mode         : {'DRY RUN (no DB writes)' if args.dry_run else 'IMPORT'}")
    print("=" * 80)

    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    records = crawl_jewelry(
        since_date, args.limit, args.per_category_limit, args.per_brand_limit,
        args.max_images, args.delay, args.dry_run, session,
    )

    print("-" * 80)
    print(f"Products collected : {len(records)}")
    by_type = {}
    for r in records:
        by_type[r["type_label"]] = by_type.get(r["type_label"], 0) + 1
    print("By type:", ", ".join(f"{k}={v}" for k, v in sorted(by_type.items())))
    leaves = sorted({r["category"] for r in records})
    print(f"Distinct leaf categories: {len(leaves)}")

    if args.dry_run:
        print("Dry run complete - no database changes were made.")
        return
    if not records:
        print("Nothing to import; DB left untouched.")
        return

    import asyncio
    inserted, updated, nleaves = asyncio.run(upsert_jewelry(records, args.stock))
    print(f"Inserted new       : {inserted}")
    print(f"Updated existing   : {updated}")
    print(f"Leaf categories    : {nleaves}")
    print("Prices left at 0 for new products - set them in Admin.")
    print("Done.")


if __name__ == "__main__":
    main()
