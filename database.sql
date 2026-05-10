-- ============================================================
--  LAUNDRY DB SCHEMA — VERSI FIX
--  Mendukung kalkulasi: service_fee, delivery_fee, commission,
--  owner_earning, courier_earning, total_amount
-- ============================================================

CREATE DATABASE IF NOT EXISTS laundry_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE laundry_db;

-- Users (tambah kolom address, lat, lng, vehicle_name, vehicle_plate_number)
CREATE TABLE users (
  user_id               INT AUTO_INCREMENT PRIMARY KEY,
  full_name             VARCHAR(100) NOT NULL,
  email                 VARCHAR(100) NOT NULL UNIQUE,
  password              VARCHAR(255) NOT NULL,
  role                  ENUM('customer','courier','owner','admin') NOT NULL DEFAULT 'customer',
  is_verified           TINYINT(1) NOT NULL DEFAULT 0,
  address               VARCHAR(255),
  lat                   DECIMAL(10,8),
  lng                   DECIMAL(11,8),
  vehicle_name          VARCHAR(100),
  vehicle_plate_number  VARCHAR(20),
  created_at            DATETIME DEFAULT NOW(),
  updated_at            DATETIME DEFAULT NOW() ON UPDATE NOW()
);

-- Sessions (untuk blacklist logout)
CREATE TABLE sessions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      TEXT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Laundry Services
CREATE TABLE services (
  service_id   VARCHAR(20) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  price_per_kg DECIMAL(10,2) NOT NULL,
  is_active    TINYINT(1) DEFAULT 1,
  created_at   DATETIME DEFAULT NOW()
);

-- Orders (tambah kolom kalkulasi biaya)
CREATE TABLE orders (
  order_id             VARCHAR(30) PRIMARY KEY,
  customer_id          INT NOT NULL,
  service_id           VARCHAR(20) NOT NULL,
  pickup_address       VARCHAR(255) NOT NULL,
  pickup_lat           DECIMAL(10,8),
  pickup_lng           DECIMAL(11,8),
  pickup_scheduled_at  DATETIME,
  weight_kg            DECIMAL(5,2),
  -- Kalkulasi biaya (diisi saat owner input berat)
  service_fee          DECIMAL(12,2)  DEFAULT NULL COMMENT 'weight_kg × price_per_kg',
  delivery_fee         DECIMAL(12,2)  DEFAULT NULL COMMENT 'distance_km × 2 × 250',
  distance_km          DECIMAL(8,2)   DEFAULT NULL COMMENT 'Haversine(pickup ↔ owner) × 2',
  admin_commission     DECIMAL(12,2)  DEFAULT NULL COMMENT 'service_fee × 15%',
  owner_earning        DECIMAL(12,2)  DEFAULT NULL COMMENT 'service_fee − admin_commission',
  courier_earning      DECIMAL(12,2)  DEFAULT NULL COMMENT 'delivery_fee × 80%',
  total_amount         DECIMAL(12,2)  DEFAULT NULL COMMENT 'service_fee + delivery_fee',
  status               ENUM('pending','confirmed','picked_up','processing','ready','delivered','cancelled') DEFAULT 'pending',
  created_at           DATETIME DEFAULT NOW(),
  updated_at           DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (customer_id) REFERENCES users(user_id),
  FOREIGN KEY (service_id)  REFERENCES services(service_id)
);

-- Invoices
CREATE TABLE invoices (
  invoice_id   VARCHAR(30) PRIMARY KEY,
  order_id     VARCHAR(30) NOT NULL,
  amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_fee  DECIMAL(12,2) DEFAULT 0,
  delivery_fee DECIMAL(12,2) DEFAULT 0,
  status       ENUM('unpaid','paid','cancelled') DEFAULT 'unpaid',
  created_at   DATETIME DEFAULT NOW(),
  updated_at   DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Payments
CREATE TABLE payments (
  payment_id      VARCHAR(30) PRIMARY KEY,
  invoice_id      VARCHAR(30) NOT NULL,
  user_id         INT NOT NULL,
  payment_method  VARCHAR(50) NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  status          ENUM('pending','success','failed') DEFAULT 'pending',
  va_number       VARCHAR(50),
  paid_at         DATETIME,
  expired_at      DATETIME,
  created_at      DATETIME DEFAULT NOW(),
  FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
  FOREIGN KEY (user_id)    REFERENCES users(user_id)
);

-- Courier Assignments (1 kurir = 1 order, handle pickup & delivery)
CREATE TABLE courier_assignments (
  assignment_id  VARCHAR(30) PRIMARY KEY,
  order_id       VARCHAR(30) NOT NULL,
  courier_id     INT NOT NULL,
  -- task_type menunjukkan fase saat ini
  task_type      ENUM('pickup','delivery') NOT NULL DEFAULT 'pickup',
  status         ENUM('assigned','on_the_way','arrived','picked_up','delivered','done','cancelled') DEFAULT 'assigned',
  created_at     DATETIME DEFAULT NOW(),
  updated_at     DATETIME DEFAULT NOW() ON UPDATE NOW(),
  -- Constraint: 1 order hanya boleh 1 kurir
  UNIQUE KEY uq_order_courier (order_id),
  FOREIGN KEY (order_id)   REFERENCES orders(order_id),
  FOREIGN KEY (courier_id) REFERENCES users(user_id)
);

-- Courier Locations
CREATE TABLE courier_locations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  courier_id     INT NOT NULL,
  assignment_id  VARCHAR(30) NOT NULL,
  lat            DECIMAL(10,8) NOT NULL,
  lng            DECIMAL(11,8) NOT NULL,
  updated_at     DATETIME DEFAULT NOW(),
  UNIQUE KEY uq_courier_assignment (courier_id, assignment_id),
  FOREIGN KEY (courier_id)    REFERENCES users(user_id),
  FOREIGN KEY (assignment_id) REFERENCES courier_assignments(assignment_id)
);

