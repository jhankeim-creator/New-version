#!/usr/bin/env python3
"""Import the exact tangma2088 category/album URLs requested by the merchant.

Only products listed on/after ``--since`` (default 2025-01-01) are kept.
Size ranges in titles (S-2XL, sz38-45, …) become selectable Size variants.
New products start at price 0; run ``set_prices.py --apply`` afterwards (and
shoe/watch/jewelry floors remain enforced by the API).

USAGE
-----
    export MONGO_URL="mongodb+srv://..." DB_NAME="kayee01_db"
    python sync_url_products.py --since 2025-01-01              # dry run
    python sync_url_products.py --since 2025-01-01 --apply      # write
    python set_prices.py --apply                                # fill prices
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from urllib.parse import quote

import sync_tangma_products as S

ACC = S.ACC_BASE
CLO = S.CLOTHING_BASE
BAGS = S.BAGS_BASE
SHOES = S.SHOES_BASE

# Seeds from the merchant URL list (Aug 2026).
# (base, href, group, type_name, parent_slug, parent_name, noun, brand_hint)
SEEDS = [
    # Gucci caps album (hats) — product_300964 listing of productinfoen_* items
    (ACC, "product_300964_0.html", "brand", "Hats", "accessories", "All Accessories",
     "Hat", "Gucci"),
    # Shoes brand hubs / leaves
    (SHOES, "categoryen_72.html", "brand", "", "shoes", "All Shoes", "Shoes", "Versace"),
    (SHOES, "categoryen_56.html", "brand", "", "shoes", "All Shoes", "Shoes", "Valentino"),
    (SHOES, "categoryen_82692.html", "brand", "", "shoes", "All Shoes", "Shoes", "Dior"),
    (SHOES, "categoryen_28852.html", "brand", "", "shoes", "All Shoes", "Shoes", "UGG"),
    (SHOES, "categoryen_84731.html", "brand", "", "shoes", "All Shoes", "Shoes", "YSL"),
    (SHOES, "categoryen_110700.html", "brand", "", "shoes", "All Shoes", "Shoes", "Lanvin"),
    (SHOES, "categoryen_108504.html", "brand", "", "shoes", "All Shoes", "Shoes", "Dior"),
    (SHOES, "categoryen_177056.html", "brand", "", "shoes", "All Shoes", "Shoes", "Dior"),
    (SHOES, "categoryen_118414.html", "brand", "", "shoes", "All Shoes", "Shoes", "LV"),
    (SHOES, "categoryen_182050.html", "brand", "", "shoes", "All Shoes", "Shoes", "Dymonlatry"),
    (SHOES, "categoryen_180714.html", "brand", "", "shoes", "All Shoes", "Shoes",
     "Christian Louboutin"),
    (SHOES, "categoryen_177257.html", "brand", "", "shoes", "All Shoes", "Shoes", "LV"),
    # Gucci tote bags leaf
    (BAGS, "categoryen_124208.html", "brand", "", "bags", "All Bags", "Bag", "Gucci"),
    # Clothing brand albums
    (CLO, "categoryen_411264.html", "brand", "", "clothing", "All Clothes", "Shirt", "Boss"),
    (CLO, "categoryen_410088.html", "brand", "", "clothing", "All Clothes", "Shirt", "Armani"),
    # Polo brand hubs (sub-albums under Gucci / LV polo)
    (CLO, "categoryen_942.html", "type", "Polo", "clothing", "All Clothes", "Polo", ""),
    (CLO, "categoryen_943.html", "type", "Polo", "clothing", "All Clothes", "Polo", ""),
]


def load_existing_ids(mongo_url: str) -> set:
    from pymongo import MongoClient

    db_name = os.environ.get("DB_NAME")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=20000)
    db = client[db_name] if db_name else client.get_default_database()
    ids = {
        str(p["source_id"])
        for p in db.products.find(
            {"source_site": "tangma2088", "source_id": {"$exists": True}},
            {"_id": 0, "source_id": 1},
        )
        if p.get("source_id")
    }
    client.close()
    return ids


def _parse_date(raw):
    if not raw:
        return None
    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def crawl_category(
    base,
    href,
    group,
    type_name,
    parent_slug,
    parent_name,
    noun,
    brand_hint,
    existing,
    records,
    seen,
    cap,
    delay,
    max_images,
    session,
    depth,
    parent_title,
    since_date,
    skipped_old,
):
    if cap and len(records) >= cap:
        return skipped_old
    key = (base, href.split("?")[0])
    if key in seen:
        return skipped_old
    seen.add(key)
    try:
        html = S.fetch(S.urljoin(base, href), delay, session)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! skip {href}: {exc}", file=sys.stderr)
        return skipped_old

    subcats = []
    for it in S.parse_items(html):
        if cap and len(records) >= cap:
            break
        if it["kind"] == "category":
            subcats.append(it)
            continue

        d = _parse_date(it.get("date"))
        if since_date and d and d < since_date:
            skipped_old += 1
            continue
        # If the listing has no date, keep it only when since is unset.
        if since_date and not d:
            skipped_old += 1
            continue

        sid = str(it["id"])
        if sid in existing:
            continue

        brand = (
            brand_hint
            or S.brand_of(it["title"])
            or (S.clean_brand_name(parent_title or "") if group == "brand" else "")
        )
        if S.is_generic(brand):
            brand = brand_hint or ""

        try:
            images = S.gallery_images(
                S.fetch(S.urljoin(base, it["href"]), delay, session),
                max_images,
                source_id=sid,
            )
        except Exception:  # noqa: BLE001
            images = []
        if not images and it.get("thumb"):
            images = [quote(it["thumb"], safe=":/?&=%")]
        if not images:
            continue

        rec = S.build_product(
            it, base, group, type_name, brand, parent_slug, parent_name, noun, images, parent_title
        )
        records.append(rec)
        existing.add(sid)
        print(
            f"  [{len(records):>4}] {rec.get('date') or '????-??-??'} | "
            f"{rec['category']:<22} | {rec['name'][:55]}"
        )

    if depth < 4:
        for sub in subcats:
            if cap and len(records) >= cap:
                break
            # Prefer sub-album brand hint when the title carries one
            sub_brand = brand_hint or S.clean_brand_name(sub["title"]) or ""
            if S.is_generic(sub_brand):
                sub_brand = brand_hint
            skipped_old = crawl_category(
                base,
                sub["href"],
                group,
                type_name,
                parent_slug,
                parent_name,
                noun,
                sub_brand,
                existing,
                records,
                seen,
                cap,
                delay,
                max_images,
                session,
                depth + 1,
                sub["title"],
                since_date,
                skipped_old,
            )
    return skipped_old


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Import merchant-requested tangma2088 URLs (2025+ by default)."
    )
    parser.add_argument("--apply", action="store_true", help="Write to MongoDB (default: dry run).")
    parser.add_argument("--since", default="2025-01-01", help="YYYY-MM-DD listing-date floor.")
    parser.add_argument("--per-cat", type=int, default=80, help="Max NEW products per seed URL.")
    parser.add_argument("--max-images", type=int, default=6)
    parser.add_argument("--delay", type=float, default=0.2)
    parser.add_argument("--stock", type=int, default=5000)
    parser.add_argument(
        "--env-file",
        default="",
        help="Optional dotenv file (e.g. .env.atlas) to load MONGO_URL from.",
    )
    args = parser.parse_args(argv)

    if args.env_file:
        from dotenv import load_dotenv

        load_dotenv(args.env_file, override=True)

    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        sys.exit("MONGO_URL must be set.")

    since_date = None
    if args.since:
        try:
            since_date = datetime.strptime(args.since, "%Y-%m-%d").date()
        except ValueError as exc:
            raise SystemExit(f"--since must be YYYY-MM-DD: {exc}") from exc

    existing: set = set()
    try:
        existing = load_existing_ids(mongo_url)
    except Exception as exc:  # noqa: BLE001
        if args.apply:
            raise
        print(f"(could not load existing ids: {exc})")
    print(f"Known existing tangma source_ids: {len(existing)}")
    print(f"Since: {since_date} | per-cat: {args.per_cat}")

    session = S.requests.Session()
    session.headers.update({"User-Agent": S.UA})

    all_records = []
    seen = set()
    skipped_old = 0
    for base, href, group, type_name, parent_slug, parent_name, noun, brand_hint in SEEDS:
        before = len(all_records)
        records_for_cat = []
        skipped_old = crawl_category(
            base,
            href,
            group,
            type_name,
            parent_slug,
            parent_name,
            noun,
            brand_hint,
            existing,
            records_for_cat,
            seen,
            args.per_cat,
            args.delay,
            args.max_images,
            session,
            0,
            brand_hint,
            since_date,
            skipped_old,
        )
        all_records.extend(records_for_cat)
        print(f"== {base.rstrip('/')}/{href}: +{len(all_records) - before} new")

    print("-" * 70)
    print(f"NEW products collected: {len(all_records)} | skipped older than {since_date}: {skipped_old}")
    secs = {}
    for r in all_records:
        secs[r["category"]] = secs.get(r["category"], 0) + 1
    print("By leaf category:", ", ".join(f"{k}={v}" for k, v in sorted(secs.items())))

    # Preview size-variant coverage
    from size_range import size_variants_from_text

    with_sizes = 0
    for r in all_records:
        if size_variants_from_text(r.get("description") or "", r.get("name") or "", r.get("size") or ""):
            with_sizes += 1
    print(f"Products with Size variants detectable: {with_sizes}/{len(all_records)}")

    if not args.apply:
        print("\nDry run - pass --apply to write these products to MongoDB.")
        return
    if not all_records:
        print("Nothing new to import.")
        return

    import asyncio

    inserted, updated, ncats = asyncio.run(
        S.upsert_products(all_records, args.stock, replace=False)
    )
    print(f"Inserted new: {inserted} | Updated: {updated} | Categories ensured: {ncats}")
    print("Next: python set_prices.py --apply   # fill $0 prices with category ranges/floors")


if __name__ == "__main__":
    main()
