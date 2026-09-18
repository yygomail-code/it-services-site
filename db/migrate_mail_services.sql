-- Сервисы отправки почты (раздел «Почта» в админке).
-- Каждая запись — подключение к SMTP-серверу (Яндекс, Mail.ru, Google или свой).
-- purpose — для чего сервис используется (leads — заявки, registration — регистрация,
-- actions — действия, purchases — покупки, other — прочее).
-- password — пароль приложения почтового сервиса (в API не отдаётся, только признак наличия).

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
