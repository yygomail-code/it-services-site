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
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  login VARCHAR(64) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'client',
  full_name VARCHAR(255) DEFAULT NULL,
  last_name VARCHAR(100) DEFAULT NULL,
  first_name VARCHAR(100) DEFAULT NULL,
  middle_name VARCHAR(100) DEFAULT NULL,
  birth_date DATE DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  region VARCHAR(100) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  max_link VARCHAR(255) DEFAULT NULL,
  telegram VARCHAR(255) DEFAULT NULL,
  whatsapp VARCHAR(255) DEFAULT NULL,
  site VARCHAR(255) DEFAULT NULL,
  avatar_media_id BIGINT UNSIGNED DEFAULT NULL,
  admin_comment TEXT DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
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

-- ---------------------------------------------------------------------
-- Страницы сайта, редактируемые из админки.
-- content хранится в JSON (секции/колонки/блоки).
-- Публичный адрес определяется слагом: home -> /, статические слаги -> /<slug>,
-- остальные -> /pages/<slug>.
-- roles — JSON-массив кодов ролей (NULL — доступна всем, [] — скрыта для всех).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  meta_title VARCHAR(255) DEFAULT NULL,
  meta_description VARCHAR(500) DEFAULT NULL,
  content LONGTEXT,
  status ENUM('published','draft') NOT NULL DEFAULT 'draft',
  roles TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pages_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Каталог медиа (файлы, загруженные в uploads/).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  url VARCHAR(500) NOT NULL,
  mime VARCHAR(128) NOT NULL,
  size INT UNSIGNED NOT NULL DEFAULT 0,
  width INT UNSIGNED DEFAULT NULL,
  height INT UNSIGNED DEFAULT NULL,
  alt VARCHAR(255) DEFAULT NULL,
  uploaded_by BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_media_url (url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Формы (создаются админом, вставляются на страницы по номеру/названию)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_number INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  submit_label VARCHAR(100) NOT NULL DEFAULT 'Отправить',
  success_message VARCHAR(500) NOT NULL DEFAULT 'Спасибо! Заявка отправлена.',
  create_lead TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_form_number (form_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Поля формы
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_fields (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_id BIGINT UNSIGNED NOT NULL,
  field_type ENUM('text','email','phone','url','textarea','select') NOT NULL DEFAULT 'text',
  label VARCHAR(255) NOT NULL,
  name VARCHAR(64) NOT NULL,
  placeholder VARCHAR(255) DEFAULT NULL,
  options TEXT DEFAULT NULL,
  required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_form_id (form_id),
  CONSTRAINT fk_form_fields_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Отправки форм (данные, собранные с сайта)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_id BIGINT UNSIGNED NOT NULL,
  data JSON NOT NULL,
  page VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_form_id (form_id),
  CONSTRAINT fk_form_submissions_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Сервисы отправки почты (раздел «Почта»).
-- purpose: leads — заявки, registration — регистрация, actions — действия,
-- purchases — покупки, other — прочее.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mail_services (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'custom',
  host VARCHAR(255) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL DEFAULT 465,
  encryption ENUM('ssl','tls','none') NOT NULL DEFAULT 'ssl',
  username VARCHAR(255) NOT NULL,
  password TEXT,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) DEFAULT NULL,
  purpose VARCHAR(32) NOT NULL DEFAULT 'leads',
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_check_at DATETIME DEFAULT NULL,
  last_check_ok TINYINT(1) DEFAULT NULL,
  last_check_error VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Очередь писем: письмо сохраняется ДО отправки; при сбое повторяется
-- (обработка — при заходах в админку и из cron).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_queue (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html TEXT DEFAULT NULL,
  text_body TEXT DEFAULT NULL,
  purpose VARCHAR(32) NOT NULL DEFAULT 'other',
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  last_error VARCHAR(500) DEFAULT NULL,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_queue_due (status, next_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Внутренние настройки приложения: ключ → значение.
-- Не публикуются на сайте (например, ключ запуска очереди по ссылке).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(128) NOT NULL,
  setting_value TEXT DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


