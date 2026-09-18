-- Профиль пользователя: ФИО, дата рождения, адрес, контакты, аватар, комментарий.
-- is_system - системные учётные записи (Администратор, Менеджер): их нельзя
-- заблокировать и удалить, но можно переименовать и сменить пароль.
-- avatar_media_id - аватар из медиатеки (media.id), uploaded_by в media - кто
-- добавил файл. Если колонки уже есть - пропустите файл.

ALTER TABLE users
  ADD COLUMN last_name VARCHAR(100) DEFAULT NULL AFTER full_name,
  ADD COLUMN first_name VARCHAR(100) DEFAULT NULL AFTER last_name,
  ADD COLUMN middle_name VARCHAR(100) DEFAULT NULL AFTER first_name,
  ADD COLUMN birth_date DATE DEFAULT NULL AFTER middle_name,
  ADD COLUMN country VARCHAR(100) DEFAULT NULL AFTER birth_date,
  ADD COLUMN region VARCHAR(100) DEFAULT NULL AFTER country,
  ADD COLUMN city VARCHAR(100) DEFAULT NULL AFTER region,
  ADD COLUMN address VARCHAR(255) DEFAULT NULL AFTER city,
  ADD COLUMN phone VARCHAR(32) DEFAULT NULL AFTER address,
  ADD COLUMN max_link VARCHAR(255) DEFAULT NULL AFTER phone,
  ADD COLUMN telegram VARCHAR(255) DEFAULT NULL AFTER max_link,
  ADD COLUMN whatsapp VARCHAR(255) DEFAULT NULL AFTER telegram,
  ADD COLUMN site VARCHAR(255) DEFAULT NULL AFTER whatsapp,
  ADD COLUMN avatar_media_id BIGINT UNSIGNED DEFAULT NULL AFTER site,
  ADD COLUMN admin_comment TEXT DEFAULT NULL AFTER avatar_media_id,
  ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0 AFTER active;

-- Системные учётные записи (созданы при установке сайта).
UPDATE users SET is_system = 1 WHERE login IN ('admin', 'manager1');

-- Кто добавил файл в медиатеку (пометка «кто добавил и когда»).
ALTER TABLE media ADD COLUMN uploaded_by BIGINT UNSIGNED DEFAULT NULL AFTER alt;
