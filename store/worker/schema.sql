-- D1 schema. Apply once with:
--   npx wrangler d1 execute store --remote --file=worker/schema.sql
CREATE TABLE IF NOT EXISTS claims (claim TEXT PRIMARY KEY, order_id INTEGER, license_key TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders (order_id INTEGER PRIMARY KEY, variant_id INTEGER, refunded INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
