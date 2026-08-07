#!/usr/bin/env python3
"""Create the Electronics section and move misplaced gadget products into it.

The store had ~31 "smart-watch" accessories that are actually earbuds,
headphones, speakers, and Apple watches. This script:

1. Ensures an ``electronics`` parent section + leaf categories
2. Reclassifies products from ``smart-watch`` (and any matching stragglers)
3. Cleans bogus "Smart Watch" suffixes from non-watch names
4. Removes the empty legacy ``smart-watch`` accessories category

Usage:
  python setup_electronics_category.py            # dry run (production)
  python setup_electronics_category.py --apply
  python setup_electronics_category.py --api http://localhost:8001 --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_API = "https://api.kayee01.com"
ADMIN_EMAIL = "kayicom509@gmail.com"
ADMIN_PASSWORD = "Admin123!"

SECTION = {
    "name": "All Electronics",
    "slug": "electronics",
    "description": "Electronics — headphones, speakers, and smart devices",
    "image": "",
    "section": "All Electronics",
    "section_slug": "electronics",
    "parent": "",
    "parent_name": "",
}

LEAVES = [
    {
        "name": "Headphones & Earbuds",
        "slug": "electronics-headphones",
        "description": "Headphones, earbuds and wireless audio",
    },
    {
        "name": "Speakers",
        "slug": "electronics-speakers",
        "description": "Bluetooth and portable speakers",
    },
    {
        "name": "Smart Watches",
        "slug": "electronics-smart-watches",
        "description": "Smart watches and wearables",
    },
]

SPEAKER_KEYS = (
    "jbl", "marshall", "mashall", "kilburn", "middleton", "boombox", "flip",
)
HEADPHONE_KEYS = (
    "airpod", "air pod", "buds", "beats", "solo", "fit pro", "studio",
    "btudio", "headphone", "headset", "earbud",
)


def req(method: str, url: str, data=None, token: str | None = None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if data is None else json.dumps(data).encode()
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp:
        raw = resp.read().decode() or "null"
        return json.loads(raw)


def classify(name: str) -> str:
    n = (name or "").lower()
    if any(k in n for k in SPEAKER_KEYS):
        return "electronics-speakers"
    # Real Apple watches (not AirPods mislabeled with Apple + Smart Watch)
    if re.search(r"\bair\s*pods?\b|\bairpods\b", n):
        return "electronics-headphones"
    if any(k in n for k in HEADPHONE_KEYS):
        return "electronics-headphones"
    if "watch" in n or "ultra" in n:
        return "electronics-smart-watches"
    return "electronics-headphones"


def clean_name(name: str, leaf: str) -> str:
    n = (name or "").strip()
    if leaf == "electronics-smart-watches":
        n = re.sub(r"\bSmart\s+Watch\b", "Watch", n, flags=re.I)
    else:
        n = re.sub(r"\s*Smart\s+Watch\s*", " ", n, flags=re.I)
    # Drop trailing wholesale numeric ids (e.g. "267519")
    n = re.sub(r"\s+\d{5,}\s*$", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    # Small typo fixes seen in this batch
    n = re.sub(r"\bBtudio\b", "Studio", n, flags=re.I)
    n = re.sub(r"\bMashall\b", "Marshall", n, flags=re.I)
    n = re.sub(r"\bAir Pods\b", "AirPods", n, flags=re.I)
    return n or name


def ensure_category(api: str, token: str, payload: dict, by_slug: dict, apply: bool):
    slug = payload["slug"]
    existing = by_slug.get(slug)
    if existing:
        # Patch hierarchy fields if missing / wrong
        need = any(
            (existing.get(k) or "") != (payload.get(k) or "")
            for k in ("section", "section_slug", "parent", "parent_name", "name", "description")
        )
        if need and apply:
            updated = req(
                "PUT",
                f"{api}/api/categories/{existing['id']}",
                {
                    "name": payload["name"],
                    "description": payload.get("description") or existing.get("description") or "",
                    "image": existing.get("image") or payload.get("image") or "",
                    "slug": slug,
                    "section": payload.get("section") or "",
                    "section_slug": payload.get("section_slug") or "",
                    "parent": payload.get("parent") or "",
                    "parent_name": payload.get("parent_name") or "",
                },
                token=token,
            )
            by_slug[slug] = updated
            print(f"  updated category {slug}")
        else:
            print(f"  exists {slug}" + (" (would update hierarchy)" if need else ""))
        return by_slug[slug]

    print(f"  create {slug}: {payload['name']}")
    if not apply:
        return payload
    created = req("POST", f"{api}/api/categories", payload, token=token)
    by_slug[slug] = created
    return created


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default=DEFAULT_API)
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()
    api = args.api.rstrip("/")

    login = req("POST", f"{api}/api/auth/login", {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    token = login.get("access_token") or login.get("token")
    if not token:
        sys.exit("Login failed")

    cats = req("GET", f"{api}/api/categories/with-counts", token=token)
    by_slug = {c["slug"]: c for c in cats if c.get("slug")}

    print("=== Categories ===")
    ensure_category(api, token, SECTION, by_slug, args.apply)
    for leaf in LEAVES:
        payload = {
            **leaf,
            "image": "",
            "section": "All Electronics",
            "section_slug": "electronics",
            "parent": "electronics",
            "parent_name": "All Electronics",
        }
        ensure_category(api, token, payload, by_slug, args.apply)

    # Collect candidates: smart-watch + any product whose name looks electronic
    # but is still under accessories / watches incorrectly.
    candidates = []
    seen = set()

    def add_batch(items):
        for prod in items:
            pid = prod.get("id")
            if not pid or pid in seen:
                continue
            seen.add(pid)
            cat = (prod.get("category") or "").lower()
            if cat.startswith("electronics"):
                continue
            name = prod.get("name") or ""
            if cat in ("smart-watch", "smartwatch") or classify(name):
                if cat in ("smart-watch", "smartwatch") or any(
                    k in name.lower()
                    for k in list(SPEAKER_KEYS) + list(HEADPHONE_KEYS) + ["smart watch", "airpod"]
                ):
                    # Avoid pulling luxury watch brands into electronics
                    if cat.startswith("watches-") or cat == "watches":
                        continue
                    candidates.append(prod)

    try:
        add_batch(req("GET", f"{api}/api/products?category=smart-watch&limit=0", token=token))
    except urllib.error.HTTPError:
        pass

    # Also scan accessories leaves for stragglers
    for slug, cat in list(by_slug.items()):
        if (cat.get("section_slug") or "") != "accessories":
            continue
        if slug in ("smart-watch", "accessories"):
            continue
        try:
            batch = req(
                "GET",
                f"{api}/api/products?category={urllib.parse.quote(slug)}&limit=0",
                token=token,
            )
        except urllib.error.HTTPError:
            continue
        add_batch(batch)

    moves = []
    for prod in candidates:
        leaf = classify(prod.get("name") or "")
        new_name = clean_name(prod.get("name") or "", leaf)
        moves.append({
            "id": prod["id"],
            "old_cat": prod.get("category"),
            "new_cat": leaf,
            "old_name": prod.get("name"),
            "new_name": new_name,
            "price": prod.get("price"),
        })

    from collections import Counter
    print(f"\n=== Products to move: {len(moves)} ===")
    print("By leaf:", dict(Counter(m["new_cat"] for m in moves)))
    for m in moves[:12]:
        print(f"  [{m['old_cat']}] {m['old_name'][:50]}")
        print(f"    -> [{m['new_cat']}] {m['new_name'][:50]}")
    if len(moves) > 12:
        print(f"  ... +{len(moves) - 12} more")

    if not args.apply:
        print("\nDry run only. Pass --apply to write.")
        return

    ok = 0
    for m in moves:
        payload = {"category": m["new_cat"]}
        if m["new_name"] and m["new_name"] != m["old_name"]:
            payload["name"] = m["new_name"]
        # Tag for storefront filters
        payload["tags"] = ["electronics", m["new_cat"].replace("electronics-", "")]
        try:
            req("PUT", f"{api}/api/products/{m['id']}", payload, token=token)
            ok += 1
        except Exception as e:
            print("FAIL", m["id"], e)
    print(f"Moved/updated {ok}/{len(moves)} products")

    # Delete empty legacy smart-watch category under accessories
    legacy = by_slug.get("smart-watch")
    if legacy:
        left = req("GET", f"{api}/api/products?category=smart-watch&limit=0", token=token)
        if not left:
            try:
                req("DELETE", f"{api}/api/categories/{legacy['id']}", token=token)
                print("Deleted empty legacy category smart-watch")
            except Exception as e:
                print("Could not delete smart-watch category:", e)
        else:
            print(f"Left {len(left)} products in smart-watch — not deleting category")


if __name__ == "__main__":
    main()
