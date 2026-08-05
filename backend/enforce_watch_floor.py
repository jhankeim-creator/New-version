#!/usr/bin/env python3
"""Raise all watch products below $450 to the $450 floor via the admin API.

Usage:
  python enforce_watch_floor.py                  # dry run against production
  python enforce_watch_floor.py --apply          # write prices
  python enforce_watch_floor.py --api http://localhost:8001 --apply
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_API = "https://api.kayee01.com"
FLOOR = 450.0
ADMIN_EMAIL = "kayicom509@gmail.com"
ADMIN_PASSWORD = "Admin123!"


def req(method: str, url: str, data=None, token: str | None = None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if data is None else json.dumps(data).encode()
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.loads(resp.read().decode() or "null")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default=DEFAULT_API)
    p.add_argument("--apply", action="store_true")
    p.add_argument("--floor", type=float, default=FLOOR)
    args = p.parse_args()
    api = args.api.rstrip("/")
    floor = float(args.floor)

    login = req("POST", f"{api}/api/auth/login", {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    token = login.get("access_token") or login.get("token")
    if not token:
        sys.exit("Login failed")

    try:
        path = (
            f"/api/products/maintenance/watch-price-floor"
            f"?apply={'true' if args.apply else 'false'}&floor={floor}"
        )
        out = req("POST", f"{api}{path}", {}, token=token)
        print(json.dumps(out, indent=2))
        return
    except urllib.error.HTTPError as e:
        if e.code not in (404, 405):
            raise
        print("Maintenance endpoint not deployed yet — falling back to per-product updates.")

    cats = req("GET", f"{api}/api/categories/with-counts", token=token)
    watch_slugs = [
        c["slug"] for c in cats
        if "watch" in (c.get("slug") or "").lower()
    ]

    under = []
    seen = set()
    for slug in watch_slugs:
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
            price = float(prod.get("price") or 0)
            if price < floor:
                under.append(prod)

    print(f"Watches under ${floor:g}: {len(under)}")
    for prod in under[:10]:
        print(f"  {prod.get('price'):>8} -> {floor:g}  {prod.get('name')}")

    if not args.apply:
        print("Dry run only. Pass --apply to write.")
        return

    ok = 0
    for prod in under:
        try:
            req("PUT", f"{api}/api/products/{prod['id']}", {"price": floor}, token=token)
            ok += 1
        except Exception as e:
            print("FAIL", prod.get("id"), e)
    print(f"Updated {ok}/{len(under)} watch prices to ${floor:g}+")


if __name__ == "__main__":
    main()
