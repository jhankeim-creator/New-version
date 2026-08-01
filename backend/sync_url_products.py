"""
Targeted importer for the specific tangma2088 category URLs requested.

Unlike ``sync_tangma_products.py`` (which crawls from fixed homepage seeds), this
imports the EXACT categories that were provided, and is DB-aware: it skips any
product whose ``source_id`` already exists (so it only spends the slow ~8s
per-request gallery fetch on genuinely NEW products). Imported products start at
price 0 and are priced afterwards by ``set_prices.py`` (which enforces the $80
floor).

Taxonomy is kept consistent with the existing catalogue by reusing
``sync_tangma_products`` helpers:
  * "type" seeds  -> leaf category = the type (e.g. Polo, Jacket, Glasses,
                     Smart Watch), grouped under its parent (Clothes/Accessories).
  * "brand" seeds -> leaf category = parent-brand (e.g. bags-lv, shoes-amiri,
                     watches-rolex), grouped under All Bags/Shoes/Watches.
Jewelry is intentionally excluded here (already well populated and uses a
type -> brand structure that its own importer maintains).

USAGE
-----
    export MONGO_URL="mongodb+srv://.../kayee01_db?..."
    python import_from_urls.py --per-cat 40            # dry run (crawl + report)
    python import_from_urls.py --per-cat 40 --apply    # write to MongoDB
"""

import argparse
import os
import sys
from urllib.parse import quote

import sync_tangma_products as S

ACC = S.ACC_BASE
CLO = S.CLOTHING_BASE
BAGS = S.BAGS_BASE
SHOES = S.SHOES_BASE

# (base, [category_ids], group, type_name, parent_slug, parent_name, noun)
SEEDS = [
    (ACC, ["363"], "type", "Smart Watch", "accessories", "All Accessories", "Smart Watch"),
    (ACC, ["208159", "208641", "271131", "23812", "208473"], "type", "Glasses",
     "accessories", "All Accessories", "Glasses"),
    (ACC, ["66380", "18955", "13671", "200177"], "brand", "", "watches", "All Watches", "Watch"),
    (CLO, ["942"], "type", "Polo", "clothing", "All Clothes", "Polo"),
    (CLO, ["372942"], "type", "Jacket", "clothing", "All Clothes", "Jacket"),
    (BAGS, ["23235", "2410", "42002", "11082"], "brand", "", "bags", "All Bags", "Bag"),
    (SHOES, ["109337", "178041", "161", "177302", "118960", "178289", "108502", "224",
             "177056", "110520", "177033", "158237", "177521", "347", "37934", "82269",
             "180739", "30512", "180708"], "brand", "", "shoes", "All Shoes", "Shoes"),
]


def load_existing_ids(mongo_url):
    from pymongo import MongoClient
    db_name = os.environ.get("DB_NAME")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=20000)
    db = client[db_name] if db_name else client.get_default_database()
    ids = set()
    for p in db.products.find({}, {"_id": 0, "source_id": 1}):
        sid = p.get("source_id")
        if sid:
            ids.add(str(sid))
    client.close()
    return ids


def crawl_category(base, href, group, type_name, parent_slug, parent_name, noun,
                   existing, records, seen, cap, delay, max_images, session,
                   depth, parent_title):
    if len(records) >= cap:
        return
    key = (base, href.split("?")[0])
    if key in seen:
        return
    seen.add(key)
    try:
        html = S.fetch(S.urljoin(base, href), delay, session)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! skip {href}: {exc}", file=sys.stderr)
        return

    subcats = []
    for it in S.parse_items(html):
        if len(records) >= cap:
            break
        if it["kind"] == "category":
            subcats.append(it)
            continue
        sid = str(it["id"])
        if sid in existing:
            continue
        brand = S.brand_of(it["title"]) or (S.clean_brand_name(parent_title or "") if group == "brand" else "")
        if S.is_generic(brand):
            brand = ""
        try:
            images = S.gallery_images(S.fetch(S.urljoin(base, it["href"]), delay, session), max_images)
        except Exception:  # noqa: BLE001
            images = []
        if not images and it.get("thumb"):
            images = [quote(it["thumb"], safe=":/?&=%")]
        if not images:
            continue
        rec = S.build_product(it, base, group, type_name, brand, parent_slug,
                              parent_name, noun, images, parent_title)
        records.append(rec)
        existing.add(sid)
        print(f"  [{len(records):>4}] {rec['category']:<22} | {rec['name']}")

    if depth < 3:
        for sub in subcats:
            if len(records) >= cap:
                break
            crawl_category(base, sub["href"], group, type_name, parent_slug, parent_name,
                           noun, existing, records, seen, cap, delay, max_images, session,
                           depth + 1, sub["title"])


def main(argv=None):
    parser = argparse.ArgumentParser(description="Import the requested tangma2088 category URLs.")
    parser.add_argument("--apply", action="store_true", help="Write to MongoDB (default: dry run).")
    parser.add_argument("--per-cat", type=int, default=40, help="Max NEW products per top category.")
    parser.add_argument("--max-images", type=int, default=6)
    parser.add_argument("--delay", type=float, default=0.2)
    parser.add_argument("--stock", type=int, default=10)
    args = parser.parse_args(argv)

    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        sys.exit("MONGO_URL must be set.")

    existing = load_existing_ids(mongo_url) if args.apply else set()
    # In dry-run we still want to avoid re-listing already-imported products, so
    # load existing ids when possible.
    if not args.apply:
        try:
            existing = load_existing_ids(mongo_url)
        except Exception:  # noqa: BLE001
            existing = set()
    print(f"Known existing product source_ids: {len(existing)}")

    session = S.requests.Session()
    session.headers.update({"User-Agent": S.UA})

    all_records = []
    seen = set()
    for base, cids, group, type_name, parent_slug, parent_name, noun in SEEDS:
        for cid in cids:
            before = len(all_records)
            records_for_cat = []
            crawl_category(base, f"categoryen_{cid}.html", group, type_name, parent_slug,
                           parent_name, noun, existing, records_for_cat, seen,
                           args.per_cat, args.delay, args.max_images, session, 0, "")
            all_records.extend(records_for_cat)
            print(f"== {base}cat {cid}: +{len(all_records) - before} new products")

    print("-" * 70)
    print(f"NEW products collected: {len(all_records)}")
    secs = {}
    for r in all_records:
        secs[r["category"]] = secs.get(r["category"], 0) + 1
    print("By leaf category:", ", ".join(f"{k}={v}" for k, v in sorted(secs.items())))

    if not args.apply:
        print("\nDry run - pass --apply to write these products to MongoDB.")
        return
    if not all_records:
        print("Nothing new to import.")
        return

    import asyncio
    inserted, updated, ncats = asyncio.run(
        S.upsert_products(all_records, args.stock, replace=False))
    print(f"Inserted new: {inserted} | Updated: {updated} | Categories ensured: {ncats}")
    print("New products start at price 0 - run set_prices.py to price them ($80 floor).")


if __name__ == "__main__":
    main()
