<?php
/**
 * Страницы сайта (админка):
 *  GET  /api/pages.php                 — список страниц (только admin)
 *  GET  /api/pages.php?action=get&id=N — одна страница (только admin)
 *  POST /api/pages.php?action=create   — создать {slug, title, meta_title?, meta_description?, status?, content?}
 *  POST /api/pages.php?action=update   — обновить {id, ...}
 *  POST /api/pages.php?action=delete   — удалить {id}
 *  GET  /api/pages.php?action=public&slug=... — опубликованная страница для сайта (публично)
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

function pageContent(?string $json): array
{
    if ($json === null || $json === '') {
        return [];
    }
    $decoded = json_decode($json, true);
    return is_array($decoded) ? $decoded : [];
}

function validateSlug(string $slug): bool
{
    return (bool) preg_match('/^[a-z0-9\-]{1,128}$/', $slug);
}

/** Роли доступа из строки JSON: null — всем, [] — никому, список — этим ролям. */
function pageRoles(?string $json): ?array
{
    if ($json === null || $json === '') {
        return null;
    }
    $decoded = json_decode($json, true);
    return is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : null;
}

/**
 * Нормализует роли при сохранении: массив кодов ([] — никому), отсутствует — null (всем).
 * Выбраны все роли — тоже null: ограничений нет.
 */
function normalizePageRoles($raw, array $roleCodes): ?array
{
    if (!is_array($raw)) {
        return null;
    }
    $roles = [];
    foreach ($raw as $code) {
        $code = (string) $code;
        if ($roleCodes && !in_array($code, $roleCodes, true)) {
            continue;
        }
        if (!in_array($code, $roles, true)) {
            $roles[] = $code;
        }
    }
    if ($roleCodes && count($roles) === count($roleCodes)) {
        return null;
    }
    return $roles;
}