-- Subscription Plans
CREATE TABLE subscription_plans (
  plan_id      VARCHAR(20) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  period_type  ENUM('weekly','monthly') NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  max_kg       INT NOT NULL,
  is_active    TINYINT(1) DEFAULT 1,
  created_at   DATETIME DEFAULT NOW()
);

-- User Subscriptions
CREATE TABLE user_subscriptions (
  subscription_id  VARCHAR(30) PRIMARY KEY,
  user_id          INT NOT NULL,
  plan_id          VARCHAR(20) NOT NULL,
  started_at       DATETIME NOT NULL,
  expired_at       DATETIME NOT NULL,
  auto_renew       TINYINT(1) DEFAULT 0,
  status           ENUM('active','expired','cancelled') DEFAULT 'active',
  created_at       DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id)  REFERENCES users(user_id),
  FOREIGN KEY (plan_id)  REFERENCES subscription_plans(plan_id)
);

-- Ratings
CREATE TABLE ratings (
  rating_id    INT AUTO_INCREMENT PRIMARY KEY,
  order_id     VARCHAR(30) NOT NULL UNIQUE,
  customer_id  INT NOT NULL,
  rating       TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review       TEXT,
  created_at   DATETIME DEFAULT NOW(),
  FOREIGN KEY (order_id)    REFERENCES orders(order_id),
  FOREIGN KEY (customer_id) REFERENCES users(user_id)
);

-- Notifications
CREATE TABLE notifications (
  notification_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  title            VARCHAR(100) NOT NULL,
  message          TEXT NOT NULL,
  is_read          TINYINT(1) DEFAULT 0,
  created_at       DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================================
--  SEED DATA
-- ============================================================

INSERT INTO services (service_id, name, description, price_per_kg) VALUES
  ('SVC001', 'Cuci & Setrika',  'Cuci bersih + disetrika rapi',     7000),
  ('SVC002', 'Cuci Kering',     'Khusus cuci saja tanpa setrika',    5000),
  ('SVC003', 'Express (1 Hari)','Selesai dalam 1 hari kerja',       12000);

INSERT INTO subscription_plans (plan_id, name, period_type, price, max_kg) VALUES
  ('SUB001', 'Paket Mingguan', 'weekly',  50000, 10),
  ('SUB002', 'Paket Bulanan',  'monthly', 180000, 50);

-- Password: admin123 (bcrypt hash)
INSERT INTO users (full_name, email, password, role, is_verified, address, lat, lng) VALUES
  ('Admin Utama',   'admin@laundry.com',   '$2b$10$3sZ/Rck7A/GN4xLIqacqn.Ki0N8GwaVVYx.yiiNhJ4DXMIJxp0zXy', 'admin',   1, NULL, NULL, NULL),
  ('Owner Toko',    'owner@laundry.com',   '$2b$10$placeholder', 'owner',   1, 'Jl. AP Pettarani Makassar', -5.14766500, 119.43273200, NULL),
  ('Agung Prasasti','kurir@laundry.com',   '$2b$10$placeholder', 'courier', 1, NULL, NULL, NULL, 'Honda Beat Hitam', 'DD 1234 XY'),
  ('Budi Customer', 'customer@mail.com',   '$2b$10$placeholder', 'customer',0, 'Jl. Sultan Alauddin Gowa', -5.20000000, 119.50000000, NULL);
-- Catatan: Ganti $2b$10$placeholder dengan hash bcrypt yang sesuai (jalankan hash.js)
