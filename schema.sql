PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK(role IN ('customer','admin')),
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
idx_sessions_token_hash
ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT
    REFERENCES categories(id)
    ON DELETE SET NULL,
  title TEXT NOT NULL,
  chinese_title TEXT,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  mix_eligible INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
idx_products_category
ON products(category_id);

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL
    REFERENCES products(id)
    ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  discount_type TEXT NOT NULL
    CHECK(discount_type IN ('flat','percent')),
  value INTEGER NOT NULL,
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
  user_id TEXT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  voucher_id TEXT NOT NULL
    REFERENCES vouchers(id)
    ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  used_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, voucher_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  user_id TEXT
    REFERENCES users(id)
    ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  pickup_date TEXT NOT NULL,
  pickup_time TEXT NOT NULL,
  note TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  voucher_id TEXT
    REFERENCES vouchers(id)
    ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'manual_qr',
  payment_status TEXT NOT NULL DEFAULT 'checking'
    CHECK(payment_status IN ('checking','paid','rejected')),
  order_status TEXT NOT NULL DEFAULT 'new'
    CHECK(order_status IN (
      'new',
      'confirmed',
      'preparing',
      'ready',
      'completed',
      'cancelled'
    )),
  receipt_key TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
idx_orders_user
ON orders(user_id);

CREATE INDEX IF NOT EXISTS
idx_orders_created
ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE,
  product_id TEXT
    REFERENCES products(id)
    ON DELETE SET NULL,
  product_title TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  bundle_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  order_id TEXT
    REFERENCES orders(id)
    ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings(
  key,
  value
)
VALUES
('bank_name',''),
('account_name','LAYOR DESSERT'),
('account_number',''),
('payment_qr_key',''),
('points_enabled','1'),
('points_per_rm','1');
