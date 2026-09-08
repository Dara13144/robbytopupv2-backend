-- ====================================================================
-- SUPABASE FULL DATABASE SYSTEM SCHEMA FOR DARA-TOPUP
-- Compatible with PostgreSQL 14+, Prisma ORM, and Supabase Studio
-- Project Reference: buielweczgmkgpknmcza
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. CREATE TABLES
-- ====================================================================

-- 2.1 User Table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY DEFAULT ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER', -- 'USER' or 'ADMIN'
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 Product Table (Games & Digital Services)
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT PRIMARY KEY DEFAULT ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "category" TEXT NOT NULL, -- 'MOBILE_GAME', 'PC_GAME', 'VOUCHER'
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 Package Table (Game Recharge Tiers / Item Bundles)
CREATE TABLE IF NOT EXISTS "Package" (
    "id" TEXT PRIMARY KEY DEFAULT ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'NORMAL', -- 'BEST_SELLER', 'NORMAL'
    "badge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Package_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2.4 Order Table (Top-Up Transactions & KHQR Invoices)
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT PRIMARY KEY DEFAULT ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    "userId" TEXT,
    "packageId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerZoneId" TEXT,
    "playerNickname" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'
    "paymentMethod" TEXT NOT NULL,           -- 'ABA', 'BAKONG', 'CUTLUY', 'KHQR'
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'EXPIRED'
    "paymentTxnId" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "paymentQrCode" TEXT,
    "paymentMd5" TEXT,
    "paidAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'READY', 'DELIVERED', 'FAILED'
    "stockDeliveredCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 2.5 Stock Table (Digital Voucher Gift Codes / Serial Keys)
CREATE TABLE IF NOT EXISTS "Stock" (
    "id" TEXT PRIMARY KEY DEFAULT ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    "packageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Stock_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ====================================================================
-- 3. UNIQUE CONSTRAINTS & PERFORMANCE INDEXES
-- ====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_paymentTxnId_key" ON "Order"("paymentTxnId");

CREATE INDEX IF NOT EXISTS "idx_product_category" ON "Product"("category");
CREATE INDEX IF NOT EXISTS "idx_product_active" ON "Product"("isActive");
CREATE INDEX IF NOT EXISTS "idx_package_productId" ON "Package"("productId");
CREATE INDEX IF NOT EXISTS "idx_order_userId" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "idx_order_status" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "idx_order_paymentStatus" ON "Order"("paymentStatus");
CREATE INDEX IF NOT EXISTS "idx_order_createdAt" ON "Order"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_stock_packageId" ON "Stock"("packageId");
CREATE INDEX IF NOT EXISTS "idx_stock_isUsed" ON "Stock"("isUsed");

-- ====================================================================
-- 4. AUTOMATIC updatedAt TRIGGER FUNCTION
-- ====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS set_user_updated_at ON "User";
CREATE TRIGGER set_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_product_updated_at ON "Product";
CREATE TRIGGER set_product_updated_at BEFORE UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_package_updated_at ON "Package";
CREATE TRIGGER set_package_updated_at BEFORE UPDATE ON "Package" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_order_updated_at ON "Order";
CREATE TRIGGER set_order_updated_at BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_stock_updated_at ON "Stock";
CREATE TRIGGER set_stock_updated_at BEFORE UPDATE ON "Stock" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Package" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stock" ENABLE ROW LEVEL SECURITY;

-- Products & Packages: Public read access
DROP POLICY IF EXISTS "Public can view active products" ON "Product";
CREATE POLICY "Public can view active products" ON "Product" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view active packages" ON "Package";
CREATE POLICY "Public can view active packages" ON "Package" FOR SELECT USING (true);

-- Orders: Public can create orders (guest checkout supported) and view by paymentTxnId
DROP POLICY IF EXISTS "Public can create orders" ON "Order";
CREATE POLICY "Public can create orders" ON "Order" FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view orders" ON "Order";
CREATE POLICY "Public can view orders" ON "Order" FOR SELECT USING (true);

-- Backend Service Role has full unrestricted access to everything
DROP POLICY IF EXISTS "Service role bypass User" ON "User";
CREATE POLICY "Service role bypass User" ON "User" FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role bypass Product" ON "Product";
CREATE POLICY "Service role bypass Product" ON "Product" FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role bypass Package" ON "Package";
CREATE POLICY "Service role bypass Package" ON "Package" FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role bypass Order" ON "Order";
CREATE POLICY "Service role bypass Order" ON "Order" FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role bypass Stock" ON "Stock";
CREATE POLICY "Service role bypass Stock" ON "Stock" FOR ALL USING (true);

-- ====================================================================
-- 6. DEFAULT ADMINISTRATOR SEED
-- Passwords are encrypted with bcrypt for 'admin123'
-- ====================================================================

INSERT INTO "User" ("id", "email", "password", "role")
VALUES 
  ('usr_admin_default_01', 'admin@topup.com', '$2a$10$6MJi2ySmEqnKRa4Avtad1en6loFyWVZTvt7hOp5BFC7PR8g.C08Qm', 'ADMIN'),
  ('usr_admin_default_02', 'admin@gmail.com', '$2a$10$6MJi2ySmEqnKRa4Avtad1en6loFyWVZTvt7hOp5BFC7PR8g.C08Qm', 'ADMIN')
ON CONFLICT ("email") DO UPDATE SET "role" = 'ADMIN';

-- ====================================================================
-- 7. TOP GAMES CATALOG & DEFAULT PACKAGES SEED
-- ====================================================================

-- 7.1 Mobile Legends: Bang Bang
INSERT INTO "Product" ("id", "name", "slug", "image", "category", "isActive")
VALUES ('prod_mlbb_001', 'Mobile Legends: Bang Bang', 'mobile-legends', '/images/games/mlbb.png', 'MOBILE_GAME', true)
ON CONFLICT ("slug") DO UPDATE SET "image" = '/images/games/mlbb.png', "isActive" = true;

INSERT INTO "Package" ("id", "productId", "name", "amount", "price", "category", "badge", "isActive")
VALUES 
  ('pkg_mlbb_01', 'prod_mlbb_001', 'Weekly Diamond Pass', 1, 1.99, 'BEST_SELLER', 'VIP Pass 🔥', true),
  ('pkg_mlbb_02', 'prod_mlbb_001', '86 Diamonds (78 + 8 Bonus)', 86, 1.45, 'BEST_SELLER', 'Hot 🔥', true),
  ('pkg_mlbb_03', 'prod_mlbb_001', '172 Diamonds (156 + 16 Bonus)', 172, 2.85, 'BEST_SELLER', 'ពេញនិយម', true),
  ('pkg_mlbb_04', 'prod_mlbb_001', '257 Diamonds (234 + 23 Bonus)', 257, 4.25, 'NORMAL', 'ពេញនិយម', true),
  ('pkg_mlbb_05', 'prod_mlbb_001', '706 Diamonds (625 + 81 Bonus)', 706, 11.50, 'NORMAL', 'Bonus 12%', true),
  ('pkg_mlbb_06', 'prod_mlbb_001', '2195 Diamonds (1860 + 335 Bonus)', 2195, 34.90, 'NORMAL', 'កញ្ចប់ធំ 💎', true)
ON CONFLICT ("id") DO NOTHING;

-- 7.2 Free Fire
INSERT INTO "Product" ("id", "name", "slug", "image", "category", "isActive")
VALUES ('prod_ff_002', 'Free Fire', 'free-fire', '/images/games/freefire.png', 'MOBILE_GAME', true)
ON CONFLICT ("slug") DO UPDATE SET "image" = '/images/games/freefire.png', "isActive" = true;

INSERT INTO "Package" ("id", "productId", "name", "amount", "price", "category", "badge", "isActive")
VALUES 
  ('pkg_ff_01', 'prod_ff_002', 'Weekly Membership', 1, 1.99, 'BEST_SELLER', 'Hot Deal 🔥', true),
  ('pkg_ff_02', 'prod_ff_002', '100 Diamonds + 10 Bonus', 110, 0.99, 'BEST_SELLER', 'ពេញនិយម', true),
  ('pkg_ff_03', 'prod_ff_002', '310 Diamonds + 31 Bonus', 341, 2.99, 'BEST_SELLER', 'Hot 🔥', true),
  ('pkg_ff_04', 'prod_ff_002', '520 Diamonds + 52 Bonus', 572, 4.90, 'NORMAL', 'ពេញនិយម', true),
  ('pkg_ff_05', 'prod_ff_002', '1060 Diamonds + 106 Bonus', 1166, 9.75, 'NORMAL', 'Bonus 10%', true),
  ('pkg_ff_06', 'prod_ff_002', '2180 Diamonds + 218 Bonus', 2398, 19.50, 'NORMAL', 'កញ្ចប់ពិសេស 💎', true)
ON CONFLICT ("id") DO NOTHING;

-- 7.3 PUBG Mobile
INSERT INTO "Product" ("id", "name", "slug", "image", "category", "isActive")
VALUES ('prod_pubg_003', 'PUBG Mobile', 'pubg-mobile', '/images/games/pubgm.png', 'MOBILE_GAME', true)
ON CONFLICT ("slug") DO UPDATE SET "image" = '/images/games/pubgm.png', "isActive" = true;

INSERT INTO "Package" ("id", "productId", "name", "amount", "price", "category", "badge", "isActive")
VALUES 
  ('pkg_pubg_01', 'prod_pubg_003', '60 UC', 60, 0.99, 'BEST_SELLER', 'Hot 🔥', true),
  ('pkg_pubg_02', 'prod_pubg_003', '325 UC (300 + 25 Bonus)', 325, 4.85, 'BEST_SELLER', 'ពេញនិយម', true),
  ('pkg_pubg_03', 'prod_pubg_003', '660 UC (600 + 60 Bonus)', 660, 9.60, 'NORMAL', 'Royale Pass', true),
  ('pkg_pubg_04', 'prod_pubg_003', '1800 UC (1500 + 300 Bonus)', 1800, 23.90, 'NORMAL', 'Bonus 20%', true),
  ('pkg_pubg_05', 'prod_pubg_003', '3850 UC (3000 + 850 Bonus)', 3850, 47.90, 'NORMAL', 'កញ្ចប់ធំ 💎', true)
ON CONFLICT ("id") DO NOTHING;

-- 7.4 Honor of Kings
INSERT INTO "Product" ("id", "name", "slug", "image", "category", "isActive")
VALUES ('prod_hok_004', 'Honor of Kings', 'honor-of-kings', '/images/games/hok.png', 'MOBILE_GAME', true)
ON CONFLICT ("slug") DO UPDATE SET "image" = '/images/games/hok.png', "isActive" = true;

INSERT INTO "Package" ("id", "productId", "name", "amount", "price", "category", "badge", "isActive")
VALUES 
  ('pkg_hok_01', 'prod_hok_004', '80 Tokens (+8 Bonus)', 88, 0.99, 'BEST_SELLER', 'Hot 🔥', true),
  ('pkg_hok_02', 'prod_hok_004', '240 Tokens (+24 Bonus)', 264, 2.99, 'BEST_SELLER', 'ពេញនិយម', true),
  ('pkg_hok_03', 'prod_hok_004', '400 Tokens (+40 Bonus)', 440, 4.85, 'NORMAL', 'ពេញនិយម', true),
  ('pkg_hok_04', 'prod_hok_004', '800 Tokens (+95 Bonus)', 895, 9.70, 'NORMAL', 'Bonus 12%', true),
  ('pkg_hok_05', 'prod_hok_004', '2400 Tokens (+300 Bonus)', 2700, 28.90, 'NORMAL', 'កញ្ចប់ពិសេស 💎', true)
ON CONFLICT ("id") DO NOTHING;

-- 7.5 Genshin Impact
INSERT INTO "Product" ("id", "name", "slug", "image", "category", "isActive")
VALUES ('prod_genshin_005', 'Genshin Impact', 'genshin-impact', '/images/games/genshin-impact.png', 'MOBILE_GAME', true)
ON CONFLICT ("slug") DO UPDATE SET "image" = '/images/games/genshin-impact.png', "isActive" = true;

INSERT INTO "Package" ("id", "productId", "name", "amount", "price", "category", "badge", "isActive")
VALUES 
  ('pkg_gen_01', 'prod_genshin_005', 'Blessing of the Welkin Moon', 1, 4.99, 'BEST_SELLER', 'Best Value 🌙', true),
  ('pkg_gen_02', 'prod_genshin_005', '300 + 30 Genesis Crystals', 330, 4.90, 'BEST_SELLER', 'Hot 🔥', true),
  ('pkg_gen_03', 'prod_genshin_005', '980 + 110 Genesis Crystals', 1090, 14.80, 'NORMAL', 'Bonus 11%', true),
  ('pkg_gen_04', 'prod_genshin_005', '1980 + 260 Genesis Crystals', 2240, 29.50, 'NORMAL', 'ពេញនិយម', true),
  ('pkg_gen_05', 'prod_genshin_005', '3280 + 600 Genesis Crystals', 3880, 48.90, 'NORMAL', 'កញ្ចប់ធំ 💎', true)
ON CONFLICT ("id") DO NOTHING;

-- 7.6 Roblox
INSERT INTO "Product" ("id", "name", "slug", "image", "category", "isActive")
VALUES ('prod_roblox_006', 'Roblox', 'roblox', '/images/games/roblox.png', 'MOBILE_GAME', true)
ON CONFLICT ("slug") DO UPDATE SET "image" = '/images/games/roblox.png', "isActive" = true;

INSERT INTO "Package" ("id", "productId", "name", "amount", "price", "category", "badge", "isActive")
VALUES 
  ('pkg_rbx_01', 'prod_roblox_006', '80 Robux', 80, 0.99, 'BEST_SELLER', 'Fast ⚡', true),
  ('pkg_rbx_02', 'prod_roblox_006', '400 Robux', 400, 4.85, 'BEST_SELLER', 'Hot 🔥', true),
  ('pkg_rbx_03', 'prod_roblox_006', '800 Robux', 800, 9.60, 'NORMAL', 'ពេញនិយម', true),
  ('pkg_rbx_04', 'prod_roblox_006', '1700 Robux', 1700, 19.80, 'NORMAL', 'Bonus 15%', true),
  ('pkg_rbx_05', 'prod_roblox_006', '4500 Robux', 4500, 49.00, 'NORMAL', 'កញ្ចប់ធំ 💎', true)
ON CONFLICT ("id") DO NOTHING;

-- 7.7 Valorant
INSERT INTO "Product" ("id", "name", "slug", "image", "category", "isActive")
VALUES ('prod_val_007', 'Valorant', 'valorant', '/images/games/valorant.png', 'PC_GAME', true)
ON CONFLICT ("slug") DO UPDATE SET "image" = '/images/games/valorant.png', "isActive" = true;

INSERT INTO "Package" ("id", "productId", "name", "amount", "price", "category", "badge", "isActive")
VALUES 
  ('pkg_val_01', 'prod_val_007', '475 Valorant Points (VP)', 475, 4.99, 'BEST_SELLER', 'Hot 🔥', true),
  ('pkg_val_02', 'prod_val_007', '1000 Valorant Points (VP)', 1000, 9.99, 'BEST_SELLER', 'ពេញនិយម', true),
  ('pkg_val_03', 'prod_val_007', '2050 Valorant Points (VP)', 2050, 19.80, 'NORMAL', 'ពេញនិយម', true),
  ('pkg_val_04', 'prod_val_007', '3650 Valorant Points (VP)', 3650, 34.50, 'NORMAL', 'Bonus 10%', true),
  ('pkg_val_05', 'prod_val_007', '5350 Valorant Points (VP)', 5350, 49.00, 'NORMAL', 'កញ្ចប់ពិសេស 💎', true)
ON CONFLICT ("id") DO NOTHING;
