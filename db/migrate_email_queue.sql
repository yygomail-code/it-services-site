-- Очередь писем: письмо сохраняется в БД ДО отправки, при сбое остаётся
-- в очереди и повторяется (обработка — при заходах в админку и из cron).
-- Статусы: pending (ждёт отправки), sent (отправлено), failed (исчерпаны попытки).
-- purpose — назначение письма (leads/registration/actions/purchases/other),
-- по нему выбирается почтовый сервис. Если таблица уже есть - пропустите файл.

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
