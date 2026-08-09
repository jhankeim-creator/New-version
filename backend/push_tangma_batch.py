#!/usr/bin/env python3
"""Upsert a previously crawled Tangma batch JSON into MongoDB (local or Atlas).

Usage:
  export MONGO_URL='mongodb+srv://...' DB_NAME=kayee01_db
  python push_tangma_batch.py /tmp/tangma_batch_2025_2026.json
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne


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
    client.close()


if __name__ == "__main__":
    main()
