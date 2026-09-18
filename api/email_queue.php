<?php
/**
 * Очередь писем. Письмо сохраняется в БД ДО отправки, поэтому при сбое SMTP
 * оно не теряется: попытки повторяются с растущей паузой, после исчерпания
 * запись остаётся со статусом failed (видна в админке, можно повторить).
 *
 * Обработка очереди:
 *  - при заходах в админку (requireRole + register_shutdown_function, троттлинг 5 минут);
 *  - вручную из раздела «Почта»;
 *  - из cron: php api/cron_email_queue.php
 */

declare(strict_types=1);

require_once __DIR__ . '/app_settings.php';
require_once __DIR__ . '/mailer.php';

/** Ставит письмо в очередь. Возвращает id записи. */
function emailQueueAdd(string $to, string $subject, string $html, string $text = '', string $purpose = 'other'): int
{
    $stmt = db()->prepare(
        'INSERT INTO email_queue (to_email, subject, html, text_body, purpose, status, next_attempt_at)
         VALUES (?, ?, ?, ?, ?, "pending", NOW())'
    );
    $stmt->execute([
        mb_substr(trim($to), 0, 255),
        mb_substr(trim($subject), 0, 500),
        $html !== '' ? $html : null,
        $text !== '' ? $text : null,
        $purpose,
    ]);
    return (int) db()->lastInsertId();
}

/** Отправляет одну запись очереди и обновляет её статус. */
function emailQueueSend(array $item): bool
{
    $service = mailerFindService((string) $item['purpose']);
    if (!$service) {
        emailQueueFail($item, 'Нет активного почтового сервиса (раздел «Почта»)');
        return false;
    }
    $result = mailerSend(
        $service,
        (string) $item['to_email'],
        (string) $item['subject'],
        (string) ($item['html'] ?? ''),
        (string) ($item['text_body'] ?? ''),
    );
    if (!empty($result['ok'])) {
        db()->prepare(
            'UPDATE email_queue SET status = "sent", sent_at = NOW(), attempts = attempts + 1, last_error = NULL WHERE id = ?'
        )->execute([(int) $item['id']]);
        return true;
    }
    emailQueueFail($item, (string) ($result['error'] ?? 'Неизвестная ошибка'));
    return false;
}

/** Фиксирует неудачную попытку: пауза растёт, после лимита — статус failed. */
function emailQueueFail(array $item, string $error): void
{
    $attempts = (int) $item['attempts'] + 1;
    $max = max(1, (int) $item['max_attempts']);
    $error = mb_substr($error, 0, 500);
    if ($attempts >= $max) {
        db()->prepare('UPDATE email_queue SET status = "failed", attempts = ?, last_error = ? WHERE id = ?')
            ->execute([$attempts, $error, (int) $item['id']]);
        return;
    }
    // Пауза перед повтором: 5, 10, 15, 20 минут
    db()->prepare(
        'UPDATE email_queue SET attempts = ?, last_error = ?, next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?'
    )->execute([$attempts, $error, $attempts * 5, (int) $item['id']]);
}

/** Пытается отправить письмо сразу после постановки в очередь (best effort). */
function emailQueueTrySendNow(int $id): bool
{
    try {
        $stmt = db()->prepare('SELECT * FROM email_queue WHERE id = ?');
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        return $item ? emailQueueSend($item) : false;
    } catch (Throwable $e) {
        error_log('Email queue send-now error: ' . $e->getMessage());
        return false;
    }
}

/** Обрабатывает готовые к отправке письма. Возвращает ['sent','failed','left']. */
function emailQueueProcess(int $limit = 10): array
{
    $sent = 0;
    $failed = 0;
    try {
        // Чистим отправленные старше 30 дней, чтобы очередь не росла
        db()->exec('DELETE FROM email_queue WHERE status = "sent" AND sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');

        $limit = max(1, min(50, $limit));
        $stmt = db()->prepare(
            'SELECT * FROM email_queue
             WHERE status = "pending" AND next_attempt_at <= NOW()
             ORDER BY id LIMIT ' . $limit
        );
        $stmt->execute();
        foreach ($stmt->fetchAll() as $item) {
            if (emailQueueSend($item)) {
                $sent++;
            } else {
                $failed++;
            }
        }
        $left = (int) db()->query('SELECT COUNT(*) FROM email_queue WHERE status = "pending"')->fetchColumn();
    } catch (Throwable $e) {
        error_log('Email queue process error: ' . $e->getMessage());
        return ['sent' => $sent, 'failed' => $failed, 'left' => -1];
    }
    return ['sent' => $sent, 'failed' => $failed, 'left' => $left];
}

/** Обрабатывает очередь не чаще, чем раз в N секунд (для заходов в админку). */
function emailQueueMaybeProcess(int $everySeconds = 300): void
{
    $lock = sys_get_temp_dir() . '/it_services_email_queue.lock';
    $last = is_file($lock) ? (int) @filemtime($lock) : 0;
    if (time() - $last < $everySeconds) {
        return;
    }
    @touch($lock);
    emailQueueProcess();
}

/** Сбрасывает запись для повторной отправки вручную. */
function emailQueueRetry(int $id): bool
{
    $stmt = db()->prepare(
        'UPDATE email_queue SET status = "pending", attempts = 0, last_error = NULL, next_attempt_at = NOW()
         WHERE id = ? AND status <> "sent"'
    );
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
}

// ---------------------------------------------------------------------
// Запуск по ссылке (cron без паролей): ключ хранится в app_settings,
// ссылку генерируют в админке («Почта» → «Запуск по расписанию»)
// ---------------------------------------------------------------------

/** Ключ настройки, в которой лежит ключ запуска. */
const EMAIL_QUEUE_CRON_KEY = 'cron_email_key';

/** Текущий ключ запуска или '' (ссылка не сгенерирована). */
function emailQueueCronKey(): string
{
    return appSettingGet(EMAIL_QUEUE_CRON_KEY) ?? '';
}

/** Генерирует новый ключ запуска; старая ссылка перестаёт работать. */
function emailQueueCronKeyGenerate(): string
{
    $key = bin2hex(random_bytes(24));
    appSettingSet(EMAIL_QUEUE_CRON_KEY, $key);
    return $key;
}

/** Отключает запуск по ссылке. */
function emailQueueCronKeyClear(): void
{
    appSettingSet(EMAIL_QUEUE_CRON_KEY, null);
}

/** Ссылка запуска очереди для текущего домена. */
function emailQueueCronLink(string $key): string
{
    $https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
        || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    return ($https ? 'https' : 'http') . '://' . $host . '/api/cron_email_queue.php?key=' . $key;
}
