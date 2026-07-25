from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import re
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from jwt.exceptions import InvalidSignatureError, ExpiredSignatureError, DecodeError

# Import payment services
from email_service import email_service
from plisio_service import plisio_service
from stripe_service import stripe_service
from oauth_service import oauth_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory if it doesn't exist
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db_name = os.environ.get('DB_NAME', 'kayee01_db')
db = client[db_name]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production-' + str(uuid.uuid4()))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Mount uploads directory for serving uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ===== MODELS =====

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "customer"  # customer or admin
    wallet_balance: float = 0.0  # store credit for future purchases
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    image: str = ""
    slug: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    description: str
    image: str
    slug: str

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    compare_at_price: Optional[float] = None  # Original price for sale display
    cost: Optional[float] = None  # Cost price for profit calculation
    images: List[str] = []
    category: str
    stock: int
    sku: Optional[str] = None
    barcode: Optional[str] = None
    weight: Optional[float] = None
    featured: bool = False
    on_sale: bool = False
    is_new: bool = False
    best_seller: bool = False
    digital_product: bool = False
    download_url: Optional[str] = None
    tags: List[str] = []
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    has_variations: bool = False
    variations_count: int = 0
    rating: float = 0.0
    reviews_count: int = 0
    view_count: int = 0
    sales_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    compare_at_price: Optional[float] = None
    cost: Optional[float] = None
    images: List[str] = []
    category: str
    stock: int = 0
    sku: Optional[str] = None
    barcode: Optional[str] = None
    weight: Optional[float] = None
    featured: bool = False
    on_sale: bool = False
    is_new: bool = False
    best_seller: bool = False
    digital_product: bool = False
    download_url: Optional[str] = None
    tags: List[str] = []
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    
    # Product Variants (sizes, colors, etc.)
    has_variants: bool = False
    variants: List[dict] = []  # [{name: "Size", values: ["S", "M", "L"]}, {name: "Color", values: ["Black", "White"]}]
    variant_options: List[dict] = []  # [{size: "M", color: "Black", price: 100, sku: "ABC-M-BLK"}]

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    compare_at_price: Optional[float] = None
    cost: Optional[float] = None
    images: Optional[List[str]] = None
    category: Optional[str] = None
    stock: Optional[int] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    weight: Optional[float] = None
    featured: Optional[bool] = None
    on_sale: Optional[bool] = None
    is_new: Optional[bool] = None
    best_seller: Optional[bool] = None
    digital_product: Optional[bool] = None
    download_url: Optional[str] = None
    tags: Optional[List[str]] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class CartItem(BaseModel):
    product_id: str
    quantity: int

class Coupon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discount_type: str  # percentage or fixed
    discount_value: float
    min_purchase: Optional[float] = 0.0
    max_uses: Optional[int] = None
    used_count: int = 0
    active: bool = True
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CouponCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    min_purchase: Optional[float] = 0.0
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    user_email: str
    user_name: str
    items: List[dict]
    total: float
    order_status: str = "pending"  # pending, processing, shipped, delivered, cancelled
    # Frontend/admin dashboard expects `status` (legacy), so we store both.
    status: str = "pending"
    payment_method: str  # stripe, binance, plisio, manual
    payment_status: str = "pending"  # pending, confirmed, failed, refunded
    shipping_address: dict
    shipping_method: Optional[str] = "free"  # free or fedex
    shipping_cost: Optional[float] = 0.0
    phone: Optional[str] = ""
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Tracking information
    tracking_number: Optional[str] = None
    tracking_carrier: Optional[str] = None  # fedex, usps
    
    # Coupon/Discount
    coupon_code: Optional[str] = None
    discount_amount: Optional[float] = 0.0
    crypto_discount: Optional[float] = 0.0
    
    # Payment gateway specific fields
    stripe_payment_id: Optional[str] = None
    stripe_payment_url: Optional[str] = None
    coinpal_payment_id: Optional[str] = None
    coinpal_payment_url: Optional[str] = None
    coinpal_qr_code: Optional[str] = None
    plisio_invoice_id: Optional[str] = None
    plisio_invoice_url: Optional[str] = None
    plisio_qr_code: Optional[str] = None
    plisio_wallet_hash: Optional[str] = None
    binance_order_id: Optional[str] = None
    binance_checkout_url: Optional[str] = None
    binance_qr_code: Optional[str] = None

    # Refund / store-credit fields
    refunded_to_wallet: bool = False
    refunded_amount: float = 0.0
    refunded_at: Optional[str] = None
    refund_reason: Optional[str] = None
    wallet_transaction_id: Optional[str] = None

class WalletTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: EmailStr
    type: str  # credit | debit
    amount: float
    reason: str
    order_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WalletRefundRequest(BaseModel):
    amount: Optional[float] = None
    reason: Optional[str] = None

# API Settings model
class APISettings(BaseModel):
    resend_api_key: Optional[str] = ""
    stripe_secret_key: Optional[str] = ""
    stripe_publishable_key: Optional[str] = ""
    plisio_api_key: Optional[str] = ""
    from_email: Optional[str] = ""
    from_name: Optional[str] = "Kayee01"

class OrderCreate(BaseModel):
    user_email: str
    user_name: str
    items: List[dict]
    total: float
    payment_method: str
    coupon_code: Optional[str] = None
    discount_amount: Optional[float] = 0.0
    crypto_discount: Optional[float] = 0.0
    shipping_address: dict
    shipping_method: Optional[str] = "free"
    shipping_cost: Optional[float] = 0.0
    phone: Optional[str] = ""
    notes: Optional[str] = None

