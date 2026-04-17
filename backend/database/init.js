const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, 'ecommerce.db');

const initializeDatabase = () => {
    // Connect to existing DB or create new
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    console.log('Resetting database schema...');

    // Disable FKs to allow dropping tables in any order
    db.pragma('foreign_keys = OFF');

    const tables = [
      'order_items', 'order_tracking', 'reviews', 'transactions', 'support_messages',
      'support_tickets', 'notifications', 'wishlists', 'coupon_usage', 'coupons',
      'promotions', 'cart_items', 'carts', 'orders', 'product_variants', 'product_images',
      'products', 'categories', 'inventory_logs', 'shop_payment_methods',
      'customer_addresses', 'customers', 'shops', 'admins', 'password_reset_tokens', 'users'
    ];

    db.prepare('BEGIN TRANSACTION').run();
    try {
      for (const table of tables) {
        db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
      }
      db.prepare('COMMIT').run();
      console.log('Dropped all existing tables.');
    } catch (err) {
      db.prepare('ROLLBACK').run();
      console.error('Error dropping tables:', err);
      process.exit(1);
    }

    // Re-enable FKs
    db.pragma('foreign_keys = ON');

    console.log('Creating database schema...\n');
    const schema = `
    -- =============================================
    -- USERS & AUTHENTICATION
    -- =============================================
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'shop', 'customer')) NOT NULL DEFAULT 'customer',
        status TEXT CHECK(status IN ('active', 'inactive', 'banned')) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        avatar TEXT,
        date_of_birth DATE,
        gender TEXT CHECK(gender IN ('male', 'female', 'other')),
        membership_level TEXT CHECK(membership_level IN ('bronze', 'silver', 'gold', 'platinum')) DEFAULT 'bronze',
        points INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS customer_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        address_name TEXT,
        recipient_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        province TEXT NOT NULL,
        district TEXT NOT NULL,
        ward TEXT NOT NULL,
        street_address TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        shop_name TEXT NOT NULL,
        slug TEXT UNIQUE,
        description TEXT,
        logo TEXT,
        banner TEXT,
        phone TEXT,
        email TEXT,
        province TEXT,
        district TEXT,
        ward TEXT,
        street_address TEXT,
        rating REAL DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        total_products INTEGER DEFAULT 0,
        total_sold INTEGER DEFAULT 0,
        wallet_balance REAL DEFAULT 0,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'suspended')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        avatar TEXT,
        department TEXT,
        position TEXT,
        permissions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    -- =============================================
    -- PRODUCTS & CATEGORIES
    -- =============================================
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        image TEXT,
        parent_id INTEGER,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL,
        category_id INTEGER,
        name TEXT NOT NULL,
        slug TEXT,
        description TEXT,
        short_description TEXT,
        price REAL NOT NULL,
        original_price REAL,
        sku TEXT,
        stock_quantity INTEGER DEFAULT 0,
        sold_quantity INTEGER DEFAULT 0,
        weight REAL,
        dimensions TEXT,
        rating REAL DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        tags TEXT,
        is_featured INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        sku TEXT,
        price REAL,
        stock_quantity INTEGER DEFAULT 0,
        attributes TEXT,
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    -- =============================================
    -- CART & ORDERS
    -- =============================================
    CREATE TABLE IF NOT EXISTS carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
        UNIQUE(cart_id, product_id, variant_id)
    );
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER NOT NULL,
        shop_id INTEGER NOT NULL,
        status TEXT CHECK(status IN ('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled', 'refunded')) DEFAULT 'pending',
        payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
        payment_method TEXT CHECK(payment_method IN ('cod', 'bank_transfer', 'credit_card', 'e_wallet')) DEFAULT 'cod',
        subtotal REAL NOT NULL,
        shipping_fee REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        shipping_address TEXT NOT NULL,
        note TEXT,
        cancelled_reason TEXT,
        cancelled_by TEXT CHECK(cancelled_by IN ('customer', 'shop', 'admin')),
        confirmed_at DATETIME,
        shipped_at DATETIME,
        delivered_at DATETIME,
        cancelled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (shop_id) REFERENCES shops(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        product_name TEXT NOT NULL,
        variant_name TEXT,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        total REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS order_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        description TEXT,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    -- =============================================
    -- REVIEWS & RATINGS
    -- =============================================
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        order_id INTEGER,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        images TEXT,
        is_anonymous INTEGER DEFAULT 0,
        shop_reply TEXT,
        shop_replied_at DATETIME,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );
    -- =============================================
    -- PROMOTIONS & COUPONS
    -- =============================================
    CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT CHECK(type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping')) NOT NULL,
        value REAL NOT NULL,
        min_order_amount REAL,
        max_discount_amount REAL,
        usage_limit INTEGER,
        used_count INTEGER DEFAULT 0,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_by TEXT CHECK(created_by IN ('admin', 'shop')) DEFAULT 'shop',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promotion_id INTEGER NOT NULL,
        code TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS coupon_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        discount_amount REAL NOT NULL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coupon_id) REFERENCES coupons(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
    );
    -- =============================================
    -- WISHLIST
    -- =============================================
    CREATE TABLE IF NOT EXISTS wishlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE(customer_id, product_id)
    );
    -- =============================================
    -- NOTIFICATIONS
    -- =============================================
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT CHECK(type IN ('order', 'promotion', 'system', 'review', 'support')) DEFAULT 'system',
        data TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    -- =============================================
    -- SUPPORT TICKETS
    -- =============================================
    CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        shop_id INTEGER,
        order_id INTEGER,
        subject TEXT NOT NULL,
        category TEXT CHECK(category IN ('order', 'payment', 'product', 'shipping', 'account', 'other')) NOT NULL,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
        status TEXT CHECK(status IN ('open', 'in_progress', 'waiting_customer', 'waiting_shop', 'resolved', 'closed')) DEFAULT 'open',
        assigned_to INTEGER,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        rating_comment TEXT,
        auto_close_warned INTEGER DEFAULT 0,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES admins(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS support_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        attachments TEXT,
        is_system INTEGER DEFAULT 0,
        read_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS typing_status (
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_typing INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (ticket_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS canned_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        response TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );
    -- =============================================
    -- TRANSACTIONS & PAYMENTS
    -- =============================================
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_number TEXT UNIQUE NOT NULL,
        order_id INTEGER,
        user_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('payment', 'refund', 'withdrawal', 'commission', 'bonus')) NOT NULL,
        amount REAL NOT NULL,
        fee REAL DEFAULT 0,
        status TEXT CHECK(status IN ('pending', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
        payment_method TEXT,
        payment_details TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS shop_payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('bank_account', 'e_wallet')) NOT NULL,
        bank_name TEXT,
        account_number TEXT,
        account_name TEXT,
        wallet_type TEXT,
        wallet_id TEXT,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );
    -- =============================================
    -- INVENTORY
    -- =============================================
    CREATE TABLE IF NOT EXISTS inventory_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        type TEXT CHECK(type IN ('in', 'out', 'adjustment')) NOT NULL,
        quantity INTEGER NOT NULL,
        reference_type TEXT CHECK(reference_type IN ('order', 'return', 'manual', 'import')) NOT NULL,
        reference_id INTEGER,
        note TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    -- =============================================
    -- INDEXES FOR PERFORMANCE
    -- =============================================
    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status, is_active);
    CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
    `;

    db.exec(schema);
    console.log('Database schema created successfully!');

    // Migration: add read_at column to support_messages if it doesn't exist
    try {
        const columns = db.prepare("PRAGMA table_info(support_messages)").all();
        const hasReadAt = columns.some(col => col.name === 'read_at');
        if (!hasReadAt) {
            db.prepare("ALTER TABLE support_messages ADD COLUMN read_at DATETIME DEFAULT NULL").run();
            console.log('Migration: added read_at column to support_messages.');
        }
    } catch (err) {
        console.log('Migration note (read_at):', err.message);
    }

    console.log('Database file:', dbPath);
    console.log('\nRun "npm run seed" to add sample data.');
    db.close();
};

if (require.main === module) {
    initializeDatabase();
}

module.exports = initializeDatabase;
