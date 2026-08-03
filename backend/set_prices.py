"""
Assign sensible retail prices to products that are missing a real price.

Context
-------
The importers seed new products with ``price = 0`` so they can be priced by
hand. This script fills those in with a deterministic, per-type price that
respects a configurable price FLOOR (default $80), so no product is ever listed
below the floor. It is:

* Idempotent + deterministic  - the same product always gets the same price
  (hash of its id), so re-runs don't churn prices.
* Non-destructive             - only products whose price is *below the floor*
  are touched; products already priced at/above the floor are left untouched
  (so any prices you set in the admin panel survive).

Prices are keyed off the product ``section`` (e.g. necklace, bracelet, bags,
watches) with a per-type range, and formatted to end in ``.99`` to match the
rest of the catalogue.

USAGE
-----
Dry run (report only):

    export MONGO_URL="mongodb+srv://.../kayee01_db?..."   # or set DB_NAME too
    python set_prices.py

Apply the prices:

    python set_prices.py --apply

Options: ``--floor 80``  ``--only-zero`` (only price the price<=0 products).
"""

import argparse
import hashlib
import os
import sys

try:
    from pymongo import MongoClient
except Exception:  # pragma: no cover
    MongoClient = None

# (min, max) retail range per section/type. All mins are >= the floor; the
# floor is enforced again at the end so lowering ranges can never dip below it.
PRICE_RANGES = {
    "necklace": (85, 189),
    "bracelet": (80, 159),
    "earrings": (80, 139),
    "ring": (85, 169),
    "brooch": (80, 129),
    "jewelry-other": (80, 149),
    "jewelry": (80, 169),
    "bags": (129, 459),
    "shoes": (250, 459),
    "watches": (159, 649),
    "glasses": (79, 189),
    "belts": (79, 139),
    "hats": (79, 119),
    "perfume": (79, 159),
    "socks": (79, 99),
    "scarf": (85, 159),
    "clothing": (79, 219),
    "accessories": (79, 199),
}
DEFAULT_RANGE = (80, 179)


def price_for(product, floor):
    section = (product.get("section") or product.get("type_name") or "").strip().lower()
    lo, hi = PRICE_RANGES.get(section, DEFAULT_RANGE)
    lo = int(max(lo, floor))
    hi = int(max(hi, lo + 20))
    seed = (product.get("id") or product.get("source_id") or product.get("name") or "x")
    h = int(hashlib.sha256(str(seed).encode("utf-8")).hexdigest(), 16)
    whole = lo + (h % (hi - lo + 1))
    # Price ends in .99, but never dip below the floor (e.g. floor 80 -> 80.99).
    price = float(f"{whole - 1}.99") if whole - 1 >= floor else float(f"{whole}.99")
    return round(max(price, float(floor)), 2)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Price products below the floor.")
    parser.add_argument("--apply", action="store_true", help="Write prices (default: dry run).")
    parser.add_argument("--floor", type=float, default=80.0, help="Minimum price (default 80).")
    parser.add_argument("--only-zero", action="store_true",
                        help="Only price products with price <= 0 (skip 0<price<floor).")
    args = parser.parse_args(argv)

    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        sys.exit("MONGO_URL must be set.")
    if MongoClient is None:
        sys.exit("pymongo is required.")

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=20000)
    db_name = os.environ.get("DB_NAME")
    db = client[db_name] if db_name else client.get_default_database()

    query = {"price": {"$lte": 0}} if args.only_zero else {"price": {"$lt": args.floor}}
    products = list(db.products.find(query, {"_id": 0, "id": 1, "name": 1, "section": 1,
                                             "type_name": 1, "source_id": 1, "price": 1}))
    print(f"DB: {db.name} | products below floor (${args.floor:g}): {len(products)}")

    updates = []
    by_section = {}
    for p in products:
        new_price = price_for(p, args.floor)
        updates.append((p["id"], new_price))
        sec = (p.get("section") or p.get("type_name") or "?")
        by_section[sec] = by_section.get(sec, 0) + 1

    print("By section:", ", ".join(f"{k}={v}" for k, v in sorted(by_section.items())))
    for pid, price in updates[:10]:
        name = next((p["name"] for p in products if p["id"] == pid), pid)
        print(f"  {price:>8.2f}  {name}")
    if len(updates) > 10:
        print(f"  ... and {len(updates) - 10} more")

    if not args.apply:
        print("\nDry run - pass --apply to write these prices.")
        client.close()
        return

    n = 0
    for pid, price in updates:
        res = db.products.update_one({"id": pid}, {"$set": {"price": price, "on_sale": False}})
        n += res.modified_count
    print(f"\nUpdated prices for {n} products (floor ${args.floor:g}).")
    client.close()


if __name__ == "__main__":
    main()
