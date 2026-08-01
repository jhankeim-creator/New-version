"""
Delete products whose images are all broken (unreachable / 404).

A product is flagged only when it has no images at all, or when EVERY image URL
is unreachable. The check is conservative so a transient hiccup never deletes a
valid product: only a definitive HTTP error (>=400) or a hard connection/DNS
error marks an image broken. Timeouts are treated as "keep", and locally-served
relative paths (e.g. /uploads/..) and data URIs are always considered valid.

USAGE
-----
Dry run (report only, no deletes):

    export MONGO_URL="..." DB_NAME="kayee01_db"
    python prune_broken_images.py

Actually delete the flagged products:

    python prune_broken_images.py --apply
"""

import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

try:
    from pymongo import MongoClient
except Exception:  # pragma: no cover - pymongo ships with motor
    MongoClient = None

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
)


def image_reachable(url, timeout):
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if not u:
        return False
    if u.startswith("data:"):
        return True
    if not u.startswith("http"):
        return True
    try:
        resp = requests.get(
            u, timeout=timeout, stream=True, allow_redirects=True,
            headers={"User-Agent": UA},
        )
        code = resp.status_code
        resp.close()
        return code < 400
    except requests.exceptions.Timeout:
        return True
    except Exception:
        return False


def main(argv=None):
    parser = argparse.ArgumentParser(description="Delete products with all-broken images.")
    parser.add_argument("--apply", action="store_true", help="Actually delete flagged products.")
    parser.add_argument("--timeout", type=float, default=15.0, help="Per-image request timeout (s).")
    parser.add_argument("--workers", type=int, default=16, help="Concurrent image checks.")
    args = parser.parse_args(argv)

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        sys.exit("MONGO_URL and DB_NAME must be set.")
    if MongoClient is None:
        sys.exit("pymongo is required.")

    client = MongoClient(mongo_url)
    db = client[db_name]

    products = list(db.products.find({}, {"_id": 0, "id": 1, "name": 1, "images": 1}))
    unique_urls = set()
    for p in products:
        for img in (p.get("images") or []):
            if isinstance(img, str) and img.strip():
                unique_urls.add(img.strip())

    print(f"Checking {len(unique_urls)} unique image URLs across {len(products)} products...")
    reachable = {}
    if unique_urls:
        urls = list(unique_urls)
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            for u, ok in zip(urls, pool.map(lambda x: image_reachable(x, args.timeout), urls)):
                reachable[u] = ok

    broken = []
    for p in products:
        imgs = [i.strip() for i in (p.get("images") or []) if isinstance(i, str) and i.strip()]
        if not imgs or all(not reachable.get(i, False) for i in imgs):
            broken.append(p)

    print(f"Found {len(broken)} product(s) with all-broken images:")
    for b in broken:
        print(f"  - {b.get('name')} ({b.get('id')})")

    if args.apply and broken:
        ids = [b["id"] for b in broken if b.get("id")]
        res = db.products.delete_many({"id": {"$in": ids}})
        print(f"Deleted {res.deleted_count} product(s).")
    elif broken:
        print("Dry run - pass --apply to delete these products.")

    client.close()


if __name__ == "__main__":
    main()
