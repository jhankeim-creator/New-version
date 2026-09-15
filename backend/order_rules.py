"""Purchase rules: category price floors, checkout validation, and display sales counts."""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional, Tuple

SHOES_MIN_PRICE = 250.0
WATCHES_MIN_PRICE = 450.0
JEWELRY_MIN_PRICE = 190.0
JEWELRY_MAX_PRICE = 470.0

WATCH_JEWELRY_SOLD_MIN = 5
WATCH_JEWELRY_SOLD_MAX = 70
BAGS_SOLD_MIN = 10
BAGS_SOLD_MAX = 50

_JEWELRY_CAT_ROOTS = (
    "jewelry",
    "necklace",
    "bracelet",
    "earrings",
    "earring",
    "ring",
    "brooch",
    "pendant",
)
_JEWELRY_SECTIONS = {
    "all jewelry",
    "jewelry",
    "necklace",
    "bracelet",
    "earrings",
    "earring",
    "ring",
    "brooch",
    "other jewelry",
    "jewelry-other",
}


def _tags_blob(product: dict) -> str:
    tags = product.get("tags") or []
    if isinstance(tags, list):
        return " ".join(str(t) for t in tags).lower()
    return str(tags).lower()


def _deterministic_int(seed: str, lo: int, hi: int) -> int:
    h = int(hashlib.sha256(str(seed).encode("utf-8")).hexdigest(), 16)
    return lo + (h % (hi - lo + 1))


def is_shoe_product(product: dict) -> bool:
    cat = str(product.get("category") or "").strip().lower()
    section = str(product.get("section") or product.get("type_name") or "").strip().lower()
    if cat == "shoes" or cat.startswith("shoes-") or cat.startswith("shoe-"):
        return True
    if section in ("shoes", "shoe"):
        return True
    blob = _tags_blob(product)
    return "shoe" in blob or "sneaker" in blob


def is_watch_product(product: dict) -> bool:
    cat = str(product.get("category") or "").strip().lower()
    section = str(product.get("section") or product.get("type_name") or "").strip().lower()
    if cat.startswith("electronics") or section in ("electronics", "all electronics"):
        return False
    if cat in ("smart-watch", "smartwatch"):
        return False
    if cat in ("watches", "watch"):
        return True
    if cat.startswith("watches-") or cat.startswith("watch-"):
        return True
    if section in ("watches", "watch", "all watches"):
        return True
    blob = _tags_blob(product)
    return "watch" in blob and "smart" not in blob


def is_jewelry_product(product: dict) -> bool:
    cat = str(product.get("category") or "").strip().lower()
    section = str(product.get("section") or product.get("type_name") or "").strip().lower()
    for root in _JEWELRY_CAT_ROOTS:
        if cat == root or cat.startswith(f"{root}-"):
            return True
    if section in _JEWELRY_SECTIONS or "jewelry" in section:
        return True
    blob = _tags_blob(product)
    return any(k in blob for k in ("jewelry", "necklace", "bracelet", "earring", "brooch"))


def is_bag_product(product: dict) -> bool:
    cat = str(product.get("category") or "").strip().lower()
    section = str(product.get("section") or product.get("type_name") or "").strip().lower()
    if cat in ("bags", "bag") or cat.startswith("bags-") or cat.startswith("bag-"):
        return True
    if section in ("bags", "bag", "all bags"):
        return True
    blob = _tags_blob(product)
    return "bag" in blob or "luggage" in blob


def display_sales_count(product: dict) -> int:
    """Deterministic storefront 'already sold' count for social proof."""
    seed = product.get("id") or product.get("source_id") or product.get("name") or "x"
    if is_bag_product(product):
        return _deterministic_int(seed, BAGS_SOLD_MIN, BAGS_SOLD_MAX)
    if is_watch_product(product) or is_jewelry_product(product):
        return _deterministic_int(seed, WATCH_JEWELRY_SOLD_MIN, WATCH_JEWELRY_SOLD_MAX)
    return 0


def apply_category_price_floors(product: dict) -> bool:
    """Raise/clamp prices to category minimums. Returns True if price changed."""
    try:
        price = float(product.get("price") or 0)
    except (TypeError, ValueError):
        price = 0.0

    if is_shoe_product(product) and price < SHOES_MIN_PRICE:
        product["price"] = float(SHOES_MIN_PRICE)
        return True
    if is_watch_product(product) and price < WATCHES_MIN_PRICE:
        product["price"] = float(WATCHES_MIN_PRICE)
        return True
    if is_jewelry_product(product):
        if price < JEWELRY_MIN_PRICE:
            product["price"] = float(JEWELRY_MIN_PRICE)
            return True
        if price > JEWELRY_MAX_PRICE:
            product["price"] = float(JEWELRY_MAX_PRICE)
            return True
    return False


def variant_price_delta(product: dict, variant: Optional[dict]) -> float:
    """Sum optional per-value price adjustments for the selected variant axes."""
    if not variant or not isinstance(variant, dict):
        return 0.0
    variants = product.get("variants") or []
    if not isinstance(variants, list):
        return 0.0

    delta = 0.0
    for axis in variants:
        if not isinstance(axis, dict):
            continue
        name = str(axis.get("name") or "").strip()
        if not name:
            continue
        selected = variant.get(name)
        if selected is None:
            continue
        prices = axis.get("prices") or {}
        if not isinstance(prices, dict):
            continue
        try:
            adj = float(prices.get(selected, 0) or 0)
        except (TypeError, ValueError):
            adj = 0.0
        delta += adj
    return delta


def effective_unit_price(product: dict, variant: Optional[dict] = None) -> float:
    """Server-side unit price including variant adjustments and category floors."""
    try:
        base = float(product.get("price") or 0)
    except (TypeError, ValueError):
        base = 0.0
    merged = {**product, "price": base + variant_price_delta(product, variant)}
    apply_category_price_floors(merged)
    return float(merged.get("price") or 0)


def is_purchasable(product: dict, variant: Optional[dict] = None) -> bool:
    return effective_unit_price(product, variant) > 0 and int(product.get("stock") or 0) > 0


def enrich_product_purchase_fields(product: dict) -> dict:
    """Attach storefront display fields for API responses."""
    product["display_sales_count"] = display_sales_count(product)
    product["purchasable"] = is_purchasable(product)
    return product


def validate_line_item(
    product: dict,
    quantity: int,
    client_price: float,
    variant: Optional[dict] = None,
) -> Tuple[float, List[str]]:
    """Validate one cart line. Returns (server_unit_price, errors)."""
    errors: List[str] = []
    name = str(product.get("name") or "Product")

    unit_price = effective_unit_price(product, variant)
    if unit_price <= 0:
        errors.append(f"{name} is not available for purchase yet (invalid price).")
        return unit_price, errors

    if quantity <= 0:
        errors.append(f"Invalid quantity for {name}.")
        return unit_price, errors

    stock = int(product.get("stock") or 0)
    if quantity > stock:
        errors.append(f"Insufficient stock for {name}.")

    if abs(float(client_price) - unit_price) > 0.02:
        errors.append(f"Price mismatch for {name}. Please refresh and try again.")

    return unit_price, errors


def compute_items_subtotal(validated_items: List[Dict[str, Any]]) -> float:
    return sum(float(item["price"]) * int(item["quantity"]) for item in validated_items)
