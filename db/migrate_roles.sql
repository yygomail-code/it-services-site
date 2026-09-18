-- Роли пользователей: управляемый список вместо ENUM
-- Применяется к существующей базе (см. также db/schema.sql для новой установки)

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

INSERT INTO roles (code, title, sort_order, is_system) VALUES
  ('guest', 'Гость', 0, 1),
  ('client', 'Пользователь', 10, 0),
  ('manager', 'Менеджер', 20, 0),
  ('admin', 'Администратор', 30, 0)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  sort_order = VALUES(sort_order),
  is_system = VALUES(is_system);

ALTER TABLE users MODIFY COLUMN role VARCHAR(64) NOT NULL DEFAULT 'client';
