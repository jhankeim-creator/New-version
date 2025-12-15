"""
Admin routes for Ecwid-like admin dashboard features
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from models import (
    ProductExtended, ProductExtendedCreate, ProductExtendedUpdate,
    ProductVariation, ProductVariationCreate,
    Coupon, CouponCreate, CouponValidation,
    Customer, CustomerCreate, CustomerUpdate,
    StoreSettings, StoreSettingsUpdate,
    DashboardStats, OrderUpdate, OrderNote,
    BulkProductUpdate, BulkPriceUpdate, BulkStockUpdate
)

# Import authentication dependencies from server.py
import sys
# Ensure this directory is importable regardless of container layout
THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.append(str(THIS_DIR))
from server import User, get_current_admin

# Create router
admin_router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    # Protect ALL admin endpoints by default
    dependencies=[Depends(get_current_admin)],
)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'kayee01_db')]


# ==================== DASHBOARD STATISTICS ====================

@admin_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get dashboard statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    
    # Today's stats
    today_orders = await db.orders.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    today_sales_result = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    today_sales = today_sales_result[0]["total"] if today_sales_result else 0.0
    
    # Week's stats
    week_orders = await db.orders.count_documents({
        "created_at": {"$gte": week_start.isoformat()}
    })
    week_sales_result = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": week_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    week_sales = week_sales_result[0]["total"] if week_sales_result else 0.0
    
    # Month's stats
    month_orders = await db.orders.count_documents({
        "created_at": {"$gte": month_start.isoformat()}
    })
    month_sales_result = await db.orders.aggregate([
        {"$match": {"created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    month_sales = month_sales_result[0]["total"] if month_sales_result else 0.0
    
    # Total stats
    total_orders = await db.orders.count_documents({})
    total_sales_result = await db.orders.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    total_sales = total_sales_result[0]["total"] if total_sales_result else 0.0
    
    # Customers
    total_customers = await db.customers.count_documents({})
    
    # Low stock products
    settings = await db.store_settings.find_one({"id": "store_settings"}, {"_id": 0})
    low_stock_threshold = settings.get("low_stock_threshold", 5) if settings else 5
    low_stock_products = await db.products.count_documents({
        "stock": {"$lte": low_stock_threshold}
    })
    
    # Pending orders
    pending_orders = await db.orders.count_documents({"status": "pending"})
    
    # Top products (by sales count)
    top_products = await db.products.find({}, {"_id": 0}).sort("sales_count", -1).limit(5).to_list(5)
    
    # Recent orders
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    # Sales chart data (last 7 days)
    sales_chart = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_sales_result = await db.orders.aggregate([
            {"$match": {
                "created_at": {
                    "$gte": day_start.isoformat(),
                    "$lt": day_end.isoformat()
                }
            }},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]).to_list(1)
        day_sales = day_sales_result[0]["total"] if day_sales_result else 0.0
        sales_chart.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "sales": day_sales
        })
    
    return DashboardStats(
        today_sales=today_sales,
        today_orders=today_orders,
        week_sales=week_sales,
        week_orders=week_orders,
        month_sales=month_sales,
        month_orders=month_orders,
        total_sales=total_sales,
        total_orders=total_orders,
        total_customers=total_customers,
        low_stock_products=low_stock_products,
        pending_orders=pending_orders,
        top_products=top_products,
        recent_orders=recent_orders,
        sales_chart=sales_chart
    )


# ==================== PRODUCT VARIATIONS ====================

@admin_router.post("/products/{product_id}/variations", response_model=ProductVariation)
async def create_product_variation(product_id: str, variation: ProductVariationCreate):
    """Create a product variation"""
    variation_data = variation.model_dump()
    variation_data["id"] = str(uuid.uuid4())
    variation_data["product_id"] = product_id
    variation_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.product_variations.insert_one(variation_data)
    
    # Update product variations count
    variations_count = await db.product_variations.count_documents({"product_id": product_id})
    await db.products.update_one(
        {"id": product_id},
        {"$set": {
            "has_variations": True,
            "variations_count": variations_count
        }}
    )
    
    return ProductVariation(**variation_data)


@admin_router.get("/products/{product_id}/variations", response_model=List[ProductVariation])
async def get_product_variations(product_id: str):
    """Get all variations for a product"""
    variations = await db.product_variations.find(
        {"product_id": product_id},
        {"_id": 0}
    ).to_list(None)
    return [ProductVariation(**v) for v in variations]


@admin_router.delete("/products/{product_id}/variations/{variation_id}")
async def delete_product_variation(product_id: str, variation_id: str):
    """Delete a product variation"""
    result = await db.product_variations.delete_one({"id": variation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Variation not found")
    
    # Update product variations count
    variations_count = await db.product_variations.count_documents({"product_id": product_id})
    await db.products.update_one(
        {"id": product_id},
        {"$set": {
            "has_variations": variations_count > 0,
            "variations_count": variations_count
        }}
    )
    
    return {"message": "Variation deleted"}


# ==================== COUPONS ====================

@admin_router.post("/coupons", response_model=Coupon)
async def create_coupon(coupon: CouponCreate):
    """Create a new coupon/promo code"""
    # Check if code already exists
    existing = await db.coupons.find_one({"code": coupon.code.upper()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    
    coupon_data = coupon.model_dump()
    coupon_data["id"] = str(uuid.uuid4())
    coupon_data["code"] = coupon_data["code"].upper()
    coupon_data["uses_count"] = 0
    coupon_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    if coupon_data.get("valid_from"):
        coupon_data["valid_from"] = coupon_data["valid_from"].isoformat()
    else:
        coupon_data["valid_from"] = datetime.now(timezone.utc).isoformat()
    
    if coupon_data.get("valid_until"):
        coupon_data["valid_until"] = coupon_data["valid_until"].isoformat()
    
    await db.coupons.insert_one(coupon_data)
    return Coupon(**coupon_data)


@admin_router.get("/coupons", response_model=List[Coupon])
async def get_coupons():
    """Get all coupons"""
    coupons = await db.coupons.find({}, {"_id": 0}).to_list(None)
    return [Coupon(**c) for c in coupons]


@admin_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str):
    """Delete a coupon"""
    result = await db.coupons.delete_one({"id": coupon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deleted"}


@admin_router.post("/coupons/validate")
async def validate_coupon(code: str, cart_total: float, cart_items: List[Dict] = []):
    """Validate a coupon code and calculate discount"""
    coupon = await db.coupons.find_one({"code": code.upper()}, {"_id": 0})
    
    if not coupon:
        return CouponValidation(valid=False, message="Invalid coupon code")
    
    if not coupon.get("active"):
        return CouponValidation(valid=False, message="Coupon is inactive")
    
    # Check dates
    now = datetime.now(timezone.utc)
    valid_from = datetime.fromisoformat(coupon["valid_from"]) if isinstance(coupon["valid_from"], str) else coupon["valid_from"]
    
    if now < valid_from:
        return CouponValidation(valid=False, message="Coupon not yet valid")
    
    if coupon.get("valid_until"):
        valid_until = datetime.fromisoformat(coupon["valid_until"]) if isinstance(coupon["valid_until"], str) else coupon["valid_until"]
        if now > valid_until:
            return CouponValidation(valid=False, message="Coupon has expired")
    
    # Check minimum purchase
    if cart_total < coupon.get("minimum_purchase", 0):
        return CouponValidation(
            valid=False,
            message=f"Minimum purchase of ${coupon['minimum_purchase']} required"
        )
    
    # Check max uses
    if coupon.get("max_uses") and coupon.get("uses_count", 0) >= coupon["max_uses"]:
        return CouponValidation(valid=False, message="Coupon usage limit reached")
    
    # Calculate discount
    discount_amount = 0.0
    if coupon["discount_type"] == "percentage":
        discount_amount = cart_total * (coupon["discount_value"] / 100)
    else:  # fixed
        discount_amount = coupon["discount_value"]
    
    # Ensure discount doesn't exceed cart total
    discount_amount = min(discount_amount, cart_total)
    
    return CouponValidation(
        valid=True,
        discount_amount=discount_amount,
        message=f"Coupon applied! ${discount_amount:.2f} discount"
    )


# ==================== CUSTOMERS (CRM) ====================

@admin_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    """Create a new customer"""
    # Check if email already exists
    existing = await db.customers.find_one({"email": customer.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Customer email already exists")
    
    customer_data = customer.model_dump()
    customer_data["id"] = str(uuid.uuid4())
    customer_data["total_orders"] = 0
    customer_data["total_spent"] = 0.0
    customer_data["addresses"] = []
    customer_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.customers.insert_one(customer_data)
    return Customer(**customer_data)


@admin_router.get("/customers", response_model=List[Customer])
async def get_customers(
    skip: int = 0,
    limit: int = 50,
    group: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all customers with filters"""
    query = {}
    if group:
        query["customer_group"] = group
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    customers = await db.customers.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return [Customer(**c) for c in customers]


