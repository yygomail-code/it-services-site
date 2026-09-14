-- Схема таблицы leads (CRM-готовая)
CREATE DATABASE IF NOT EXISTS it_services
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE it_services;

CREATE TABLE IF NOT EXISTS leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id VARCHAR(32) NOT NULL,
  lead_type ENUM('client', 'partner') NOT NULL DEFAULT 'client',
  partner_role VARCHAR(64) DEFAULT NULL,
  deal_type ENUM('referral', 'outsource') DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  telegram VARCHAR(255) DEFAULT NULL,
  service VARCHAR(255) DEFAULT NULL,
  message TEXT DEFAULT NULL,
  utm_source VARCHAR(255) DEFAULT NULL,
  utm_medium VARCHAR(255) DEFAULT NULL,
  utm_campaign VARCHAR(255) DEFAULT NULL,
  page VARCHAR(255) DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  notify_to VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_id (lead_id),
  KEY idx_created_at (created_at),
  KEY idx_lead_type (lead_type),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Пользователи админки (CRM)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  login VARCHAR(64) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('client', 'manager', 'admin') NOT NULL DEFAULT 'client',
  full_name VARCHAR(255) DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_login (login),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Содержимое сайта (редактируется админом)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_content (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_key VARCHAR(128) NOT NULL,
  content_value TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_content_key (content_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

