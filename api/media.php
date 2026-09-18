<?php
/**
 * Медиатека страниц:
 *  GET  /api/media.php                 — список файлов (только admin)
 *  POST /api/media.php                 — загрузка файла (multipart, поле "file") (только admin)
 *  POST /api/media.php?action=update   — обновить {id, title?, alt?, description?} (только admin)
 *  POST /api/media.php?action=delete   — удалить {id} (только admin)
 *
 * Файлы сохраняются в <project>/uploads/, записи — в таблицу media.
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

// ---------------------------------------------------------------------
// Список (admin)
// ---------------------------------------------------------------------
if ($method === 'GET') {
    requireRole(['admin']);
    try {
        $rows = db()->query(
            'SELECT m.id, m.file_name, m.title, m.description, m.url, m.mime, m.size, m.width, m.height,
                    m.alt, m.created_at, m.uploaded_by,
                    u.login AS uploaded_by_login, u.full_name AS uploaded_by_name,
                    (SELECT GROUP_CONCAT(uu.login ORDER BY uu.login SEPARATOR ", ")
                       FROM users uu WHERE uu.avatar_media_id = m.id) AS used_as_avatar
             FROM media m
             LEFT JOIN users u ON u.id = m.uploaded_by
             ORDER BY m.id DESC'
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['width'] = $row['width'] !== null ? (int) $row['width'] : null;
            $row['height'] = $row['height'] !== null ? (int) $row['height'] : null;
            $row['uploaded_by'] = $row['uploaded_by'] !== null ? (int) $row['uploaded_by'] : null;
        }
        unset($row);
        respondOk(['media' => $rows]);
    } catch (Throwable $e) {
        error_log('Media list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Загрузка (admin)
// ---------------------------------------------------------------------
if ($method === 'POST' && $action === '') {
    $currentUser = requireRole(['admin']);
    verifyCsrf();

    if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        respondError(422, 'Файл не передан или произошла ошибка загрузки');
    }

    $file = $_FILES['file'];
    $maxBytes = 10 * 1024 * 1024; // 10 МБ
    if ($file['size'] > $maxBytes) {
        respondError(422, 'Файл больше 10 МБ');
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/svg+xml' => 'svg',
        'image/avif' => 'avif',
    ];

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $realMime = (string) $finfo->file($file['tmp_name']);
    $ext = $allowed[$realMime] ?? null;
    if ($ext === null) {
        respondError(422, 'Допустимы только изображения: JPG, PNG, GIF, WebP, SVG, AVIF');
    }

    // Размеры изображения (для SVG — не определяем)
    $width = null;
    $height = null;
    if ($realMime !== 'image/svg+xml') {
        $imgInfo = @getimagesize($file['tmp_name']);
        if ($imgInfo !== false) {
            $width = (int) $imgInfo[0];
            $height = (int) $imgInfo[1];
        }
    }

    $uploadDir = dirname(__DIR__) . '/uploads';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
            respondError(500, 'Не удалось создать папку uploads');
        }
    }

    $name = bin2hex(random_bytes(8)) . '.' . $ext;
    $dest = $uploadDir . '/' . $name;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        respondError(500, 'Не удалось сохранить файл');
    }

    $url = '/uploads/' . $name;
    $originalName = (string) ($file['name'] ?? $name);

    try {
        $pdo = db();
        $stmt = $pdo->prepare(
            'INSERT INTO media (file_name, title, url, mime, size, width, height, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $originalName,
            $originalName,
            $url,
            $realMime,
            (int) $file['size'],
            $width,
            $height,
            (int) $currentUser['id'],
        ]);
        respondOk([
            'id' => (int) $pdo->lastInsertId(),
            'url' => $url,
            'name' => $originalName,
            'size' => (int) $file['size'],
        ]);
    } catch (Throwable $e) {
        @unlink($dest);
        error_log('Media insert error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

if ($method !== 'POST') {
    respondError(404, 'Неизвестный запрос');
}

requireRole(['admin']);
verifyCsrf();
$data = inputJson();

// ---------------------------------------------------------------------
// Обновление метаданных (admin)
// ---------------------------------------------------------------------
if ($action === 'update') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    $title = array_key_exists('title', $data) ? trim((string) $data['title']) : null;
    $alt = array_key_exists('alt', $data) ? trim((string) $data['alt']) : null;
    $desc = array_key_exists('description', $data) ? trim((string) $data['description']) : null;
    try {
        $stmt = db()->prepare(
            'UPDATE media SET title = ?, alt = ?, description = ? WHERE id = ?'
        );
        $stmt->execute([
            $title !== '' ? mb_substr($title, 0, 255) : null,
            $alt !== '' ? mb_substr($alt, 0, 255) : null,
            $desc !== '' ? mb_substr($desc, 0, 4000) : null,
            $id,
        ]);
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('Media update error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Удаление (admin)
// ---------------------------------------------------------------------
if ($action === 'delete') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT url FROM media WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            respondError(404, 'Файл не найден');
        }
        $path = dirname(__DIR__) . $row['url'];
        $pdo->prepare('DELETE FROM media WHERE id = ?')->execute([$id]);
        if (is_file($path)) {
            @unlink($path);
        }
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('Media delete error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестный запрос');
