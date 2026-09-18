-- ---------------------------------------------------------------------
-- Раздел «Товары»: отдельная видимость на сайте (как у раздела «Услуги»).
-- products.enabled — «1» раздел /products показан на сайте, «0» — скрыт (по умолчанию).
-- products.roles  — JSON-массив кодов ролей: NULL — всем, [] — никому,
--                   список — этим ролям (guest — неавторизованные).
-- ---------------------------------------------------------------------
SET NAMES utf8mb4;

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'products.enabled', '0'
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'products.enabled');

INSERT INTO app_settings (setting_key, setting_value)
SELECT 'products.roles', NULL
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'products.roles');
