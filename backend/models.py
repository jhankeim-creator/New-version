"""
Extended data models for Ecwid-like features
"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


# ==================== PRODUCT VARIATIONS ====================

class ProductVariation(BaseModel):
    """Product variation (size, color, etc.)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    name: str  # e.g., "Small - Red"
    sku: Optional[str] = None
    price_modifier: float = 0.0  # Additional price (+/-)
    stock: int = 0
    attributes: Dict[str, str] = {}  # {"size": "S", "color": "Red"}
    image: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductVariationCreate(BaseModel):
    product_id: str
    name: str
    sku: Optional[str] = None
    price_modifier: float = 0.0
    stock: int = 0
    attributes: Dict[str, str] = {}
    image: Optional[str] = None


# ==================== COUPONS / PROMO CODES ====================

class Coupon(BaseModel):
    """Discount coupon/promo code"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # SUMMER20, WELCOME10
    discount_type: str  # "percentage" or "fixed"
    discount_value: float  # 20 (for 20%) or 10 (for $10)
    minimum_purchase: float = 0.0
    max_uses: Optional[int] = None  # None = unlimited
    uses_count: int = 0
    active: bool = True
    valid_from: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: Optional[datetime] = None
    applicable_categories: List[str] = []  # Empty = all categories
    applicable_products: List[str] = []  # Empty = all products
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CouponCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    minimum_purchase: float = 0.0
    max_uses: Optional[int] = None
    active: bool = True
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    applicable_categories: List[str] = []
    applicable_products: List[str] = []


class CouponValidation(BaseModel):
    """Response for coupon validation"""
    valid: bool
    discount_amount: float = 0.0
    message: str = ""


# ==================== CUSTOMERS (CRM) ====================

class Customer(BaseModel):
    """Customer profile with purchase history"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    phone: Optional[str] = None
    total_orders: int = 0
    total_spent: float = 0.0
    customer_group: str = "regular"  # regular, vip, wholesale
    notes: Optional[str] = None
    addresses: List[Dict[str, Any]] = []
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_order_date: Optional[datetime] = None


