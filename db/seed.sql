-- Первичные пользователи админки.
-- Пароли НЕ хранятся в открытом виде: здесь bcrypt-хеши.
-- По умолчанию создаётся администратор: логин admin / пароль admin123
-- После первого входа обязательно смените пароль.

USE it_services;

INSERT INTO users (login, email, password_hash, role, full_name, active)
SELECT 'admin', 'admin@example.ru', '$2y$12$XrOqMCkpiEHr.rI544p65OUZSzsKt6OUTtVjhbyAsumWl7YtEaGku', 'admin', 'Администратор', 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'admin');
