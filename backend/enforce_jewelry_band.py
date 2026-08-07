#!/usr/bin/env python3
"""Clamp jewelry products into the $190–$470 price band via the admin API.

Items below $190 get a deterministic in-band price (not all $190).
Items above $470 are capped at $470.

Usage:
  python enforce_jewelry_band.py                  # dry run against production
  python enforce_jewelry_band.py --apply          # write prices
  python enforce_jewelry_band.py --api http://localhost:8001 --apply
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_API = "https://api.kayee01.com"
FLOOR = 190.0
CEILING = 470.0
ADMIN_EMAIL = "kayicom509@gmail.com"
ADMIN_PASSWORD = "Admin123!"

JEWELRY_CAT_ROOTS = (
    "jewelry",
    "necklace",
    "bracelet",
    "earrings",
    "earring",
    "ring",
    "brooch",
    "pendant",
)


def req(method: str, url: str, data=None, token: str | None = None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if data is None else json.dumps(data).encode()
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.loads(resp.read().decode() or "null")


def is_jewelry(prod: dict) -> bool:
    cat = str(prod.get("category") or "").strip().lower()
    section = str(prod.get("section") or prod.get("type_name") or "").strip().lower()
    for root in JEWELRY_CAT_ROOTS:
        if cat == root or cat.startswith(f"{root}-"):
            return True
    if "jewelry" in section or section in {
        "necklace", "bracelet", "earrings", "earring", "ring", "brooch", "other jewelry",
    }:
        return True
    return False


def band_price(prod: dict, floor: float = FLOOR, ceiling: float = CEILING) -> float:
    lo, hi = int(floor), int(ceiling)
    seed = prod.get("id") or prod.get("source_id") or prod.get("name") or "x"
    h = int(hashlib.sha256(str(seed).encode("utf-8")).hexdigest(), 16)
    whole = lo + (h % (hi - lo + 1))
    price = float(f"{whole - 1}.99") if whole - 1 >= lo else float(f"{whole}.99")
    return round(min(max(price, floor), ceiling), 2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default=DEFAULT_API)
    p.add_argument("--apply", action="store_true")
    p.add_argument("--floor", type=float, default=FLOOR)
    p.add_argument("--ceiling", type=float, default=CEILING)
    p.add_argument("--workers", type=int, default=12)
    args = p.parse_args()
    api = args.api.rstrip("/")
    floor = float(args.floor)
    ceiling = float(max(args.ceiling, floor))

    login = req("POST", f"{api}/api/auth/login", {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    token = login.get("access_token") or login.get("token")
    if not token:
        sys.exit("Login failed")

    try:
        path = (
            f"/api/products/maintenance/jewelry-price-band"
            f"?apply={'true' if args.apply else 'false'}"
            f"&floor={floor}&ceiling={ceiling}"
        )
        out = req("POST", f"{api}{path}", {}, token=token)
        print(json.dumps(out, indent=2))
        return
    except urllib.error.HTTPError as e:
        if e.code not in (404, 405):
            raise
        print("Maintenance endpoint not deployed yet — falling back to per-product updates.")

    cats = req("GET", f"{api}/api/categories/with-counts", token=token)
    jew_slugs = [
        c["slug"] for c in cats
        if is_jewelry({"category": c.get("slug"), "section": c.get("section")})
    ]

    under = []
    seen = set()
    for slug in jew_slugs:
        try:
            batch = req(
                "GET",
                f"{api}/api/products?category={urllib.parse.quote(slug)}&limit=0",
                token=token,
            )
        except urllib.error.HTTPError:
            continue
        for prod in batch:
            pid = prod.get("id")
            if not pid or pid in seen:
                continue
            seen.add(pid)
            if not is_jewelry(prod):
                continue
            price = float(prod.get("price") or 0)
            if price < floor:
                under.append({**prod, "_new": band_price(prod, floor, ceiling)})
            elif price > ceiling:
                under.append({**prod, "_new": ceiling})

    print(f"Jewelry outside ${floor:g}–${ceiling:g}: {len(under)}")
    for prod in under[:10]:
        print(f"  {prod.get('price'):>8} -> {prod['_new']:<8g}  {prod.get('name')}")

    if not args.apply:
        print("Dry run only. Pass --apply to write.")
        return

    ok = 0
    fail = 0

    def one(prod):
        req("PUT", f"{api}/api/products/{prod['id']}", {"price": prod["_new"]}, token=token)
        return prod["id"]

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = [pool.submit(one, prod) for prod in under]
        for fut in concurrent.futures.as_completed(futures):
            try:
                fut.result()
                ok += 1
                if ok % 100 == 0:
                    print(f"  … {ok}/{len(under)}")
            except Exception as e:
                fail += 1
                print("FAIL", e)

    print(f"Updated {ok}/{len(under)} jewelry prices (failed={fail})")


if __name__ == "__main__":
    main()
