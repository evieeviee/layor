PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    category_id TEXT,
    title TEXT NOT NULL,
    chinese_title TEXT,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 0,
    mix_eligible INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    object_key TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    discount_type TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    min_spend_cents INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    new_user_only INTEGER NOT NULL DEFAULT 0,
    auto_assign_new_user INTEGER NOT NULL DEFAULT 0,
    valid_days INTEGER NOT NULL DEFAULT 14,
    starts_at TEXT,
    ends_at TEXT,
    usage_limit_per_customer INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_vouchers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    voucher_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    used_count INTEGER NOT NULL DEFAULT 0,
    used_at TEXT,
    order_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    UNIQUE(user_id, voucher_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,

    user_id TEXT,

    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT NOT NULL,

    pickup_date TEXT NOT NULL,
    pickup_time TEXT NOT NULL,
    note TEXT,

    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,

    voucher_id TEXT,

    payment_method TEXT NOT NULL DEFAULT 'manual',
    payment_status TEXT NOT NULL DEFAULT 'checking',
    receipt_key TEXT,

    order_status TEXT NOT NULL DEFAULT 'new',

    points_awarded INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT,
    product_title TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    line_total_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS points_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_id TEXT,
    delta INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings
(key, value)
VALUES
('bank_name', '');

INSERT OR IGNORE INTO settings
(key, value)
VALUES
('account_name', 'LAYOR DESSERT');

INSERT OR IGNORE INTO settings
(key, value)
VALUES
('account_number', '');

INSERT OR IGNORE INTO settings
(key, value)
VALUES
('payment_qr_key', '');

INSERT OR IGNORE INTO settings
(key, value)
VALUES
('points_enabled', '1');

INSERT OR IGNORE INTO settings
(key, value)
VALUES
('points_per_rm', '1');

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
ON sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_categories_active
ON categories(active);

CREATE INDEX IF NOT EXISTS idx_products_category_id
ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_active
ON products(active);

CREATE INDEX IF NOT EXISTS idx_products_featured
ON products(featured);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_vouchers_active
ON vouchers(active);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_user_id
ON customer_vouchers(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_voucher_id
ON customer_vouchers(voucher_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id
ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_order_status
ON orders(order_status);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
ON orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user_id
ON points_ledger(user_id);
