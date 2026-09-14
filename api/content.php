<?php
/**
 * Содержимое сайта:
 *  GET  /api/content.php            — все ключи (публичное чтение не требует авторизации)
 *  POST /api/content.php?action=set — сохранить {key, value} (только admin)
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

// ---------------------------------------------------------------------
// GET — все записи (для публичного сайта и админки)
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === '') {
    try {
        $rows = db()->query('SELECT content_key, content_value FROM site_content')->fetchAll();
        $map = [];
        foreach ($rows as $row) {
            $map[$row['content_key']] = $row['content_value'];
        }
        respondOk(['content' => $map]);
    } catch (Throwable $e) {
        error_log('Content get error: ' . $e->getMessage());
        respondOk(['content' => []]);
    }
}

// ---------------------------------------------------------------------
// POST — сохранение (admin)
// ---------------------------------------------------------------------
if ($method === 'POST' && $action === 'set') {
    $user = requireRole(['admin']);
    verifyCsrf();
    $data = inputJson();

    $key = trim((string) ($data['key'] ?? ''));
    $value = $data['value'] ?? null;

    if ($key === '' || !preg_match('/^[A-Za-z0-9_\.\-]{1,128}$/', $key)) {
        respondError(422, 'Недопустимый ключ');
    }
    $key = strtolower($key);

    if ($value !== null && !is_string($value)) {
        respondError(422, 'Значение должно быть строкой');
    }

    try {
        $pdo = db();
        $stmt = $pdo->prepare(
            'INSERT INTO site_content (content_key, content_value, updated_by)
             VALUES (:k, :v, :u)
             ON DUPLICATE KEY UPDATE content_value = :v, updated_by = :u'
        );
        $stmt->execute([
            'k' => $key,
            'v' => $value,
            'u' => (int) $user['id'],
        ]);
        respondOk(['key' => $key]);
    } catch (Throwable $e) {
        error_log('Content set error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестный запрос');