# ===== HELPER FUNCTIONS =====

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password using passlib, with a bcrypt fallback.

    NOTE: Do not add hardcoded bypasses here; it becomes a credential backdoor.
    """
    if not hashed_password:
        return False

    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # Fallback to bcrypt directly (helps if hashes were generated outside passlib)
        try:
            import bcrypt
            hashed_bytes = (
                hashed_password.encode("utf-8")
                if isinstance(hashed_password, str)
                else hashed_password
            )
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_bytes)
        except Exception:
            return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except (InvalidSignatureError, DecodeError, Exception) as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> Optional[User]:
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            return None
        return User(**user)
    except Exception:
        return None

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def prepare_for_mongo(data: dict) -> dict:
    """Convert datetime objects to ISO strings for MongoDB storage"""
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data

def parse_from_mongo(item: dict) -> dict:
    """Convert ISO strings back to datetime objects"""
    for key, value in item.items():
        if key in ['created_at'] and isinstance(value, str):
            item[key] = datetime.fromisoformat(value)
    return item

# ===== AUTH ROUTES =====

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role="customer"
    )
    
    user_doc = user.model_dump()
    user_doc['password_hash'] = hash_password(user_data.password)
    user_doc = prepare_for_mongo(user_doc)
    
    await db.users.insert_one(user_doc)
    
    # Send welcome email
    try:
        await email_service.send_welcome_email(user.email, user.name)
    except Exception as e:
        logger.error(f"Failed to send welcome email: {str(e)}")
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Support legacy admin records that stored "password" instead of "password_hash"
    stored_hash = user_doc.get("password_hash") or user_doc.get("password") or ""
    password_valid = verify_password(credentials.password, stored_hash)
    
    if not password_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_doc = parse_from_mongo(user_doc)
    user = User(**user_doc)
    
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.put("/users/profile", response_model=User)
async def update_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update user profile"""
    # Remove fields that shouldn't be updated
    profile_data.pop('id', None)
    profile_data.pop('email', None)  # Email shouldn't be changed here
    profile_data.pop('role', None)
    profile_data.pop('created_at', None)
    profile_data.pop('wallet_balance', None)  # wallet is managed by admin/refunds only
    
    # Update user
    result = await db.users.update_one(
        {"id": current_user.id},
        {"$set": profile_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get updated user
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    return User(**parse_from_mongo(updated_user))

@api_router.post("/support/contact")
async def contact_support(support_request: dict):
    """Send support message"""
    # In a real application, this would send an email or create a ticket
    # For now, we'll just log it and return success
    print(f"Support request from {support_request.get('user_email')}")
    print(f"Subject: {support_request.get('subject')}")
    print(f"Message: {support_request.get('message')}")
    
    # You can integrate with email service here
    # await send_support_email(support_request)
    
    return {"message": "Support request received. We'll get back to you soon!"}


@api_router.post("/auth/forgot-password")
async def forgot_password(email: EmailStr):
    """Send password reset email"""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # Return success even if user not found (security best practice)
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token in database
    await db.users.update_one(
        {"email": email},
        {"$set": {
            "reset_token": reset_token,
            "reset_expires": reset_expires.isoformat()
        }}
    )
    
    # Send reset email
    try:
        await email_service.send_password_reset_email(email, reset_token)
    except Exception as e:
        logger.error(f"Failed to send reset email: {str(e)}")
    
    return {"message": "If the email exists, a reset link has been sent"}

@api_router.post("/auth/reset-password")
async def reset_password(token: str, new_password: str):
    """Reset password with token"""
    user = await db.users.find_one({"reset_token": token}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token is expired
    reset_expires = datetime.fromisoformat(user.get('reset_expires'))
    if reset_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Update password and remove reset token
    hashed = hash_password(new_password)
    await db.users.update_one(
        {"reset_token": token},
        {"$set": {
            "password_hash": hashed
        },
        "$unset": {
            "reset_token": "",
            "reset_expires": ""
        }}
    )
    
    return {"message": "Password reset successfully"}

# ===== CATEGORY ROUTES =====

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    result = []
    for cat in categories:
        parse_from_mongo(cat)
        if not cat.get("slug") and cat.get("name"):
            cat["slug"] = str(cat["name"]).lower().strip().replace(" ", "-")
        try:
            result.append(Category(**cat))
        except Exception as e:
            logger.warning(f"Skipping invalid category document {cat.get('id')}: {e}")
    return result

@api_router.post("/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, admin: User = Depends(get_current_admin)):
    category = Category(**category_data.model_dump())
    category_doc = prepare_for_mongo(category.model_dump())
    await db.categories.insert_one(category_doc)
    return category

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category_data: CategoryCreate, admin: User = Depends(get_current_admin)):
    result = await db.categories.update_one(
        {"id": category_id},
        {"$set": category_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    updated_cat = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return Category(**parse_from_mongo(updated_cat))

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: User = Depends(get_current_admin)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

# ===== PRODUCT ROUTES =====

@api_router.get("/products", response_model=List[Product])
async def get_products(
    category: Optional[str] = None, 
    featured: Optional[bool] = None,
    on_sale: Optional[bool] = None,
    is_new: Optional[bool] = None,
    best_seller: Optional[bool] = None,
    tags: Optional[str] = None,  # Comma-separated tags
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = None,  # featured, price_asc, price_desc, newest
    sort_by: Optional[str] = "created_at",  # price, name, created_at, sales_count
    sort_order: Optional[str] = "desc",  # asc or desc
    skip: int = 0,
    limit: int = 100
):
    query = {}
    if category:
        query["category"] = category
    if featured is not None:
        query["featured"] = featured
    if on_sale is not None:
        query["on_sale"] = on_sale
    if is_new is not None:
        query["is_new"] = is_new
    if best_seller is not None:
        query["best_seller"] = best_seller
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        query["tags"] = {"$in": tag_list}

    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = float(min_price)
        if max_price is not None:
            query["price"]["$lte"] = float(max_price)
        if not query["price"]:
            query.pop("price", None)

    # Allow simple sort param used by the frontend
    if sort:
        if sort == "price_asc":
            sort_by, sort_order = "price", "asc"
        elif sort == "price_desc":
            sort_by, sort_order = "price", "desc"
        elif sort == "newest":
            sort_by, sort_order = "created_at", "desc"
        elif sort == "featured":
            sort_by, sort_order = "featured", "desc"
    
    sort_direction = -1 if sort_order == "desc" else 1
    
    products = await db.products.find(query, {"_id": 0}).sort(sort_by, sort_direction).skip(skip).limit(limit).to_list(limit)
    for prod in products:
        parse_from_mongo(prod)
    return [Product(**prod) for prod in products]

@api_router.get("/products/count")
async def get_products_count(
    category: Optional[str] = None,
    featured: Optional[bool] = None,
    on_sale: Optional[bool] = None,
    is_new: Optional[bool] = None,
    best_seller: Optional[bool] = None,
    tags: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
):
    query = {}
    if category:
        query["category"] = category
    if featured is not None:
        query["featured"] = featured
    if on_sale is not None:
        query["on_sale"] = on_sale
    if is_new is not None:
        query["is_new"] = is_new
    if best_seller is not None:
        query["best_seller"] = best_seller
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        query["tags"] = {"$in": tag_list}
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = float(min_price)
        if max_price is not None:
            query["price"]["$lte"] = float(max_price)
        if not query["price"]:
            query.pop("price", None)
    
    count = await db.products.count_documents(query)
    return {"count": count}

@api_router.get("/products/search")
async def search_products(q: str, limit: int = 10):
    """Search products by name, description, or tags"""
    if not q or len(q.strip()) < 2:
        return []
    q = q.strip()

    # Prevent pathological regex inputs (regex injection / ReDoS)
    if len(q) > 64:
        raise HTTPException(status_code=400, detail="Search query too long")

    # Cap limit to prevent unbounded queries
    limit = max(1, min(limit, 50))
    safe_pattern = re.escape(q)
    
    # Create text search query
    search_query = {
        "$or": [
            {"name": {"$regex": safe_pattern, "$options": "i"}},
            {"description": {"$regex": safe_pattern, "$options": "i"}},
            {"tags": {"$regex": safe_pattern, "$options": "i"}},
            {"category": {"$regex": safe_pattern, "$options": "i"}}
        ]
    }
    
    products = await db.products.find(search_query, {"_id": 0}).limit(limit).to_list(length=None)
    return [Product(**parse_from_mongo(p)) for p in products]



@api_router.get("/products/best-sellers", response_model=List[Product])
async def get_best_sellers(limit: int = 10):
    """Get best selling products based on order items"""
    # Aggregate orders to find most purchased products
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "total_quantity": {"$sum": "$items.quantity"}
        }},
        {"$sort": {"total_quantity": -1}},
        {"$limit": limit}
    ]
    
    best_sellers = await db.orders.aggregate(pipeline).to_list(length=None)
    product_ids = [bs["_id"] for bs in best_sellers]
    
    # Get products by IDs
    if not product_ids:
        # If no orders yet, return featured products
        products = await db.products.find({"featured": True}, {"_id": 0}).limit(limit).to_list(length=None)
    else:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(length=None)
    
    return [Product(**parse_from_mongo(p)) for p in products]

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**parse_from_mongo(product))

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, admin: User = Depends(get_current_admin)):
    product = Product(**product_data.model_dump())
    product_doc = prepare_for_mongo(product.model_dump())
    await db.products.insert_one(product_doc)
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_data: ProductUpdate, admin: User = Depends(get_current_admin)):
    update_data = {k: v for k, v in product_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": prepare_for_mongo(update_data)}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    updated_prod = await db.products.find_one({"id": product_id}, {"_id": 0})
    return Product(**parse_from_mongo(updated_prod))

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: User = Depends(get_current_admin)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

# ===== ORDER ROUTES =====

@api_router.post("/orders", response_model=Order)
async def create_order(
    order_data: OrderCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    order_number = f"ORD-{str(uuid.uuid4())[:8].upper()}"

    # Discount values are calculated client-side (UI) and persisted here.
    # Avoid re-applying discounts server-side (prevents double-discount bugs).
    total_amount = float(order_data.total)
    crypto_discount = float(order_data.crypto_discount or 0.0) if order_data.payment_method == "plisio" else 0.0
    discount_amount = float(order_data.discount_amount or 0.0)
    
    # Get payment gateway instructions if it's a custom manual payment
    payment_gateway_instructions = ""
    payment_gateway_name = ""
    
    if order_data.payment_method.startswith('manual-'):
        try:
            settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
            if settings:
                gateways = settings.get("payment_gateways", [])
                gateway_id = order_data.payment_method.replace('manual-', '')
                for gateway in gateways:
                    if gateway.get('gateway_id') == gateway_id or gateway.get('id') == gateway_id:
                        payment_gateway_instructions = gateway.get('payment_instructions', '')
                        payment_gateway_name = gateway.get('name', '')
                        break
        except Exception as e:
            logger.error(f"Failed to get payment gateway instructions: {str(e)}")
    
    # Create order data dict and update with calculated values
    order_dict = order_data.model_dump()
    order_dict.update({
        "order_number": order_number,
        "crypto_discount": crypto_discount,
        "discount_amount": discount_amount,
        "coupon_code": order_data.coupon_code,
        "total": total_amount,
        # Keep legacy `status` in sync with `order_status`
        "status": "pending",
        "payment_gateway_instructions": payment_gateway_instructions,
        "payment_gateway_name": payment_gateway_name
    })
    
    order = Order(**order_dict)
    order_doc = prepare_for_mongo(order.model_dump())
    await db.orders.insert_one(order_doc)
    
    # Créer le paiement selon la méthode choisie
    payment_info = {}
    
    try:
        # Wallet payment (store credit)
        if order_data.payment_method == 'wallet':
            if not current_user:
                raise HTTPException(status_code=401, detail="Login required to pay with wallet")
            if current_user.email.lower() != order.user_email.lower():
                raise HTTPException(status_code=400, detail="Wallet user/email mismatch")

            user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
            wallet_balance = float((user_doc or {}).get("wallet_balance", 0.0))
            if wallet_balance < order.total:
                raise HTTPException(status_code=400, detail="Insufficient wallet balance")

            new_balance = wallet_balance - float(order.total)
            await db.users.update_one({"id": current_user.id}, {"$set": {"wallet_balance": new_balance}})

            tx = WalletTransaction(
                user_id=current_user.id,
                user_email=current_user.email,
                type="debit",
                amount=float(order.total),
                reason=f"Payment for {order.order_number}",
                order_id=order.id,
            )
            await db.wallet_transactions.insert_one(prepare_for_mongo(tx.model_dump()))

            payment_info = {
                "payment_status": "confirmed",
                "order_status": "processing",
                "status": "processing",
                "wallet_transaction_id": tx.id,
            }

        if order_data.payment_method == 'stripe':
            payment_result = await stripe_service.create_payment_link(
                order_id=order.id,
                amount=order.total,
                currency="USD",
                description=f"Order {order_number}",
                customer_email=order.user_email
            )
            if payment_result.get('success'):
                payment_info = {
                    "stripe_payment_id": payment_result.get('payment_id'),
                    "stripe_payment_url": payment_result.get('payment_url')
                }
        
        elif order_data.payment_method == 'plisio':
            payment_result = await plisio_service.create_invoice(
                order_number=order.id,
                amount=order.total,
                source_currency="USD",
                description=f"Order {order_number}",
                email=order.user_email
            )
            if payment_result.get('success'):
                payment_info = {
                    "plisio_invoice_id": payment_result.get('invoice_id'),
                    "plisio_invoice_url": payment_result.get('invoice_url'),
                    "plisio_qr_code": payment_result.get('qr_code'),
                    "plisio_wallet_hash": payment_result.get('wallet_hash')
                }
        
        # Mettre à jour la commande avec les infos de paiement
        if payment_info:
            await db.orders.update_one(
                {"id": order.id},
                {"$set": payment_info}
            )
            # Mettre à jour l'objet order avec les infos de paiement
            for key, value in payment_info.items():
                setattr(order, key, value)
    
    except Exception as e:
        logger.error(f"Failed to create payment for order {order.id}: {str(e)}")
    
    # Envoyer email de confirmation au client avec instructions de paiement
    try:
        order_dict_for_email = order.model_dump()
        order_dict_for_email["payment_gateway_instructions"] = payment_gateway_instructions
        order_dict_for_email["payment_gateway_name"] = payment_gateway_name
        # Ensure 'status' key exists for email templates
        if 'status' not in order_dict_for_email:
            order_dict_for_email['status'] = order_dict_for_email.get('order_status', 'pending')
        await email_service.send_order_confirmation(order_dict_for_email)
    except Exception as e:
        logger.error(f"Failed to send order confirmation email: {str(e)}")
    
    # Envoyer notification aux administrateurs
    try:
        admin_order_dict = order.model_dump()
        # Ensure 'status' key exists for email templates
        if 'status' not in admin_order_dict:
            admin_order_dict['status'] = admin_order_dict.get('order_status', 'pending')
        await email_service.send_admin_new_order_notification(admin_order_dict)
        logger.info(f"✓ Admin notifications sent for order {order.order_number}")
    except Exception as e:
        logger.error(f"Failed to send admin notification email: {str(e)}")
    
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders(admin: User = Depends(get_current_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for order in orders:
        parse_from_mongo(order)
    return [Order(**order) for order in orders]

@api_router.get("/orders/my", response_model=List[Order])
async def get_my_orders(current_user: User = Depends(get_current_user)):
    orders = await db.orders.find({"user_email": current_user.email}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for order in orders:
        parse_from_mongo(order)
    return [Order(**order) for order in orders]

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order(**parse_from_mongo(order))

@api_router.get("/orders/track/{order_number}", response_model=Order)
async def track_order(order_number: str):
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order(**parse_from_mongo(order))

@api_router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str,
    payment_status: Optional[str] = None,
    admin: User = Depends(get_current_admin)
):
    # Récupérer l'ancienne commande
    old_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not old_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = old_order.get("order_status")
    old_payment_status = old_order.get("payment_status")
    
    update_data = {"order_status": status, "status": status}
    if payment_status:
        update_data["payment_status"] = payment_status
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    # Récupérer la commande mise à jour
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    order_obj = Order(**parse_from_mongo(updated_order))
    
    # Envoyer notifications email
    try:
        # Si le statut a changé
        if status != old_status:
            order_dict = order_obj.model_dump()
            # Ensure 'status' key exists for email templates
            if 'status' not in order_dict:
                order_dict['status'] = order_dict.get('order_status', 'pending')
            await email_service.send_order_status_update(
                order_dict,
                old_status
            )
        
        # Si le paiement est confirmé
        if payment_status == "confirmed" and old_payment_status != "confirmed":
            order_dict_payment = order_obj.model_dump()
            # Ensure 'status' key exists for email templates
            if 'status' not in order_dict_payment:
                order_dict_payment['status'] = order_dict_payment.get('order_status', 'pending')
            await email_service.send_payment_confirmation(order_dict_payment)
    except Exception as e:
        logger.error(f"Failed to send notification email: {str(e)}")
    
    return {"message": "Order updated successfully"}

# ===== STATS ROUTES =====

@api_router.get("/admin/stats")
async def get_admin_stats(admin: User = Depends(get_current_admin)):
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"order_status": "pending"})
    total_users = await db.users.count_documents({"role": "customer"})
    
    # Calculate total revenue
    orders = await db.orders.find({"payment_status": "confirmed"}, {"_id": 0, "total": 1}).to_list(10000)
    total_revenue = sum(order.get("total", 0) for order in orders)
    
    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "total_users": total_users,
        "total_revenue": total_revenue
    }

@api_router.put("/orders/{order_id}/tracking")
async def update_order_tracking(
    order_id: str,
    tracking_number: str,
    tracking_carrier: str,
    admin: User = Depends(get_current_admin)
):
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "tracking_number": tracking_number,
            "tracking_carrier": tracking_carrier,
            "order_status": "shipped",
            "status": "shipped",
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Send tracking email to customer
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if order:
        await email_service.send_tracking_update(
            order['user_email'],
            order['order_number'],
            tracking_number,
            tracking_carrier
        )
    
    return {"message": "Tracking updated successfully"}

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, admin: User = Depends(get_current_admin)):
    """Delete an order"""
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted successfully"}