// ---------------------------------------------------------------------
// Публичная страница (без авторизации)
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === 'public') {
    $slug = strtolower(trim((string) ($_GET['slug'] ?? '')));
    if ($slug === '' || !validateSlug($slug)) {
        respondError(422, 'Недопустимый адрес страницы');
    }
    try {
        $stmt = db()->prepare(
            'SELECT id, slug, title, meta_title, meta_description, content, roles
             FROM pages WHERE slug = ? AND status = "published" LIMIT 1'
        );
        $stmt->execute([$slug]);
        $page = $stmt->fetch();
        if (!$page) {
            respondError(404, 'Страница не найдена');
        }
        $roles = pageRoles($page['roles'] ?? null);
        unset($page['roles']);

        // Доступ: null — всем; [] — никому; список — этим ролям (guest — неавторизованные)
        $user = currentUser();
        $role = (string) ($user['role'] ?? 'guest');
        $allowed = $roles === null || ($roles !== [] && in_array($role, $roles, true));

        if (!$allowed) {
            // Контент не отдаём: клиент покажет заглушку «войдите» или «нет доступа»
            $page['content'] = [];
            $page['restricted'] = true;
            respondOk(['page' => $page]);
        }

        $page['content'] = pageContent($page['content']);
        respondOk(['page' => $page]);
    } catch (Throwable $e) {
        error_log('Page public error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Далее — только для админа
// ---------------------------------------------------------------------
$user = requireRole(['admin']);
$allowedStatuses = ['published', 'draft'];

// Список
if ($method === 'GET' && $action === '') {
    try {
        $rows = db()->query(
            'SELECT id, slug, title, meta_title, meta_description, status, roles, created_at, updated_at
             FROM pages ORDER BY id DESC'
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['roles'] = pageRoles($row['roles'] ?? null);
        }
        unset($row);
        respondOk(['pages' => $rows]);
    } catch (Throwable $e) {
        error_log('Pages list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// Одна страница
if ($method === 'GET' && $action === 'get') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    try {
        $stmt = db()->prepare('SELECT * FROM pages WHERE id = ?');
        $stmt->execute([$id]);
        $page = $stmt->fetch();
        if (!$page) {
            respondError(404, 'Страница не найдена');
        }
        $page['content'] = pageContent($page['content']);
        $page['roles'] = pageRoles($page['roles'] ?? null);
        respondOk(['page' => $page]);
    } catch (Throwable $e) {
        error_log('Page get error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

if ($method !== 'POST') {
    respondError(405, 'Метод не поддерживается');
}

verifyCsrf();
$data = inputJson();

function normalizePageData(array $data): array
{
    $slug = strtolower(trim((string) ($data['slug'] ?? '')));
    $title = trim((string) ($data['title'] ?? ''));
    $metaTitle = array_key_exists('meta_title', $data) ? trim((string) $data['meta_title']) : '';
    $metaDesc = array_key_exists('meta_description', $data) ? trim((string) $data['meta_description']) : '';
    $status = trim((string) ($data['status'] ?? 'published'));
    $content = $data['content'] ?? null;

    if ($slug === '' || !validateSlug($slug)) {
        respondError(422, 'Недопустимый адрес страницы (a-z, 0-9, дефис)');
    }
    if ($title === '') {
        respondError(422, 'Укажите заголовок страницы');
    }
    if (mb_strlen($metaTitle) > 255) {
        respondError(422, 'meta_title слишком длинный');
    }
    if (mb_strlen($metaDesc) > 500) {
        respondError(422, 'meta_description слишком длинный');
    }
    if (!in_array($status, ['published', 'draft'], true)) {
        respondError(422, 'Недопустимый статус');
    }
    if ($content !== null && !is_array($content)) {
        respondError(422, 'Контент должен быть массивом блоков');
    }
    $contentJson = $content === null ? null : json_encode($content, JSON_UNESCAPED_UNICODE);

    // Доступ по ролям (как у ссылок меню/футера)
    $roleCodes = [];
    try {
        $roleCodes = db()->query('SELECT code FROM roles')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    } catch (Throwable $e) {
        error_log('Roles lookup error: ' . $e->getMessage());
    }
    $roles = normalizePageRoles($data['roles'] ?? null, $roleCodes);

    return [
        'slug' => $slug,
        'title' => $title,
        'meta_title' => $metaTitle !== '' ? $metaTitle : null,
        'meta_description' => $metaDesc !== '' ? $metaDesc : null,
        'status' => $status,
        'content' => $contentJson,
        'roles' => $roles === null ? null : json_encode($roles, JSON_UNESCAPED_UNICODE),
    ];
}

// Создание
if ($action === 'create') {
    $p = normalizePageData($data);
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id FROM pages WHERE slug = ?');
        $stmt->execute([$p['slug']]);
        if ($stmt->fetch()) {
            respondError(409, 'Страница с таким адресом уже существует');
        }
        $stmt = $pdo->prepare(
            'INSERT INTO pages (slug, title, meta_title, meta_description, content, status, roles)
             VALUES (:slug, :title, :meta_title, :meta_description, :content, :status, :roles)'
        );
        $stmt->execute($p);
        respondOk(['id' => (int) $pdo->lastInsertId()]);
    } catch (Throwable $e) {
        error_log('Page create error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// Обновление
if ($action === 'update') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    $p = normalizePageData($data);
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id FROM pages WHERE slug = ? AND id <> ?');
        $stmt->execute([$p['slug'], $id]);
        if ($stmt->fetch()) {
            respondError(409, 'Страница с таким адресом уже существует');
        }
        $stmt = $pdo->prepare(
            'UPDATE pages
             SET slug = :slug, title = :title, meta_title = :meta_title,
                 meta_description = :meta_description, content = :content, status = :status,
                 roles = :roles
             WHERE id = :id'
        );
        $stmt->execute($p + ['id' => $id]);
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('Page update error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// Удаление
if ($action === 'delete') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    try {
        db()->prepare('DELETE FROM pages WHERE id = ?')->execute([$id]);
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('Page delete error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестное действие');
