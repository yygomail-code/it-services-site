-- ---------------------------------------------------------------------
-- Внутренние настройки приложения (ключ → значение).
-- Не публикуются на сайте: используются серверными механизмами,
-- например ключом запуска очереди писем по ссылке (cron_email_key).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(128) NOT NULL,
  setting_value TEXT DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
