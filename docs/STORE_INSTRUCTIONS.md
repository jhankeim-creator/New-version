# LuxeBoutique - Fashion & Jewelry E-Commerce Store

## 🎉 Your Store is Live!

Visit your store at: **https://luxury-shop-11.preview.emergentagent.com**

---

## 🔐 Admin Access

**Admin Dashboard:** https://luxury-shop-11.preview.emergentagent.com/admin

**Admin Credentials:**
- Email: `admin@luxeboutique.com`
- Password: `admin123`

⚠️ **IMPORTANT:** Change the admin password immediately after first login!

---

## 🛠️ How to Customize Your Store

### 1. **Change Store Name & Branding**

Edit `/app/frontend/src/components/Navbar.jsx` and `/app/frontend/src/components/Footer.jsx`:
- Replace "LuxeBoutique" with your store name
- Update colors by changing `#d4af37` (gold) to your brand color

### 2. **Update WhatsApp Number**

Edit these files and replace `+1234567890` with your WhatsApp number:
- `/app/frontend/src/components/WhatsAppButton.jsx`
- `/app/frontend/src/components/Footer.jsx`
- `/app/frontend/src/pages/OrderSuccessPage.jsx`

### 3. **Add/Edit Products**

Two ways to manage products:

**Option A - Through Admin Dashboard (Recommended):**
1. Login to admin dashboard
2. Go to "Products" tab
3. Click "Add Product" button
4. Fill in product details and save

**Option B - Directly in Database:**
Run the database initialization script with your products:
```bash
cd /app/backend
python init_db.py
```

### 4. **Configure Payment Gateways**

#### Stripe Setup:
1. Get your Stripe API keys from https://stripe.com
2. Add to `/app/backend/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   ```

#### Binance Pay Setup:
1. Get API keys from Binance Pay merchant portal
2. Add to `/app/backend/.env`:
   ```
   BINANCE_API_KEY=your_api_key
   BINANCE_API_SECRET=your_secret
   ```

#### Plisio Setup:
1. Get API key from https://plisio.net
2. Add to `/app/backend/.env`:
   ```
   PLISIO_API_KEY=your_api_key
   ```

**Note:** Current implementation includes payment method UI. You'll need to integrate the actual payment APIs based on their documentation.

### 5. **Update Manual Payment Instructions**

Edit `/app/frontend/src/pages/OrderSuccessPage.jsx` around line 65-80:
- Add your bank details
- Add your crypto wallet addresses

### 6. **Customize Colors**

Main brand color is defined as `#d4af37` (gold). Search and replace in these files:
- `/app/frontend/src/App.css`
- `/app/frontend/src/components/*.jsx`
- `/app/frontend/src/pages/*.jsx`

### 7. **Add Your Logo**

1. Place your logo in `/app/frontend/public/`
2. Update `/app/frontend/src/components/Navbar.jsx` to use your logo image

### 8. **Change Admin Password**

Via Admin Dashboard:
1. Login as admin
2. Create a new admin user with your email
3. Delete the default admin account

Or via MongoDB:
```bash
cd /app/backend
python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('YOUR_NEW_PASSWORD'))"
```
Then update in database.

---

## 📦 Managing Your Store

### Products Management
- **Add Products:** Admin Dashboard → Products → Add Product
- **Edit Products:** Click edit icon on any product
- **Delete Products:** Click trash icon
- **Set Featured:** Check "Featured Product" when adding/editing

### Categories Management
- **Add Category:** Admin Dashboard → Categories → Add Category
- **Slug:** Use lowercase, hyphenated (e.g., "summer-collection")

### Orders Management
- **View Orders:** Admin Dashboard → Orders tab
- **Update Status:** Use dropdowns to change order/payment status
- **View Details:** Click "View Details" on any order

### Customer Accounts
- Customers can register and login to track their orders
- View customer count in admin dashboard stats

---

## 🔧 Technical Details

### Tech Stack
- **Frontend:** React 19 + Tailwind CSS + Shadcn UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Authentication:** JWT tokens

### Important Files
- Backend API: `/app/backend/server.py`
- Frontend App: `/app/frontend/src/App.js`
- Database Init: `/app/backend/init_db.py`

### Environment Variables
- Backend: `/app/backend/.env`
- Frontend: `/app/frontend/.env`

⚠️ **Never commit `.env` files to git!**

### Restart Services
After making changes:
```bash
sudo supervisorctl restart all
```

---

## 📱 Features

### Customer Features
✅ Browse products by category
✅ Product search and filtering
✅ Shopping cart with quantity management
✅ Guest checkout or user accounts
✅ Multiple payment methods
✅ Order tracking
✅ WhatsApp support integration
✅ Responsive mobile design

### Admin Features
✅ Dashboard with statistics
✅ Product management (CRUD)
✅ Category management
✅ Order management
✅ Payment status verification
✅ Inventory tracking
✅ Customer management

---

## 🚀 Next Steps

1. **Customize branding** (name, colors, logo)
2. **Update WhatsApp number**
3. **Change admin password**
4. **Add your products** via admin dashboard
5. **Configure payment gateways** with your API keys
6. **Update payment instructions** for manual payments
7. **Test the complete checkout flow**
8. **Set up email notifications** (optional - requires SendGrid/SMTP)

---

## 🆘 Need Help?

- Check browser console for errors (F12)
- Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
- Check frontend logs: `tail -f /var/log/supervisor/frontend.err.log`

---

## 🎨 Design Credits

The store uses:
- **Fonts:** Playfair Display (headings), Inter (body)
- **Colors:** Gold (#d4af37), Black (#1a1a1a), White (#ffffff)
- **Images:** Unsplash & Pexels (replace with your own)

---

## 📝 Database Sample Data

The store comes pre-loaded with:
- 2 categories (Fashion, Jewelry)
- 9 sample products
- 1 admin user

You can modify the sample data in `/app/backend/init_db.py` and run:
```bash
cd /app/backend
python init_db.py
```

---

**Your professional e-commerce store is ready! 🎉**

Happy selling! 💰
