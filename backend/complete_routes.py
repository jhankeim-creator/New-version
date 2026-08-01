"""
Complete API routes for full e-commerce functionality
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import os
from datetime import datetime, timezone
import uuid
from pathlib import Path
import sys
from bson import Binary

# Import admin auth dependency from server.py (works in local + container layouts)
THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.append(str(THIS_DIR))
from server import User, get_current_admin

# Create router
complete_router = APIRouter(prefix="/api/v2", tags=["complete"])

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'kayee01_db')]

# Upload directory
UPLOAD_DIR = THIS_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ==================== HELPER FUNCTIONS ====================

def parse_from_mongo(item: dict) -> dict:
    """Convert ISO strings back to datetime objects and remove _id"""
    if '_id' in item:
        del item['_id']
    for key, value in item.items():
        if key in ['created_at'] and isinstance(value, str):
            item[key] = datetime.fromisoformat(value)
    return item

# ==================== MODELS ====================

class ReviewCreate(BaseModel):
    product_id: str
    user_name: str
    user_email: str
    rating: int
    comment: str
    images: List[str] = []

class ProductCreateV2(BaseModel):
    # Core
    name: str
    description: str
    price: float
    compare_at_price: Optional[float] = None
    stock: int = 0
    sku: Optional[str] = None

    # Categorization (v2 categories)
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None

    # Media
    images: List[str] = []
    videos: List[str] = []

    # Merchandising / SEO
    tags: List[str] = []
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    featured: bool = False
    on_sale: bool = False
    is_new: bool = False
    best_seller: bool = False

    # Variants
    has_variants: bool = False
    variants: List[dict] = []
    variant_options: List[dict] = []

    # Optional: auto topup products
    auto_topup: bool = False

# ==================== MEDIA UPLOAD ====================

@complete_router.post("/upload")
async def upload_file(file: UploadFile = File(...), admin: User = Depends(get_current_admin)):
    """Upload image or video"""
    # Validate file type
    allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    # Generate unique filename
    file_ext = Path(file.filename).suffix
    unique_name = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / unique_name
    
    # Read once, then save to disk (fast path) and MongoDB (durable path)
    contents = await file.read()
    with file_path.open("wb") as buffer:
        buffer.write(contents)
    
    # Persist the bytes in MongoDB so the file survives ephemeral-disk redeploys
    # (e.g. Render free tier). MongoDB documents are limited to 16MB; larger
    # files stay disk-only. Small images comfortably fit.
    MAX_DB_BYTES = 15 * 1024 * 1024
    if len(contents) <= MAX_DB_BYTES:
        await db.media_files.replace_one(
            {"filename": unique_name},
            {
                "filename": unique_name,
                "content_type": file.content_type,
                "data": Binary(contents),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            upsert=True,
        )
    
    # Save metadata to database
    media = {
        "id": str(uuid.uuid4()),
        "filename": unique_name,
        "original_name": file.filename,
        "url": f"/uploads/{unique_name}",
        "type": "image" if file.content_type.startswith("image") else "video",
        "size": len(contents),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.media.insert_one(media)
    
    return {"url": media["url"], "id": media["id"], "type": media["type"]}

@complete_router.get("/media")
async def get_media(admin: User = Depends(get_current_admin)):
    """Get all uploaded media"""
    media = await db.media.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return media

# ==================== CATEGORIES ====================

@complete_router.post("/categories")
async def create_category(name: str, description: str, parent_id: Optional[str] = None, image: Optional[str] = None, admin: User = Depends(get_current_admin)):
    """Create category or subcategory"""
    category_data = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": description,
        "parent_id": parent_id,
        "image": image,
        "slug": name.lower().replace(" ", "-"),
        "product_count": 0,
        "active": True,
        "display_order": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.categories.insert_one(category_data)
    return category_data

@complete_router.get("/categories")
async def get_categories(parent_id: Optional[str] = None):
    """Get categories"""
    query = {}
    if parent_id is not None:
        query["parent_id"] = parent_id
    
    categories = await db.categories.find(query, {"_id": 0}).sort("display_order", 1).to_list(None)
    return categories

@complete_router.get("/categories/tree")
async def get_categories_tree():
    """Get category tree"""
    parents = await db.categories.find({"parent_id": None}, {"_id": 0}).to_list(None)
    
    result = []
    for parent in parents:
        subcategories = await db.categories.find({"parent_id": parent["id"]}, {"_id": 0}).to_list(None)
        parent["subcategories"] = subcategories
        result.append(parent)
    
    return result

@complete_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: User = Depends(get_current_admin)):
    """Delete category"""
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Deleted"}

# ==================== REVIEWS ====================

@complete_router.post("/reviews")
async def create_review(review: ReviewCreate):
    """Create review"""
    review_data = {
        "id": str(uuid.uuid4()),
        "product_id": review.product_id,
        "user_name": review.user_name,
        "user_email": review.user_email,
        "rating": review.rating,
        "comment": review.comment,
        "images": review.images,
        "status": "pending",
        "helpful_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review_data)
    
    # Update product rating
    await update_product_rating(review.product_id)
    
    return parse_from_mongo(review_data)

@complete_router.get("/reviews/product/{product_id}")
async def get_product_reviews(product_id: str):
    """Get approved reviews for product"""
    reviews = await db.reviews.find(
        {"product_id": product_id, "status": "approved"},
        {"_id": 0}
    ).to_list(None)
    return reviews

@complete_router.get("/reviews/pending")
async def get_pending_reviews(admin: User = Depends(get_current_admin)):
    """Get pending reviews"""
    reviews = await db.reviews.find({"status": "pending"}, {"_id": 0}).to_list(None)
    return reviews

@complete_router.put("/reviews/{review_id}/status")
async def update_review_status(review_id: str, status: str, admin: User = Depends(get_current_admin)):
    """Update review status"""
    result = await db.reviews.update_one(
        {"id": review_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    await update_product_rating(review["product_id"])
    
    return {"message": "Updated"}

async def update_product_rating(product_id: str):
    """Update product rating"""
    reviews = await db.reviews.find(
        {"product_id": product_id, "status": "approved"},
        {"_id": 0, "rating": 1}
    ).to_list(None)
    
    if reviews:
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
        reviews_count = len(reviews)
    else:
        avg_rating = 0.0
        reviews_count = 0
    
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"rating": round(avg_rating, 1), "reviews_count": reviews_count}}
    )

# ==================== PRODUCTS (V2) ====================

@complete_router.post("/products")
async def create_product_v2(product: ProductCreateV2, admin: User = Depends(get_current_admin)):
    """
    Create a product using the V2 admin UI payload.

    This stores:
    - `category` as a readable slug (for existing /api/products filtering)
    - `category_id` / `subcategory_id` for the V2 category system
    """
    category_slug = None
    if product.category_id:
        cat = await db.categories.find_one({"id": product.category_id}, {"_id": 0})
        if cat:
            category_slug = cat.get("slug") or cat.get("name")

    now = datetime.now(timezone.utc).isoformat()
    product_doc = {
        "id": str(uuid.uuid4()),
        "name": product.name,
        "description": product.description,
        "price": float(product.price),
        "compare_at_price": product.compare_at_price,
        "images": product.images or [],
        "videos": product.videos or [],
        "tags": product.tags or [],
        "meta_title": product.meta_title,
        "meta_description": product.meta_description,
        "featured": bool(product.featured),
        "on_sale": bool(product.on_sale),
        "is_new": bool(product.is_new),
        "best_seller": bool(product.best_seller),
        "stock": int(product.stock or 0),
        "sku": product.sku,
        # Keep existing store filters working
        "category": category_slug or (product.category_id or "uncategorized"),
        # V2 category system fields
        "category_id": product.category_id,
        "subcategory_id": product.subcategory_id,
        # Variants
        "has_variants": bool(product.has_variants),
        "variants": product.variants or [],
        "variant_options": product.variant_options or [],
        # Auto topup
        "auto_topup": bool(product.auto_topup),
        # Timestamps
        "created_at": now,
        "updated_at": now,
    }

    await db.products.insert_one(product_doc)
    return product_doc

@complete_router.get("/products")
async def list_products_v2(limit: int = 100, admin: User = Depends(get_current_admin)):
    """Admin helper endpoint to list products (for V2 UIs)."""
    limit = max(1, min(limit, 500))
    return await db.products.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
