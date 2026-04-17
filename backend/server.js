const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// DB Imports
const db = require('./config/database');
const { testConnection } = require('./config/database');
const initializeDatabase = require('./database/init');
const seedData = require('./seeds/seed');

// Routes Imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const shopRoutes = require('./routes/shops');
const reviewRoutes = require('./routes/reviews');
const promotionRoutes = require('./routes/promotions');
const notificationRoutes = require('./routes/notifications');
const supportRoutes = require('./routes/support');
const adminRoutes = require('./routes/admin');
const inventoryRoutes = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 5000;

// Production safety: fail hard if critical secrets missing
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production.');
  process.exit(1);
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; " +
    "script-src 'self' 'unsafe-inline'; font-src 'self' data: https:; connect-src 'self' https:;"
  );
  next();
});

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5000', 'http://localhost:3000', 'http://127.0.0.1:5000'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(null, true); // Allow for development; restrict in production
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inventory', inventoryRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'E-Commerce API',
    version: '1.0.0',
    database: 'SQLite (No installation required)',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new customer',
        'POST /api/auth/register-shop': 'Register new shop',
        'POST /api/auth/login': 'Login',
        'GET /api/auth/me': 'Get current user (requires auth)',
        'PUT /api/auth/change-password': 'Change password (requires auth)',
        'POST /api/auth/forgot-password': 'Request password reset'
      },
      products: {
        'GET /api/products': 'Get all products',
        'GET /api/products/:id': 'Get single product',
        'GET /api/products/shop/my-products': 'Get shop products (shop only)',
        'POST /api/products': 'Create product (shop only)',
        'PUT /api/products/:id': 'Update product (shop only)',
        'DELETE /api/products/:id': 'Delete product (shop only)',
        'PATCH /api/products/:id/status': 'Update product status (admin only)'
      },
      categories: {
        'GET /api/categories': 'Get all categories',
        'GET /api/categories/tree': 'Get category tree',
        'GET /api/categories/:id': 'Get single category',
        'POST /api/categories': 'Create category (admin only)',
        'PUT /api/categories/:id': 'Update category (admin only)',
        'DELETE /api/categories/:id': 'Delete category (admin only)'
      },
      cart: {
        'GET /api/cart': 'Get cart (customer only)',
        'POST /api/cart/items': 'Add to cart (customer only)',
        'PUT /api/cart/items/:id': 'Update cart item (customer only)',
        'DELETE /api/cart/items/:id': 'Remove from cart (customer only)',
        'DELETE /api/cart': 'Clear cart (customer only)'
      },
      orders: {
        'POST /api/orders': 'Create order (customer only)',
        'GET /api/orders/my-orders': 'Get customer orders (customer only)',
        'GET /api/orders/:id': 'Get order details',
        'POST /api/orders/:id/cancel': 'Cancel order (customer only)',
        'GET /api/orders/shop/orders': 'Get shop orders (shop only)',
        'PATCH /api/orders/:id/status': 'Update order status (shop only)',
        'GET /api/orders': 'Get all orders (admin only)'
      },
      customers: {
        'GET /api/customers/profile': 'Get profile (customer only)',
        'PUT /api/customers/profile': 'Update profile (customer only)',
        'GET /api/customers/addresses': 'Get addresses (customer only)',
        'POST /api/customers/addresses': 'Add address (customer only)',
        'PUT /api/customers/addresses/:id': 'Update address (customer only)',
        'DELETE /api/customers/addresses/:id': 'Delete address (customer only)',
        'GET /api/customers/wishlist': 'Get wishlist (customer only)',
        'POST /api/customers/wishlist': 'Add to wishlist (customer only)',
        'DELETE /api/customers/wishlist/:productId': 'Remove from wishlist (customer only)',
        'GET /api/customers': 'Get all customers (admin only)',
        'PATCH /api/customers/:id/status': 'Update customer status (admin only)'
      },
      shops: {
        'GET /api/shops': 'Get all shops',
        'GET /api/shops/public/:id': 'Get public shop info',
        'GET /api/shops/profile': 'Get shop profile (shop only)',
        'PUT /api/shops/profile': 'Update shop profile (shop only)',
        'GET /api/shops/dashboard': 'Get shop dashboard (shop only)',
        'GET /api/shops/finance': 'Get shop finance (shop only)',
        'GET /api/shops/admin/all': 'Get all shops (admin only)',
        'PATCH /api/shops/:id/status': 'Update shop status (admin only)'
      },
      reviews: {
        'GET /api/reviews/product/:productId': 'Get product reviews',
        'POST /api/reviews': 'Create review (customer only)',
        'PUT /api/reviews/:id': 'Update review (customer only)',
        'DELETE /api/reviews/:id': 'Delete review (customer only)',
        'GET /api/reviews/shop/reviews': 'Get shop reviews (shop only)',
        'POST /api/reviews/:id/reply': 'Reply to review (shop only)',
        'GET /api/reviews': 'Get all reviews (admin only)',
        'PATCH /api/reviews/:id/status': 'Update review status (admin only)'
      },
      promotions: {
        'GET /api/promotions/active': 'Get active promotions',
        'POST /api/promotions/validate-coupon': 'Validate coupon (customer only)',
        'GET /api/promotions/shop/promotions': 'Get shop promotions (shop only)',
        'POST /api/promotions/shop/promotions': 'Create promotion (shop only)',
        'PUT /api/promotions/shop/promotions/:id': 'Update promotion (shop only)',
        'DELETE /api/promotions/shop/promotions/:id': 'Delete promotion (shop only)',
        'GET /api/promotions': 'Get all promotions (admin only)',
        'POST /api/promotions/system': 'Create system promotion (admin only)'
      },
      notifications: {
        'GET /api/notifications': 'Get notifications',
        'PATCH /api/notifications/:id/read': 'Mark as read',
        'PATCH /api/notifications/read-all': 'Mark all as read',
        'DELETE /api/notifications/:id': 'Delete notification',
        'POST /api/notifications/send': 'Send notification (admin only)',
        'POST /api/notifications/send-bulk': 'Send bulk notification (admin only)'
      },
      support: {
        'POST /api/support/tickets': 'Create ticket',
        'GET /api/support/tickets': 'Get user tickets',
        'GET /api/support/tickets/:id': 'Get ticket details',
        'POST /api/support/tickets/:id/messages': 'Add message',
        'POST /api/support/tickets/:id/close': 'Close ticket',
        'GET /api/support/admin/tickets': 'Get all tickets (admin only)',
        'PATCH /api/support/admin/tickets/:id': 'Update ticket (admin only)',
        'GET /api/support/admin/stats': 'Get support stats (admin only)'
      },
      admin: {
        'GET /api/admin/dashboard': 'Get admin dashboard',
        'GET /api/admin/reports': 'Get reports',
        'GET /api/admin/finance': 'Get system finance',
        'GET /api/admin/pending-counts': 'Get pending approval counts',
        'GET /api/admin/permissions/roles': 'Get permission roles',
        'GET /api/admin/permissions/list': 'Get available permissions',
        'GET /api/admin/permissions/admins': 'Get all admins',
        'PATCH /api/admin/permissions/admins/:id': 'Update admin permissions',
        'POST /api/admin/permissions/admins/:id/apply-role': 'Apply role template'
      },
      inventory: {
        'GET /api/inventory/logs': 'Get inventory logs (shop/admin)',
        'POST /api/inventory/adjustment': 'Add stock adjustment (shop/admin)',
        'GET /api/inventory/alerts': 'Get low stock alerts (shop/admin)',
        'GET /api/inventory/summary': 'Get inventory summary (shop/admin)',
        'GET /api/inventory/report': 'Export inventory report (shop/admin)'
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const startServer = () => {
    // Check if tables exist (products table is critical)
    // This handles Render's ephemeral filesystem where DB might exist as file but be empty
  try {
    const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='products'").get();
    
    if (tableCheck.count === 0) {
      console.log('Database/Products table not found. Starting automatic initialization...');
      initializeDatabase();
      seedData();
      console.log('Database initialized and seeded successfully.');
    } else {
        console.log('Database verification successful: Products table found.');
    }
  } catch (error) {
    console.error('Error checking database state:', error);
    // Fallback: try to init if check fails
    try {
        initializeDatabase();
        seedData();
    } catch (e) {
        console.error('Fatal: Could not initialize database:', e);
        process.exit(1);
    }
  }

  const dbConnected = testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database.');
    process.exit(1);
  }

  // Auto-migrate: ensure read_at column exists
  try {
    const cols = db.prepare('PRAGMA table_info(support_messages)').all();
    if (!cols.some(c => c.name === 'read_at')) {
      db.prepare('ALTER TABLE support_messages ADD COLUMN read_at DATETIME DEFAULT NULL').run();
      console.log('Migration: added read_at column to support_messages.');
    }
  } catch(e) {}

  // Auto-migrate: cart_items.price_at_add (snapshot to prevent bait-and-switch)
  try {
    const cols = db.prepare('PRAGMA table_info(cart_items)').all();
    if (!cols.some(c => c.name === 'price_at_add')) {
      db.prepare('ALTER TABLE cart_items ADD COLUMN price_at_add REAL').run();
      db.prepare(`UPDATE cart_items
                     SET price_at_add = (SELECT price FROM products WHERE id = cart_items.product_id)
                   WHERE price_at_add IS NULL`).run();
      console.log('Migration: added price_at_add column to cart_items.');
    }
  } catch(e) { console.error('Cart snapshot migration failed:', e.message); }

  // Auto-migrate: audit_logs table (admin action tracking)
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER,
        payload TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id)').run();
  } catch(e) { console.error('Audit log migration failed:', e.message); }
  
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     E-Commerce API Server (SQLite)                        ║
║                                                           ║
║     Server running at: http://localhost:${PORT}           ║
║     API Docs: http://localhost:${PORT}/api                ║
║     Health Check: http://localhost:${PORT}/api/health     ║
║                                                           ║
║     No database installation required!                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
};

startServer();