@admin_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    """Get customer by ID"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**customer)


@admin_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, updates: CustomerUpdate):
    """Update customer details"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.customers.update_one(
        {"id": customer_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return Customer(**customer)


@admin_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer"""
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}


@admin_router.get("/customers/{customer_id}/orders")
async def get_customer_orders(customer_id: str):
    """Get all orders for a customer"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    orders = await db.orders.find(
        {"user_email": customer["email"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    
    return orders


# ==================== STORE SETTINGS ====================

@admin_router.get("/settings", response_model=StoreSettings)
async def get_store_settings():
    """Get store settings"""
    settings = await db.store_settings.find_one({"id": "store_settings"}, {"_id": 0})
    if not settings:
        # Create default settings
        default_settings = StoreSettings().model_dump()
        await db.store_settings.insert_one(default_settings)
        return StoreSettings(**default_settings)
    return StoreSettings(**settings)


@admin_router.put("/settings", response_model=StoreSettings)
async def update_store_settings(updates: StoreSettingsUpdate):
    """Update store settings"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.store_settings.update_one(
        {"id": "store_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.store_settings.find_one({"id": "store_settings"}, {"_id": 0})
    return StoreSettings(**settings)


# ==================== ADVANCED ORDER MANAGEMENT ====================

@admin_router.get("/orders/filters")
async def get_filtered_orders(
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get orders with advanced filters"""
    query = {}
    
    if status:
        query["status"] = status
    if payment_status:
        query["payment_status"] = payment_status
    if payment_method:
        query["payment_method"] = payment_method
    if date_from:
        query.setdefault("created_at", {})["$gte"] = date_from
    if date_to:
        query.setdefault("created_at", {})["$lte"] = date_to
    if min_amount is not None:
        query.setdefault("total", {})["$gte"] = min_amount
    if max_amount is not None:
        query.setdefault("total", {})["$lte"] = max_amount
    if search:
        query["$or"] = [
            {"order_number": {"$regex": search, "$options": "i"}},
            {"user_email": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}}
        ]
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total_count = await db.orders.count_documents(query)
    
    return {
        "orders": orders,
        "total": total_count,
        "page": skip // limit + 1 if limit > 0 else 1,
        "pages": (total_count + limit - 1) // limit if limit > 0 else 1
    }


@admin_router.put("/orders/{order_id}", response_model=dict)
async def update_order(order_id: str, updates: OrderUpdate):
    """Update order details"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return order


@admin_router.post("/orders/{order_id}/notes")
async def add_order_note(order_id: str, author: str, note: str):
    """Add an internal note to an order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    note_data = OrderNote(author=author, note=note).model_dump()
    note_data["created_at"] = note_data["created_at"].isoformat()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$push": {"internal_notes": note_data}}
    )
    
    return {"message": "Note added", "note": note_data}


# ==================== BULK OPERATIONS ====================

@admin_router.post("/products/bulk/update")
async def bulk_update_products(bulk_update: BulkProductUpdate):
    """Bulk update multiple products"""
    result = await db.products.update_many(
        {"id": {"$in": bulk_update.product_ids}},
        {"$set": bulk_update.updates}
    )
    
    return {
        "message": f"Updated {result.modified_count} products",
        "modified_count": result.modified_count
    }


@admin_router.post("/products/bulk/price")
async def bulk_update_prices(bulk_update: BulkPriceUpdate):
    """Bulk update product prices"""
    products = await db.products.find(
        {"id": {"$in": bulk_update.product_ids}},
        {"_id": 0, "id": 1, "price": 1}
    ).to_list(None)
    
    for product in products:
        new_price = product["price"]
        
        if bulk_update.operation == "add":
            new_price += bulk_update.value
        elif bulk_update.operation == "subtract":
            new_price -= bulk_update.value
        elif bulk_update.operation == "multiply":
            new_price *= bulk_update.value
        elif bulk_update.operation == "set":
            new_price = bulk_update.value
        
        new_price = max(0, new_price)  # Ensure non-negative
        
        await db.products.update_one(
            {"id": product["id"]},
            {"$set": {"price": new_price}}
        )
    
    return {
        "message": f"Updated prices for {len(products)} products",
        "count": len(products)
    }


@admin_router.post("/products/bulk/stock")
async def bulk_update_stock(bulk_update: BulkStockUpdate):
    """Bulk update product stock"""
    products = await db.products.find(
        {"id": {"$in": bulk_update.product_ids}},
        {"_id": 0, "id": 1, "stock": 1}
    ).to_list(None)
    
    for product in products:
        new_stock = product["stock"]
        
        if bulk_update.operation == "add":
            new_stock += bulk_update.value
        elif bulk_update.operation == "subtract":
            new_stock -= bulk_update.value
        elif bulk_update.operation == "set":
            new_stock = bulk_update.value
        
        new_stock = max(0, new_stock)  # Ensure non-negative
        
        await db.products.update_one(
            {"id": product["id"]},
            {"$set": {"stock": new_stock}}
        )
    
    return {
        "message": f"Updated stock for {len(products)} products",
        "count": len(products)
    }


import uuid


# ==================== API SETTINGS ====================

@admin_router.get("/api-settings")
async def get_api_settings(admin: User = Depends(get_current_admin)):
    """Get current API settings (keys are masked)"""
    settings = await db.api_settings.find_one({"_id": "global"})
    
    # Define allowed fields (NO SMTP fields)
    allowed_fields = {
        "resend_api_key": "",
        "stripe_secret_key": "",
        "stripe_publishable_key": "",
        "plisio_api_key": "",
        "paypal_client_id": "",
        "paypal_client_secret": "",
        "paypal_mode": "sandbox",
        "coinpal_api_key": "",
        "coinpal_api_secret": "",
        "coinpal_webhook_secret": "",
        "binance_pay_api_key": "",
        "binance_pay_api_secret": "",
        "from_email": "",
        "from_name": "Kayee01"
    }
    
    if not settings:
        # Return default empty settings
        return allowed_fields
    
    # Filter out any SMTP fields and return only allowed fields
    filtered_settings = {}
    for field in allowed_fields:
        filtered_settings[field] = settings.get(field, allowed_fields[field])
    
    return filtered_settings


@admin_router.post("/api-settings")
async def update_api_settings(settings: dict, admin: User = Depends(get_current_admin)):
    """Update API settings"""
    try:
        # Define allowed fields (NO SMTP fields)
        allowed_fields = {
            "resend_api_key", "stripe_secret_key", "stripe_publishable_key", 
            "plisio_api_key",
            "paypal_client_id", "paypal_client_secret", "paypal_mode",
            "coinpal_api_key", "coinpal_api_secret", "coinpal_webhook_secret",
            "binance_pay_api_key", "binance_pay_api_secret",
            "from_email", "from_name"
        }
        
        # Filter incoming settings to only allowed fields
        filtered_settings = {k: v for k, v in settings.items() if k in allowed_fields}
        
        # Update in database (only allowed fields)
        await db.api_settings.update_one(
            {"_id": "global"},
            {"$set": filtered_settings},
            upsert=True
        )
        
        # Update environment variables (runtime only - not permanent)
        if filtered_settings.get("resend_api_key"):
            os.environ["RESEND_API_KEY"] = filtered_settings["resend_api_key"]
        if filtered_settings.get("stripe_secret_key"):
            os.environ["STRIPE_SECRET_KEY"] = filtered_settings["stripe_secret_key"]
        if filtered_settings.get("stripe_publishable_key"):
            os.environ["STRIPE_PUBLISHABLE_KEY"] = filtered_settings["stripe_publishable_key"]
        if filtered_settings.get("plisio_api_key"):
            os.environ["PLISIO_API_KEY"] = filtered_settings["plisio_api_key"]
        if filtered_settings.get("paypal_client_id"):
            os.environ["PAYPAL_CLIENT_ID"] = filtered_settings["paypal_client_id"]
        if filtered_settings.get("paypal_client_secret"):
            os.environ["PAYPAL_CLIENT_SECRET"] = filtered_settings["paypal_client_secret"]
        if filtered_settings.get("paypal_mode"):
            os.environ["PAYPAL_MODE"] = filtered_settings["paypal_mode"]
        if filtered_settings.get("coinpal_api_key"):
            os.environ["COINPAL_API_KEY"] = filtered_settings["coinpal_api_key"]
        if filtered_settings.get("coinpal_api_secret"):
            os.environ["COINPAL_API_SECRET"] = filtered_settings["coinpal_api_secret"]
        if filtered_settings.get("coinpal_webhook_secret"):
            os.environ["COINPAL_WEBHOOK_SECRET"] = filtered_settings["coinpal_webhook_secret"]
        if filtered_settings.get("binance_pay_api_key"):
            os.environ["BINANCE_PAY_API_KEY"] = filtered_settings["binance_pay_api_key"]
        if filtered_settings.get("binance_pay_api_secret"):
            os.environ["BINANCE_PAY_API_SECRET"] = filtered_settings["binance_pay_api_secret"]
        if filtered_settings.get("from_email"):
            os.environ["FROM_EMAIL"] = filtered_settings["from_email"]
        if filtered_settings.get("from_name"):
            os.environ["FROM_NAME"] = filtered_settings["from_name"]
        
        return {"message": "API settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

