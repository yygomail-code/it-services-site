-- Первичные пользователи админки.
-- Пароли НЕ хранятся в открытом виде: здесь bcrypt-хеши.
-- По умолчанию создаётся администратор: логин admin / пароль admin123
-- После первого входа обязательно смените пароль.

-- ВАЖНО: файл в UTF-8. Импортировать клиентом в utf8mb4,
-- иначе кириллица (full_name и т.п.) превратится в "РђРґРјРёРЅ..." (mojibake).
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE it_services;

-- Базовые роли: гость (системная, не назначается пользователям) и рабочие роли
INSERT INTO roles (code, title, sort_order, is_system) VALUES
  ('guest', 'Гость', 0, 1),
  ('client', 'Пользователь', 10, 0),
  ('manager', 'Менеджер', 20, 0),
  ('admin', 'Администратор', 30, 0)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  sort_order = VALUES(sort_order),
  is_system = VALUES(is_system);

INSERT INTO users (login, email, password_hash, role, full_name, active, is_system)
SELECT 'admin', 'admin@example.ru', '$2y$12$XrOqMCkpiEHr.rI544p65OUZSzsKt6OUTtVjhbyAsumWl7YtEaGku', 'admin', 'Администратор', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'admin');

-- Менеджер: логин manager1 / пароль manager123. Системная учётная запись.
INSERT INTO users (login, email, password_hash, role, full_name, active, is_system)
SELECT 'manager1', 'manager@example.ru', '$2y$12$sjYzD8lcsvLTZYdL/FX6TeW7x7SYkc2QtHhJMcLoElHRNj35IA/Oy', 'manager', 'Менеджер', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'manager1');