class CustomerCreate(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    customer_group: str = "regular"
    notes: Optional[str] = None
    tags: List[str] = []


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    customer_group: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


# ==================== STORE SETTINGS ====================

class StoreSettings(BaseModel):
    """Store configuration and settings"""
    model_config = ConfigDict(extra="ignore")
    id: str = "store_settings"  # Single document
    store_name: str = "LuxeBoutique"
    store_logo: Optional[str] = None
    store_description: Optional[str] = None
    primary_color: str = "#d4af37"
    secondary_color: str = "#000000"
    
    # Email settings
    email_from: str = "noreply@store.com"
    email_notifications: bool = True
    
    # Currency and tax
    currency: str = "USD"
    tax_rate: float = 0.0
    tax_included: bool = False
    
    # Shipping
    free_shipping_threshold: float = 0.0
    default_shipping_cost: float = 0.0
    
    # Stock alerts
    low_stock_threshold: int = 5
    out_of_stock_behavior: str = "hide"  # hide, show, preorder
    
    # Order settings
    auto_complete_orders: bool = False
    order_prefix: str = "ORD-"
    
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StoreSettingsUpdate(BaseModel):
    store_name: Optional[str] = None
    store_logo: Optional[str] = None
    store_description: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    email_from: Optional[str] = None
    email_notifications: Optional[bool] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    tax_included: Optional[bool] = None
    free_shipping_threshold: Optional[float] = None
    default_shipping_cost: Optional[float] = None
    low_stock_threshold: Optional[int] = None
    out_of_stock_behavior: Optional[str] = None
    auto_complete_orders: Optional[bool] = None
    order_prefix: Optional[str] = None


# ==================== EXTENDED PRODUCT MODEL ====================

class ProductExtended(BaseModel):
    """Extended product model with additional Ecwid features"""
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


class ProductExtendedCreate(BaseModel):
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


class ProductExtendedUpdate(BaseModel):
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


# ==================== ORDER EXTENSIONS ====================

class OrderNote(BaseModel):
    """Internal note on an order"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    author: str  # Admin username
    note: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderUpdate(BaseModel):
    """Update order details"""
    status: Optional[str] = None
    payment_status: Optional[str] = None
    shipping_address: Optional[dict] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    internal_notes: Optional[List[dict]] = None


# ==================== STATISTICS ====================

class DashboardStats(BaseModel):
    """Dashboard statistics"""
    today_sales: float
    today_orders: int
    week_sales: float
    week_orders: int
    month_sales: float
    month_orders: int
    total_sales: float
    total_orders: int
    total_customers: int
    low_stock_products: int
    pending_orders: int
    top_products: List[Dict[str, Any]]
    recent_orders: List[Dict[str, Any]]
    sales_chart: List[Dict[str, Any]]  # For graph data


# ==================== BULK OPERATIONS ====================

class BulkProductUpdate(BaseModel):
    """Bulk update multiple products"""
    product_ids: List[str]
    updates: Dict[str, Any]  # Fields to update


class BulkPriceUpdate(BaseModel):
    """Bulk update prices"""
    product_ids: List[str]
    operation: str  # "add", "subtract", "multiply", "set"
    value: float


class BulkStockUpdate(BaseModel):
    """Bulk update stock"""
    product_ids: List[str]
    operation: str  # "add", "subtract", "set"
    value: int



# ==================== ADMIN SETTINGS (NEW) ====================

class PaymentGatewaySettings(BaseModel):
    """Payment gateway configuration"""
    model_config = ConfigDict(extra="ignore")
    gateway_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    gateway_type: str  # stripe, plisio, manual
    name: str  # Display name
    description: Optional[str] = None
    logo_url: Optional[str] = None
    enabled: bool = True
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    instructions: Optional[str] = None  # For manual payments
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentGatewayCreate(BaseModel):
    gateway_type: str
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    enabled: bool = True
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    instructions: Optional[str] = None


class ShippingMethod(BaseModel):
    """Delivery / shipping method configurable from the admin panel"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Display name (e.g. Free Delivery, FedEx Express)
    description: Optional[str] = None  # e.g. Delivery in 7-14 business days
    cost: float = 0.0
    estimated_days: Optional[str] = None
    enabled: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShippingMethodCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cost: float = 0.0
    estimated_days: Optional[str] = None
    enabled: bool = True
    order: int = 0


class SocialLink(BaseModel):
    """Social media link"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    platform: str  # facebook, instagram, twitter, whatsapp
    url: str
    icon: Optional[str] = None
    enabled: bool = True


class SocialLinkCreate(BaseModel):
    platform: str
    url: str
    icon: Optional[str] = None
    enabled: bool = True


class ExternalLink(BaseModel):
    """External link with title"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    url: str
    enabled: bool = True
    order: int = 0


class ExternalLinkCreate(BaseModel):
    title: str
    url: str
    enabled: bool = True


class FloatingAnnouncement(BaseModel):
    """Floating announcement (Shein-style popup)"""
    model_config = ConfigDict(extra="ignore")
    id: str = "floating_announcement"  # Single document
    enabled: bool = False
    title: Optional[str] = None
    message: str
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    button_color: str = "#d4af37"
    frequency: str = "once_per_session"  # once_per_session, every_visit, daily
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FloatingAnnouncementUpdate(BaseModel):
    enabled: Optional[bool] = None
    title: Optional[str] = None
    message: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    button_color: Optional[str] = None
    frequency: Optional[str] = None


class BulkEmail(BaseModel):
    """Bulk email/newsletter"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subject: str
    message: str
    sent_to: int = 0
    sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BulkEmailCreate(BaseModel):
    subject: str
    message: str
    recipient_filter: str = "all"  # all, customers_with_orders, etc.


class GoogleAnalyticsSettings(BaseModel):
    """Google Analytics configuration with privacy"""
    model_config = ConfigDict(extra="ignore")
    enabled: bool = False
    tracking_id: str = ""  # GA4 Measurement ID (G-XXXXXXXXXX)
    anonymize_ip: bool = True
    disable_advertising: bool = True
    cookie_consent_required: bool = True
    

class AdminSettings(BaseModel):
    """Complete admin settings"""
    model_config = ConfigDict(extra="ignore")
    id: str = "admin_settings"  # Single document
    payment_gateways: List[PaymentGatewaySettings] = []
    social_links: List[SocialLink] = []
    external_links: List[ExternalLink] = []
    floating_announcement: Optional[FloatingAnnouncement] = None
    google_analytics: Optional[GoogleAnalyticsSettings] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



# ==================== TEAM MANAGEMENT ====================

class AdminPermissions(BaseModel):
    """Admin user permissions"""
    model_config = ConfigDict(extra="ignore")
    manage_products: bool = True
    manage_orders: bool = True
    manage_customers: bool = True
    manage_coupons: bool = True
    manage_settings: bool = True
    manage_team: bool = False  # Only super admin can manage team


class AdminUser(BaseModel):
    """Admin user with permissions"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "admin"
    is_super_admin: bool = False  # Super admin has all permissions
    permissions: AdminPermissions = Field(default_factory=AdminPermissions)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    is_super_admin: bool = False
    permissions: Optional[AdminPermissions] = None


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[AdminPermissions] = None
    password: Optional[str] = None  # Optional password update

