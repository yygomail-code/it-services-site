-- ---------------------------------------------------------------------
-- Модуль «Запись» (этап 3): брони на услуги по дате и времени.
-- Применять после db/migrate_services.sql. Идемпотентно.
-- ---------------------------------------------------------------------
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- Публичный номер брони (для писем и клиента)
  booking_id VARCHAR(16) NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  -- Снимок названия: услугу могут переименовать или удалить
  service_title VARCHAR(255) NOT NULL,
  -- Начало и конец самой записи (без буферов)
  slot_at DATETIME NOT NULL,
  slot_end DATETIME NOT NULL,
  -- Буферы услуги на момент записи (для проверки пересечений)
  buffer_before_min SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  buffer_after_min SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  telegram VARCHAR(128) DEFAULT NULL,
  comment TEXT,
  -- Авторизованный клиент (если запись из кабинета)
  user_id INT UNSIGNED DEFAULT NULL,
  -- new — ждёт подтверждения, confirmed — подтверждена, done — выполнена,
  -- canceled — отменена, no_show — клиент не пришёл
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  cancel_reason VARCHAR(255) DEFAULT NULL,
  canceled_by VARCHAR(16) DEFAULT NULL,
  canceled_at DATETIME DEFAULT NULL,
  -- Оплата: фиксация способа и статуса (онлайн-платежей нет)
  payment_status VARCHAR(16) NOT NULL DEFAULT 'unpaid',
  payment_method VARCHAR(16) DEFAULT NULL,
  payment_amount DECIMAL(10,2) DEFAULT NULL,
  paid_at DATETIME DEFAULT NULL,
  -- Токен для отмены записи клиентом по ссылке из письма
  confirm_token VARCHAR(64) NOT NULL,
  utm_source VARCHAR(128) DEFAULT NULL,
  utm_medium VARCHAR(128) DEFAULT NULL,
  utm_campaign VARCHAR(128) DEFAULT NULL,
  page VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_booking_id (booking_id),
  UNIQUE KEY uq_bookings_token (confirm_token),
  KEY idx_bookings_slot (slot_at, status),
  KEY idx_bookings_service (service_id, slot_at),
  KEY idx_bookings_user (user_id, slot_at),
  KEY idx_bookings_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Настройки модуля (меняются в админке, раздел «Запись»)
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('booking.schedule', '{"days":[1,2,3,4,5],"from":"10:00","to":"18:00","step":30}')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('booking.horizon_days', '30')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('booking.min_hours_ahead', '2')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
