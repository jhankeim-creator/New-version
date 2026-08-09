#!/usr/bin/env python3
"""Upsert a previously crawled Tangma batch JSON into MongoDB (local or Atlas).

Also ensures leaf category documents exist so /shop/<section> aggregates and
category tiles can surface the new brands.

Usage:
  export MONGO_URL='mongodb+srv://...' DB_NAME=kayee01_db
  python push_tangma_batch.py /tmp/tangma_batch_2025_2026.json
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

SECTION_NAMES = {
    "shoes": "All Shoes",
    "clothing": "All Clothes",
    "bags": "All Bags",
    "accessories": "All Accessories",
    "watches": "All Watches",
    "jewelry": "All Jewelry",
    "electronics": "Electronics",
}


def _section_for(category: str, section: str | None) -> tuple[str, str]:
    """Return (parent_slug, parent_name) for a leaf category."""
    cat = (category or "").strip()
    sec = (section or "").strip()
    if sec in SECTION_NAMES:
        return sec, SECTION_NAMES[sec]
    for root, name in SECTION_NAMES.items():
        if cat == root or cat.startswith(f"{root}-"):
            return root, name
    return sec or cat, sec or cat


def _leaf_name(category: str, brand: str | None, type_name: str | None) -> str:
    if brand:
        return str(brand).strip()
    if type_name:
        return str(type_name).strip()
    cat = category or ""
    if "-" in cat:
        return cat.split("-", 1)[1].replace("-", " ").title()
    return cat.replace("-", " ").title() or "Products"


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: push_tangma_batch.py <batch.json>")
    path = sys.argv[1]
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        sys.exit("MONGO_URL must be set")
    db_name = os.environ.get("DB_NAME", "kayee01_db")
    rows = json.load(open(path))
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=20000)
    client.admin.command("ping")
    db = client[db_name]
    now = datetime.now(timezone.utc).isoformat()
    ops = []
    cat_meta: dict[str, dict] = {}
    for p in rows:
        sid = p.get("source_id")
        if not sid:
            continue
        # Enforce shoe floor
        if str(p.get("category") or "").startswith("shoes-"):
            try:
                if float(p.get("price") or 0) < 250:
                    p["price"] = 250.0
            except (TypeError, ValueError):
                p["price"] = 250.0
        slug = str(p.get("category") or "").strip()
        if slug and slug not in cat_meta:
            parent, parent_name = _section_for(slug, p.get("section") or p.get("parent_slug"))
            image = ""
            imgs = p.get("images") or []
            if imgs:
                image = imgs[0]
            cat_meta[slug] = {
                "slug": slug,
                "name": p.get("category_name")
                or _leaf_name(slug, p.get("brand"), p.get("type_name")),
                "parent": parent if parent != slug else "",
                "parent_name": parent_name if parent != slug else "",
                "section": parent_name if parent != slug else (parent_name or slug),
                "section_slug": parent if parent != slug else slug,
                "description": (
                    f"{_leaf_name(slug, p.get('brand'), p.get('type_name'))} - {parent_name}"
                    if parent and parent != slug
                    else _leaf_name(slug, p.get("brand"), p.get("type_name"))
                ),
                "image": image,
                "updated_at": now,
            }
        elif slug and cat_meta.get(slug) and not cat_meta[slug].get("image"):
            imgs = p.get("images") or []
            if imgs:
                cat_meta[slug]["image"] = imgs[0]
        doc = {**p, "updated_at": now}
        doc.pop("_id", None)
        created_at = doc.pop("created_at", None) or now
        ops.append(
            UpdateOne(
                {"source_site": "tangma2088", "source_id": str(sid)},
                {"$set": doc, "$setOnInsert": {"created_at": created_at}},
                upsert=True,
            )
        )
    if not ops:
        print("No ops")
        return
    res = db.products.bulk_write(ops, ordered=False)
    print(
        f"upserted={res.upserted_count} modified={res.modified_count} "
        f"matched={res.matched_count} total_ops={len(ops)}"
    )
    print("products now:", db.products.estimated_document_count())

    if cat_meta:
        cat_ops = []
        for slug, meta in cat_meta.items():
            parent = meta.get("parent") or ""
            if parent:
                parent_name = meta.get("parent_name") or SECTION_NAMES.get(parent, parent)
                cat_ops.append(
                    UpdateOne(
                        {"slug": parent},
                        {
                            "$set": {
                                "slug": parent,
                                "name": parent_name,
                                "section": parent_name,
                                "section_slug": parent,
                                "parent": "",
                                "parent_name": "",
                                "updated_at": now,
                            },
                            "$setOnInsert": {
                                "id": str(uuid.uuid4()),
                                "created_at": now,
                                "description": f"{parent_name} collection",
                                "image": "",
                            },
                        },
                        upsert=True,
                    )
                )
            cat_ops.append(
                UpdateOne(
                    {"slug": slug},
                    {
                        "$set": meta,
                        "$setOnInsert": {
                            "id": str(uuid.uuid4()),
                            "created_at": now,
                        },
                    },
                    upsert=True,
                )
            )
        cres = db.categories.bulk_write(cat_ops, ordered=False)
        print(
            f"categories upserted={cres.upserted_count} modified={cres.modified_count} "
            f"unique_leaves={len(cat_meta)}"
        )
    client.close()


if __name__ == "__main__":
    main()
