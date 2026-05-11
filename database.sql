-- ============================================================
--  LAUNDRY DB SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS laundry_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE laundry_db;

-- Users
CREATE TABLE users (
  user_id      INT AUTO_INCREMENT PRIMARY KEY,
  full_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(100) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         ENUM('customer','courier','owner','admin') NOT NULL DEFAULT 'customer',
  is_verified  TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT NOW(),
  updated_at   DATETIME DEFAULT NOW() ON UPDATE NOW()
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

-- Orders
CREATE TABLE orders (
  order_id             VARCHAR(30) PRIMARY KEY,
  customer_id          INT NOT NULL,
  service_id           VARCHAR(20) NOT NULL,
  pickup_address       VARCHAR(255) NOT NULL,
  pickup_lat           DECIMAL(10,7),
  pickup_lng           DECIMAL(10,7),
  pickup_scheduled_at  DATETIME,
  weight_kg            DECIMAL(5,2),
  status               ENUM('pending','confirmed','picked_up','processing','ready','delivered','cancelled') DEFAULT 'pending',
  created_at           DATETIME DEFAULT NOW(),
  updated_at           DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (customer_id) REFERENCES users(user_id),
  FOREIGN KEY (service_id)  REFERENCES services(service_id)
);

-- Invoices
CREATE TABLE invoices (
  invoice_id  VARCHAR(30) PRIMARY KEY,
  order_id    VARCHAR(30) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  status      ENUM('unpaid','paid','cancelled') DEFAULT 'unpaid',
  created_at  DATETIME DEFAULT NOW(),
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

-- Courier Assignments
CREATE TABLE courier_assignments (
  assignment_id  VARCHAR(30) PRIMARY KEY,
  order_id       VARCHAR(30) NOT NULL,
  courier_id     INT NOT NULL,
  task_type      ENUM('pickup','delivery') NOT NULL,
  status         ENUM('assigned','on_the_way','arrived','picked_up','delivered','done','cancelled') DEFAULT 'assigned',
  created_at     DATETIME DEFAULT NOW(),
  updated_at     DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (order_id)   REFERENCES orders(order_id),
  FOREIGN KEY (courier_id) REFERENCES users(user_id)
);

-- Courier Locations
CREATE TABLE courier_locations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  courier_id     INT NOT NULL,
  assignment_id  VARCHAR(30) NOT NULL,
  lat            DECIMAL(10,7) NOT NULL,
  lng            DECIMAL(10,7) NOT NULL,
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
  ('SVC001', 'Cuci & Setrika', 'Cuci bersih + disetrika rapi', 7000),
  ('SVC002', 'Cuci Kering', 'Khusus cuci saja tanpa setrika', 5000),
  ('SVC003', 'Express (1 Hari)', 'Selesai dalam 1 hari kerja', 12000);

INSERT INTO subscription_plans (plan_id, name, period_type, price, max_kg) VALUES
  ('SUB001', 'Paket Mingguan',  'weekly',  50000, 10),
  ('SUB002', 'Paket Bulanan',   'monthly', 180000, 50);

INSERT INTO users (full_name, email, password, role, is_verified) VALUES
  ('Admin Utama', 'admin@laundry.com',  '$2b$10$placeholder', 'admin',   1),
  ('Owner Toko',  'owner@laundry.com',  '$2b$10$placeholder', 'owner',   1),
  ('Agung Prasasti','kurir@laundry.com','$2b$10$placeholder', 'courier', 1);
-- Catatan: Ganti $2b$10$placeholder dengan hash bcrypt yang benar

INSERT INTO courier_assignments (assignment_id, order_id, courier_id, task_type, status) VALUES
  ('ASG001', 'ORD001', 3, 'pickup', 'on_the_way');