# ===== WEBHOOK ROUTES =====

@api_router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Webhook pour recevoir les notifications de paiement Stripe"""
    try:
        payload = await request.body()
        event_data = await request.json()
        
        event_type = event_data.get('type')
        
        if event_type == 'checkout.session.completed' or event_type == 'payment_intent.succeeded':
            # Paiement réussi
            metadata = event_data.get('data', {}).get('object', {}).get('metadata', {})
            order_id = metadata.get('order_id')
            
            if order_id:
                # Mettre à jour la commande
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {
                        "payment_status": "confirmed",
                        "order_status": "processing",
                        "status": "processing",
                    }}
                )
                
                # Envoyer facture par email
                order = await db.orders.find_one({"id": order_id}, {"_id": 0})
                if order:
                    await email_service.send_invoice(order)
                
                logger.info(f"✓ Stripe payment confirmed for order {order_id}")
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Stripe webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

@api_router.post("/webhooks/plisio")
async def plisio_webhook(request: Request):
    """Webhook pour recevoir les notifications de paiement Plisio"""
    try:
        data = await request.json()
        
        status = data.get('status')
        order_number = data.get('order_number')
        
        if status == 'completed' and order_number:
            # Paiement crypto confirmé
            await db.orders.update_one(
                {"id": order_number},
                {"$set": {
                    "payment_status": "confirmed",
                    "order_status": "processing",
                    "status": "processing",
                }}
            )
            
            # Envoyer facture par email
            order = await db.orders.find_one({"id": order_number}, {"_id": 0})
            if order:
                await email_service.send_invoice(order)
            
            logger.info(f"✓ Plisio payment confirmed for order {order_number}")
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Plisio webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

# ===== COUPON ROUTES =====

@api_router.post("/coupons", response_model=Coupon)
async def create_coupon(coupon_data: CouponCreate, admin: User = Depends(get_current_admin)):
    coupon = Coupon(**coupon_data.model_dump())
    coupon_doc = prepare_for_mongo(coupon.model_dump())
    await db.coupons.insert_one(coupon_doc)
    return coupon

@api_router.get("/coupons", response_model=List[Coupon])
async def get_coupons(admin: User = Depends(get_current_admin)):
    coupons = await db.coupons.find({}, {"_id": 0}).to_list(length=None)
    return [Coupon(**parse_from_mongo(c)) for c in coupons]

@api_router.post("/coupons/validate")
async def validate_coupon(code: str, cart_total: float):
    coupon = await db.coupons.find_one({"code": code, "active": True}, {"_id": 0})
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    
    coupon_obj = Coupon(**parse_from_mongo(coupon))
    
    # Check expiration
    if coupon_obj.expires_at and coupon_obj.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Coupon has expired")
    
    # Check max uses
    if coupon_obj.max_uses and coupon_obj.used_count >= coupon_obj.max_uses:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    
    # Check minimum purchase
    if cart_total < coupon_obj.min_purchase:
        raise HTTPException(status_code=400, detail=f"Minimum purchase of ${coupon_obj.min_purchase} required")
    
    # Calculate discount
    if coupon_obj.discount_type == "percentage":
        discount = cart_total * (coupon_obj.discount_value / 100)
    else:
        discount = coupon_obj.discount_value
    
    return {
        "valid": True,
        "discount_amount": discount,
        "discount_type": coupon_obj.discount_type,
        "discount_value": coupon_obj.discount_value
    }

# ===== WISHLIST ROUTES =====

@api_router.get("/wishlist")
async def get_wishlist(current_user: User = Depends(get_current_user)):
    """Get user's wishlist"""
    wishlist = await db.wishlists.find_one({"user_id": current_user.id}, {"_id": 0})
    if not wishlist:
        return []
    
    # Get product details
    product_ids = wishlist.get("product_ids", [])
    if not product_ids:
        return []
    
    products = await db.products.find(
        {"id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(length=None)
    
    return [Product(**parse_from_mongo(p)) for p in products]

@api_router.post("/wishlist/{product_id}")
async def add_to_wishlist(product_id: str, current_user: User = Depends(get_current_user)):
    """Add product to wishlist"""
    # Check if product exists
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Add to wishlist
    await db.wishlists.update_one(
        {"user_id": current_user.id},
        {
            "$addToSet": {"product_ids": product_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    return {"message": "Added to wishlist"}

@api_router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, current_user: User = Depends(get_current_user)):
    """Remove product from wishlist"""
    result = await db.wishlists.update_one(
        {"user_id": current_user.id},
        {"$pull": {"product_ids": product_id}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Product not in wishlist")
    
    return {"message": "Removed from wishlist"}

@api_router.get("/products/by-ids")
async def get_products_by_ids(ids: str):
    """Get products by comma-separated IDs"""
    product_ids = [id.strip() for id in ids.split(',') if id.strip()]
    products = await db.products.find(
        {"id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(length=None)
    return [Product(**parse_from_mongo(p)) for p in products]

# ===== WALLET ROUTES =====

@api_router.get("/wallet/balance")
async def get_wallet_balance(current_user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    balance = float((user_doc or {}).get("wallet_balance", 0.0))
    return {"balance": balance}

@api_router.get("/wallet/transactions", response_model=List[WalletTransaction])
async def get_wallet_transactions(current_user: User = Depends(get_current_user), limit: int = 50):
    limit = max(1, min(limit, 200))
    txs = await db.wallet_transactions.find(
        {"user_id": current_user.id},
        {"_id": 0},
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    for tx in txs:
        parse_from_mongo(tx)
    return [WalletTransaction(**tx) for tx in txs]

@api_router.post("/admin/orders/{order_id}/refund-to-wallet")
async def refund_order_to_wallet(
    order_id: str,
    refund: WalletRefundRequest,
    admin: User = Depends(get_current_admin),
):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("refunded_to_wallet"):
        raise HTTPException(status_code=400, detail="Order already refunded to wallet")

    order_total = float(order.get("total", 0.0))
    amount = float(refund.amount) if refund.amount is not None else order_total
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Refund amount must be > 0")
    if amount > order_total:
        raise HTTPException(status_code=400, detail="Refund amount cannot exceed order total")

    user_email = order.get("user_email")
    user_doc = await db.users.find_one({"email": user_email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Customer account not found for this order")

    old_balance = float(user_doc.get("wallet_balance", 0.0))
    new_balance = old_balance + amount
    await db.users.update_one({"id": user_doc["id"]}, {"$set": {"wallet_balance": new_balance}})

    tx = WalletTransaction(
        user_id=user_doc["id"],
        user_email=user_doc["email"],
        type="credit",
        amount=amount,
        reason=refund.reason or f"Refund for {order.get('order_number')}",
        order_id=order_id,
    )
    await db.wallet_transactions.insert_one(prepare_for_mongo(tx.model_dump()))

    refund_fields = {
        "refunded_to_wallet": True,
        "refunded_amount": amount,
        "refunded_at": datetime.now(timezone.utc).isoformat(),
        "refund_reason": refund.reason or "Refunded to wallet",
        "wallet_transaction_id": tx.id,
        "payment_status": "refunded",
        "order_status": "refunded",
        "status": "refunded",
    }
    await db.orders.update_one({"id": order_id}, {"$set": refund_fields})

    return {"message": "Refund credited to customer wallet", "wallet_balance": new_balance, "transaction_id": tx.id}

# ===== ADMIN SETTINGS ROUTES =====

from models import (
    PaymentGatewaySettings, PaymentGatewayCreate,
    SocialLink, SocialLinkCreate,
    ExternalLink, ExternalLinkCreate,
    FloatingAnnouncement, FloatingAnnouncementUpdate,
    BulkEmail, BulkEmailCreate,
    AdminUser, AdminUserCreate, AdminUserUpdate, AdminPermissions
)

@api_router.get("/admin/settings/payment-gateways")
async def get_payment_gateways(admin: User = Depends(get_current_admin)):
    """Get all payment gateway settings"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        return []
    return settings.get("payment_gateways", [])

@api_router.get("/settings/payment-gateways")
async def get_public_payment_gateways():
    """Get public payment gateways (no auth required)"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        return []
    # Return only enabled gateways
    gateways = settings.get("payment_gateways", [])
    return [g for g in gateways if g.get("enabled", True)]

@api_router.post("/admin/settings/payment-gateways")
async def create_payment_gateway(gateway_data: PaymentGatewayCreate, admin: User = Depends(get_current_admin)):
    """Add a new payment gateway"""
    gateway = PaymentGatewaySettings(**gateway_data.model_dump())
    
    # Update or create settings document
    await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$push": {"payment_gateways": gateway.model_dump()}},
        upsert=True
    )
    
    return gateway

@api_router.put("/admin/settings/payment-gateways/{gateway_id}")
async def update_payment_gateway(gateway_id: str, gateway_data: dict, admin: User = Depends(get_current_admin)):
    """Update a payment gateway"""
    result = await db.admin_settings.update_one(
        {"id": "admin_settings", "payment_gateways.gateway_id": gateway_id},
        {"$set": {"payment_gateways.$": gateway_data}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment gateway not found")
    
    return {"message": "Payment gateway updated successfully"}

@api_router.delete("/admin/settings/payment-gateways/{gateway_id}")
async def delete_payment_gateway(gateway_id: str, admin: User = Depends(get_current_admin)):
    """Delete a payment gateway"""
    result = await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$pull": {"payment_gateways": {"gateway_id": gateway_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Payment gateway not found")
    
    return {"message": "Payment gateway deleted successfully"}

# Social Links Routes
@api_router.get("/admin/settings/social-links")
async def get_social_links(admin: User = Depends(get_current_admin)):
    """Get all social links"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        return []
    return settings.get("social_links", [])

@api_router.get("/settings/social-links")
async def get_public_social_links():
    """Get public social links (no auth required)"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        return []
    return [link for link in settings.get("social_links", []) if link.get("enabled", True)]

@api_router.post("/admin/settings/social-links")
async def create_social_link(link_data: SocialLinkCreate, admin: User = Depends(get_current_admin)):
    """Add a new social link"""
    link = SocialLink(**link_data.model_dump())
    
    await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$push": {"social_links": link.model_dump()}},
        upsert=True
    )
    
    return link

@api_router.put("/admin/settings/social-links/{link_id}")
async def update_social_link(link_id: str, link_data: dict, admin: User = Depends(get_current_admin)):
    """Update a social link"""
    result = await db.admin_settings.update_one(
        {"id": "admin_settings", "social_links.id": link_id},
        {"$set": {"social_links.$": link_data}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Social link not found")
    
    return {"message": "Social link updated successfully"}

@api_router.delete("/admin/settings/social-links/{link_id}")
async def delete_social_link(link_id: str, admin: User = Depends(get_current_admin)):
    """Delete a social link"""
    result = await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$pull": {"social_links": {"id": link_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Social link not found")
    
    return {"message": "Social link deleted successfully"}

# External Links Routes
@api_router.get("/admin/settings/external-links")
async def get_external_links(admin: User = Depends(get_current_admin)):
    """Get all external links"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        return []
    return settings.get("external_links", [])

@api_router.get("/settings/external-links")
async def get_public_external_links():
    """Get public external links (no auth required)"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings:
        return []
    return [link for link in settings.get("external_links", []) if link.get("enabled", True)][:3]

@api_router.post("/admin/settings/external-links")
async def create_external_link(link_data: ExternalLinkCreate, admin: User = Depends(get_current_admin)):
    """Add a new external link (max 3)"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    existing_links = settings.get("external_links", []) if settings else []
    
    if len(existing_links) >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 external links allowed")
    
    link = ExternalLink(**link_data.model_dump())
    
    await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$push": {"external_links": link.model_dump()}},
        upsert=True
    )
    
    return link

@api_router.put("/admin/settings/external-links/{link_id}")
async def update_external_link(link_id: str, link_data: dict, admin: User = Depends(get_current_admin)):
    """Update an external link"""
    result = await db.admin_settings.update_one(
        {"id": "admin_settings", "external_links.id": link_id},
        {"$set": {"external_links.$": link_data}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="External link not found")
    
    return {"message": "External link updated successfully"}

@api_router.delete("/admin/settings/external-links/{link_id}")
async def delete_external_link(link_id: str, admin: User = Depends(get_current_admin)):
    """Delete an external link"""
    result = await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {"$pull": {"external_links": {"id": link_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="External link not found")
    
    return {"message": "External link deleted successfully"}

# Floating Announcement Routes
@api_router.get("/settings/floating-announcement")
async def get_public_floating_announcement():
    """Get public floating announcement (no auth required)"""
    announcement = await db.floating_announcements.find_one({"id": "floating_announcement"}, {"_id": 0})
    if not announcement or not announcement.get("enabled", False):
        return None
    return announcement

@api_router.get("/admin/settings/floating-announcement")
async def get_floating_announcement(admin: User = Depends(get_current_admin)):
    """Get floating announcement settings"""
    announcement = await db.floating_announcements.find_one({"id": "floating_announcement"}, {"_id": 0})
    return announcement

@api_router.put("/admin/settings/floating-announcement")
async def update_floating_announcement(announcement_data: FloatingAnnouncementUpdate, admin: User = Depends(get_current_admin)):
    """Update floating announcement"""
    update_dict = {k: v for k, v in announcement_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.floating_announcements.update_one(
        {"id": "floating_announcement"},
        {"$set": update_dict},
        upsert=True
    )
    
    return {"message": "Floating announcement updated successfully"}

# Bulk Email Routes
@api_router.post("/admin/settings/bulk-email")
async def send_bulk_email(email_data: BulkEmailCreate, admin: User = Depends(get_current_admin)):
    """Send bulk email to customers"""
    # Get all customer emails
    recipient_filter = email_data.recipient_filter
    
    if recipient_filter == "all":
        customers = await db.users.find({"role": "customer"}, {"_id": 0, "email": 1}).to_list(length=None)
    else:
        # Get customers with orders
        orders = await db.orders.find({}, {"_id": 0, "user_email": 1}).to_list(length=None)
        unique_emails = list(set([order["user_email"] for order in orders]))
        customers = [{"email": email} for email in unique_emails]
    
    # Send emails
    sent_count = 0
    for customer in customers:
        try:
            await email_service.send_bulk_promotional_email(
                customer["email"],
                email_data.subject,
                email_data.message
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed to send bulk email to {customer['email']}: {str(e)}")
    
    # Save bulk email record
    bulk_email = BulkEmail(
        **email_data.model_dump(),
        sent_to=sent_count,
        sent_at=datetime.now(timezone.utc)
    )
    
    await db.bulk_emails.insert_one(prepare_for_mongo(bulk_email.model_dump()))
    
    return {"message": f"Bulk email sent successfully to {sent_count} customers", "sent_to": sent_count}

@api_router.get("/admin/settings/bulk-emails")
async def get_bulk_emails(admin: User = Depends(get_current_admin)):
    """Get bulk email history"""
    emails = await db.bulk_emails.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(length=None)
    return [BulkEmail(**parse_from_mongo(email)) for email in emails]

# Google Analytics Routes
@api_router.get("/settings/google-analytics")
async def get_public_google_analytics():
    """Get public Google Analytics settings (no auth required)"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    if not settings or not settings.get("google_analytics"):
        return None
    
    ga_settings = settings.get("google_analytics", {})
    if not ga_settings.get("enabled"):
        return None
    
    # Only return public safe settings
    return {
        "tracking_id": ga_settings.get("tracking_id"),
        "anonymize_ip": ga_settings.get("anonymize_ip", True),
        "disable_advertising": ga_settings.get("disable_advertising", True),
        "cookie_consent_required": ga_settings.get("cookie_consent_required", True)
    }

@api_router.get("/admin/settings/google-analytics")
async def get_google_analytics_settings(admin: User = Depends(get_current_admin)):
    """Get Google Analytics settings"""
    settings = await db.admin_settings.find_one({"id": "admin_settings"}, {"_id": 0})
    return settings.get("google_analytics") if settings else None

@api_router.put("/admin/settings/google-analytics")
async def update_google_analytics(ga_settings: dict, admin: User = Depends(get_current_admin)):
    """Update Google Analytics settings"""
    await db.admin_settings.update_one(
        {"id": "admin_settings"},
        {
            "$set": {
                "google_analytics": ga_settings,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Google Analytics settings updated successfully"}


# ==================== TEAM MANAGEMENT ROUTES ====================

@api_router.get("/admin/team/members")
async def get_team_members(current_user: User = Depends(get_current_admin)):
    """Get all admin team members (requires manage_team permission or super admin)"""
    # Check if user has permission to manage team
    user_data = await db.users.find_one({"email": current_user.email}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only super admin or users with manage_team permission can access
    is_super = user_data.get("is_super_admin", False)
    permissions = user_data.get("permissions", {})
    can_manage_team = permissions.get("manage_team", False) if permissions else False
    
    if not is_super and not can_manage_team:
        raise HTTPException(status_code=403, detail="You don't have permission to manage team")
    
    # Get all admin users
    admin_users = await db.users.find(
        {"role": "admin"}, 
        {"_id": 0, "password": 0, "reset_token": 0, "reset_token_expiry": 0}
    ).to_list(length=100)
    
    return admin_users

@api_router.post("/admin/team/members")
async def create_team_member(member: AdminUserCreate, current_user: User = Depends(get_current_admin)):
    """Create a new admin team member (requires manage_team permission or super admin)"""
    # Check if user has permission to manage team
    user_data = await db.users.find_one({"email": current_user.email}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_super = user_data.get("is_super_admin", False)
    permissions = user_data.get("permissions", {})
    can_manage_team = permissions.get("manage_team", False) if permissions else False
    
    if not is_super and not can_manage_team:
        raise HTTPException(status_code=403, detail="You don't have permission to manage team")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": member.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Hash password
    hashed_password = pwd_context.hash(member.password)
    
    # Create admin user
    admin_user = AdminUser(
        email=member.email,
        name=member.name,
        is_super_admin=member.is_super_admin,
        permissions=member.permissions if member.permissions else AdminPermissions()
    )
    
    user_dict = admin_user.model_dump()
    # Store consistently with the rest of the auth system
    user_dict["password_hash"] = hashed_password
    user_dict = prepare_for_mongo(user_dict)
    
    await db.users.insert_one(user_dict)
    
    # Return without password and with proper serialization
    user_dict.pop("password_hash", None)
    user_dict.pop("_id", None)  # Remove MongoDB _id if present
    return parse_from_mongo(user_dict)

@api_router.put("/admin/team/members/{member_id}")
async def update_team_member(
    member_id: str, 
    update_data: AdminUserUpdate, 
    current_user: User = Depends(get_current_admin)
):
    """Update an admin team member (requires manage_team permission or super admin)"""
    # Check if user has permission to manage team
    user_data = await db.users.find_one({"email": current_user.email}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_super = user_data.get("is_super_admin", False)
    permissions = user_data.get("permissions", {})
    can_manage_team = permissions.get("manage_team", False) if permissions else False
    
    if not is_super and not can_manage_team:
        raise HTTPException(status_code=403, detail="You don't have permission to manage team")
    
    # Build update dict
    update_dict = {}
    if update_data.name is not None:
        update_dict["name"] = update_data.name
    if update_data.is_active is not None:
        update_dict["is_active"] = update_data.is_active
    if update_data.permissions is not None:
        update_dict["permissions"] = update_data.permissions.model_dump()
    if update_data.password is not None:
        update_dict["password_hash"] = pwd_context.hash(update_data.password)
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Update user
    result = await db.users.update_one(
        {"id": member_id, "role": "admin"},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin member not found")
    
    return {"message": "Team member updated successfully"}

@api_router.delete("/admin/team/members/{member_id}")
async def delete_team_member(member_id: str, current_user: User = Depends(get_current_admin)):
    """Delete an admin team member (requires manage_team permission or super admin)"""
    # Check if user has permission to manage team
    user_data = await db.users.find_one({"email": current_user.email}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_super = user_data.get("is_super_admin", False)
    permissions = user_data.get("permissions", {})
    can_manage_team = permissions.get("manage_team", False) if permissions else False
    
    if not is_super and not can_manage_team:
        raise HTTPException(status_code=403, detail="You don't have permission to manage team")
    
    # Cannot delete yourself
    if user_data.get("id") == member_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Delete admin user
    result = await db.users.delete_one({"id": member_id, "role": "admin"})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admin member not found")
    
    return {"message": "Team member deleted successfully"}



# Import payment, oauth, admin and complete routes
from payment_routes import payment_router
from oauth_routes import oauth_router
from admin_routes import admin_router
from complete_routes import complete_router

# Include routers in the main app
app.include_router(api_router)
app.include_router(payment_router, prefix="/api")
app.include_router(oauth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(complete_router)

# --- CORS configuration ---
# If allow_credentials=True, allow_origins cannot be "*".
_cors_configured = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
_cors_allow_all = "*" in _cors_configured

# Explicit allow-list: CORS_ORIGINS, else FRONTEND_URL, else local dev.
_cors_allow_origins = (
    ["*"]
    if _cors_allow_all
    else (_cors_configured or [os.environ.get("FRONTEND_URL", "http://localhost:3000")])
)

# Always accept Vercel deployments (prod + previews), Render sites, and localhost dev,
# even when CORS_ORIGINS/FRONTEND_URL are not explicitly set for them. This lets the
# hosted frontend (e.g. *.vercel.app) reach the API without extra configuration.
_cors_allow_origin_regex = (
    None
    if _cors_allow_all
    else r"https://([a-z0-9-]+\.)*(vercel\.app|onrender\.com)|http://localhost(:\d+)?"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins,
    allow_origin_regex=_cors_allow_origin_regex,
    allow_credentials=(False if _cors_allow_all else True),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Map admin panel API-settings fields -> environment variables consumed by services.
API_SETTINGS_ENV_MAP = {
    "resend_api_key": "RESEND_API_KEY",
    "stripe_secret_key": "STRIPE_SECRET_KEY",
    "stripe_publishable_key": "STRIPE_PUBLISHABLE_KEY",
    "plisio_api_key": "PLISIO_API_KEY",
    "from_email": "FROM_EMAIL",
    "from_name": "FROM_NAME",
}


@app.on_event("startup")
async def load_api_settings_into_env():
    """Hydrate os.environ with API credentials saved from the admin panel.

    Keys entered in the admin dashboard are stored in the `api_settings`
    collection. Services read their credentials from environment variables, so
    without this hook admin-configured keys would be lost on every restart (and
    would never apply on a fresh deploy that has no .env). Loading them here lets
    the store be configured entirely from the admin panel and survive restarts.
    """
    try:
        settings = await db.api_settings.find_one({"_id": "global"})
        if not settings:
            logger.info("No stored API settings found; using environment defaults")
            return

        loaded = []
        for field, env_key in API_SETTINGS_ENV_MAP.items():
            value = settings.get(field)
            if value:
                os.environ[env_key] = value
                loaded.append(env_key)

        if loaded:
            logger.info(
                "Loaded API settings from database into environment: %s",
                ", ".join(loaded),
            )
    except Exception as e:
        logger.error(f"Failed to load API settings from database: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()