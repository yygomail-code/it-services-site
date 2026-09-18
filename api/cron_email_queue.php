<?php
/**
 * Обработка очереди писем по расписанию.
 *
 * Способы запуска:
 *  - командная строка (crontab): php api/cron_email_queue.php
 *  - по ссылке из админки («Почта» → «Запуск по расписанию»):
 *    https://<домен>/api/cron_email_queue.php?key=<ключ>
 *
 * Ссылку генерируют в админке; перегенерация отключает старую. Без ключа
 * HTTP-запрос отклоняется. Письма, не ушедшие из-за сбоя SMTP, повторяются
 * с растущей паузой; после исчерпания попыток остаются со статусом failed
 * и видны в админке («Почта» → «Очередь писем»).
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/email_queue.php';

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');

    $key = trim((string) ($_GET['key'] ?? ''));
    $stored = emailQueueCronKey();
    if ($stored === '' || $key === '' || !hash_equals($stored, $key)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Неверный ключ запуска']);
        exit;
    }
}

$result = emailQueueProcess(50);

if ($isCli) {
    echo date('Y-m-d H:i:s')
        . " — отправлено: {$result['sent']}, ошибок: {$result['failed']}, осталось в очереди: {$result['left']}"
        . PHP_EOL;
    exit;
}

echo json_encode([
    'ok' => true,
    'sent' => $result['sent'],
    'failed' => $result['failed'],
    'left' => $result['left'],
]);
