"""
Extended models for categories, subcategories, reviews, and media uploads
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import uuid

# ==================== CATEGORIES & SUBCATEGORIES ====================

class SubCategory(BaseModel):
    """Subcategory model"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    parent_category_id: str
    slug: str
    display_order: int = 0
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryExtended(BaseModel):
    """Enhanced category with subcategories"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    image: Optional[str] = None
    slug: str
    parent_id: Optional[str] = None  # For nested categories
    display_order: int = 0
    active: bool = True
    product_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    description: str
    image: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[str] = None
    display_order: int = 0

# ==================== PRODUCT REVIEWS ====================

class Review(BaseModel):
    """Product review with text, images, and rating"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    user_name: str
    user_email: EmailStr
    rating: int = Field(ge=1, le=5)  # 1-5 stars
    title: Optional[str] = None
    comment: str
    images: List[str] = []  # Review images
    verified_purchase: bool = False
    helpful_count: int = 0
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    product_id: str
    user_name: str
    user_email: EmailStr
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = None
    comment: str
    images: List[str] = []

class ReviewUpdate(BaseModel):
    status: Optional[str] = None
    helpful_count: Optional[int] = None

# ==================== MEDIA UPLOADS ====================

class MediaUpload(BaseModel):
    """Media file (image/video) metadata"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_filename: str
    file_path: str
    file_url: str
    file_type: str  # image, video
    mime_type: str
    file_size: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[int] = None  # For videos in seconds
    uploaded_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== ENHANCED PRODUCT MODEL ====================

class ProductComplete(BaseModel):
    """Complete product model with all features"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str  # Rich text HTML
    price: float
    compare_at_price: Optional[float] = None
    cost: Optional[float] = None
    
    # Media
    images: List[str] = []
    videos: List[str] = []
    
    # Categories
    category_id: str
    subcategory_id: Optional[str] = None
    
    # Inventory
    stock: int = 5000
    sku: Optional[str] = None
    barcode: Optional[str] = None
    
    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    slug: Optional[str] = None
    
    # Tags & Attributes
    tags: List[str] = []
    attributes: dict = {}  # {"Color": "Blue", "Size": "Large"}
    
    # Status flags
    featured: bool = False
    on_sale: bool = False
    is_new: bool = False
    best_seller: bool = False
    active: bool = True
    
    # Reviews & Ratings
    rating: float = 0.0
    reviews_count: int = 0
    
    # Stats
    view_count: int = 0
    sales_count: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreateComplete(BaseModel):
    name: str
    description: str
    price: float
    compare_at_price: Optional[float] = None
    cost: Optional[float] = None
    images: List[str] = []
    videos: List[str] = []
    category_id: str
    subcategory_id: Optional[str] = None
    stock: int = 5000
    sku: Optional[str] = None
    barcode: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    slug: Optional[str] = None
    tags: List[str] = []
    attributes: dict = {}
    featured: bool = False
    on_sale: bool = False
    is_new: bool = False
    best_seller: bool = False
