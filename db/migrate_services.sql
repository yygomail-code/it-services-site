-- ---------------------------------------------------------------------
-- Модуль «Услуги»: группы, шаблоны карточек, услуги/товары и медиа.
--
--   service_categories — группы (категории) услуг, с вложенностью и порядком
--   card_templates     — шаблоны карточек (варианты вёрстки: какие поля
--                        показывать и в каком порядке)
--   services           — услуги и товары: цена, описания, длительность,
--                        буферы до/после, флаги (календарь/магазин/комментарии/
--                        рейтинг/автоподтверждение), оплата, доступ по ролям
--   service_media      — галерея услуги (обложка + порядок)
--
-- Дополнительно: настройки раздела (services.enabled, services.roles)
-- в таблице app_settings.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id BIGINT UNSIGNED DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_categories_slug (slug),
  KEY idx_service_categories_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS card_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  kind ENUM('service','product') NOT NULL DEFAULT 'service',
  fields JSON NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(128) NOT NULL,
  kind ENUM('service','product') NOT NULL DEFAULT 'service',
  title VARCHAR(255) NOT NULL,
  short_description TEXT DEFAULT NULL,
  full_description MEDIUMTEXT DEFAULT NULL,
  price DECIMAL(12,2) DEFAULT NULL,
  price_prefix ENUM('none','from') NOT NULL DEFAULT 'none',
  price_note VARCHAR(128) DEFAULT NULL,
  icon VARCHAR(16) DEFAULT NULL,
  unit ENUM('piece','time') NOT NULL DEFAULT 'piece',
  duration_min INT UNSIGNED NOT NULL DEFAULT 60,
  buffer_before_min INT UNSIGNED NOT NULL DEFAULT 0,
  buffer_after_min INT UNSIGNED NOT NULL DEFAULT 0,
  category_id BIGINT UNSIGNED DEFAULT NULL,
  template_id BIGINT UNSIGNED DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  map_lat DECIMAL(10,7) DEFAULT NULL,
  map_lng DECIMAL(10,7) DEFAULT NULL,
  booking_enabled TINYINT(1) NOT NULL DEFAULT 0,
  shop_enabled TINYINT(1) NOT NULL DEFAULT 0,
  comments_enabled TINYINT(1) NOT NULL DEFAULT 1,
  rating_enabled TINYINT(1) NOT NULL DEFAULT 1,
  auto_confirm TINYINT(1) NOT NULL DEFAULT 0,
  prepay TINYINT(1) NOT NULL DEFAULT 0,
  postpay TINYINT(1) NOT NULL DEFAULT 1,
  payment_methods JSON DEFAULT NULL,
  roles JSON DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0,
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  comments_count INT UNSIGNED NOT NULL DEFAULT 0,
  meta_title VARCHAR(255) DEFAULT NULL,
  meta_description VARCHAR(512) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_services_slug (slug),
  KEY idx_services_category (category_id),
  KEY idx_services_active (active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_id BIGINT UNSIGNED NOT NULL,
  media_id BIGINT UNSIGNED DEFAULT NULL,
  url VARCHAR(512) NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  is_cover TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_service_media_service (service_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Шаблоны карточек по умолчанию: порядок и видимость полей карточки.
-- ---------------------------------------------------------------------

INSERT INTO card_templates (name, kind, fields, is_default)
SELECT 'Карточка услуги', 'service',
       '[{"key":"gallery","on":true},{"key":"title","on":true},{"key":"price","on":true},{"key":"rating","on":true},{"key":"excerpt","on":true},{"key":"description","on":true},{"key":"address","on":true},{"key":"map","on":true},{"key":"calendar","on":true},{"key":"comments","on":true}]',
       1
WHERE NOT EXISTS (SELECT 1 FROM card_templates);

INSERT INTO card_templates (name, kind, fields, is_default)
SELECT 'Карточка товара', 'product',
       '[{"key":"gallery","on":true},{"key":"title","on":true},{"key":"price","on":true},{"key":"rating","on":true},{"key":"excerpt","on":true},{"key":"description","on":true},{"key":"comments","on":true}]',
       1
WHERE NOT EXISTS (SELECT 1 FROM card_templates WHERE kind = 'product');

-- ---------------------------------------------------------------------
-- Настройки раздела «Услуги» на сайте: включён/выключен и доступ по ролям.
-- ---------------------------------------------------------------------

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'services.enabled', '1'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'services.enabled');

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'services.roles', NULL
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'services.roles');
