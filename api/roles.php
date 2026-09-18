<?php
/**
 * Роли пользователей (только admin):
 *  GET  /api/roles.php               — список ролей
 *  POST /api/roles.php?action=save   — создать/обновить {id?, code, title, sort_order}
 *  POST /api/roles.php?action=delete — удалить {id}
 *
 * Гость (code=guest) — системная роль: не назначается пользователям и не удаляется,
 * используется для видимости ссылок неавторизованным посетителям.
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$user = requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

// ---------------------------------------------------------------------
// GET — список ролей
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === '') {
    try {
        $rows = db()->query(
            'SELECT id, code, title, sort_order, is_system FROM roles ORDER BY sort_order, id'
        )->fetchAll();
        respondOk(['roles' => $rows]);
    } catch (Throwable $e) {
        error_log('Roles list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

if ($method !== 'POST') {
    respondError(405, 'Метод не поддерживается');
}

verifyCsrf();
$data = inputJson();

/**
 * Меняет код роли во всех настройках: pages.roles, site_content
 * (footer.columns, header.config). Коды в JSON хранятся в кавычках,
 * поэтому замена по '"старый"' не задевает похожие коды.
 */
function replaceRoleCodeInSettings(PDO $pdo, string $from, string $to): void
{
    $pdo->prepare('UPDATE pages SET roles = REPLACE(roles, ?, ?) WHERE roles LIKE ?')
        ->execute(['"' . $from . '"', '"' . $to . '"', '%"' . $from . '"%']);
    $pdo->prepare(
        "UPDATE site_content SET content_value = REPLACE(content_value, ?, ?)
         WHERE content_key IN ('footer.columns', 'header.config') AND content_value LIKE ?"
    )->execute(['"' . $from . '"', '"' . $to . '"', '%"' . $from . '"%']);
}

/** Убирает код роли из вложенных настроек (roles — массив кодов на любом уровне). */
function stripRoleDeep(array $data, string $code): array
{
    foreach ($data as $key => $value) {
        if (!is_array($value)) {
            continue;
        }
        if ($key === 'roles') {
            $data[$key] = array_values(array_filter($value, static fn($c) => $c !== $code));
            continue;
        }
        $data[$key] = stripRoleDeep($value, $code);
    }
    return $data;
}

/** Убирает код роли из настроек страниц и футера/шапки. */
function removeRoleFromSettings(PDO $pdo, string $code): void
{
    $stmt = $pdo->prepare('SELECT id, roles FROM pages WHERE roles LIKE ?');
    $stmt->execute(['%' . $code . '%']);
    $update = $pdo->prepare('UPDATE pages SET roles = ? WHERE id = ?');
    foreach ($stmt->fetchAll() as $row) {
        $roles = json_decode((string) $row['roles'], true);
        if (!is_array($roles)) {
            continue;
        }
        $update->execute([json_encode(array_values(array_filter($roles, static fn($c) => $c !== $code)), JSON_UNESCAPED_UNICODE), (int) $row['id']]);
    }

    $stmt = $pdo->prepare(
        "SELECT content_key, content_value FROM site_content
         WHERE content_key IN ('footer.columns', 'header.config') AND content_value LIKE ?"
    );
    $stmt->execute(['%' . $code . '%']);
    $update = $pdo->prepare('UPDATE site_content SET content_value = ? WHERE content_key = ?');
    foreach ($stmt->fetchAll() as $row) {
        $decoded = json_decode((string) $row['content_value'], true);
        if (!is_array($decoded)) {
            continue;
        }
        $update->execute([json_encode(stripRoleDeep($decoded, $code), JSON_UNESCAPED_UNICODE), $row['content_key']]);
    }
}

// ---------------------------------------------------------------------
// Создание/обновление
// ---------------------------------------------------------------------
if ($action === 'save') {
    $id = isset($data['id']) ? (int) $data['id'] : 0;
    $code = strtolower(trim((string) ($data['code'] ?? '')));
    $title = trim((string) ($data['title'] ?? ''));
    $sortOrder = isset($data['sort_order']) ? (int) $data['sort_order'] : 0;

    if ($title === '') {
        respondError(422, 'Укажите название роли');
    }
    if (mb_strlen($title) > 255) {
        respondError(422, 'Слишком длинное название');
    }
    if (!preg_match('/^[a-z][a-z0-9_\-]{1,63}$/', $code)) {
        respondError(422, 'Код роли: латиница, цифры, дефис и подчёркивание, начинается с буквы');
    }

    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, code, is_system FROM roles WHERE code = ?');
        $stmt->execute([$code]);
        $existing = $stmt->fetch();

        if ($id > 0) {
            $stmt = $pdo->prepare('SELECT id, code, is_system FROM roles WHERE id = ?');
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) {
                respondError(404, 'Роль не найдена');
            }
            if ((int) $current['is_system'] === 1 && $code !== $current['code']) {
                respondError(422, 'У системной роли нельзя менять код');
            }
            if ($existing && (int) $existing['id'] !== $id) {
                respondError(409, 'Такой код уже используется');
            }
            $codeChanged = $code !== $current['code'];
            $pdo->prepare('UPDATE roles SET code = ?, title = ?, sort_order = ? WHERE id = ?')
                ->execute([$code, $title, $sortOrder, $id]);
            if ($codeChanged) {
                // Чтобы настройки страниц/ссылок не «потеряли» роль
                replaceRoleCodeInSettings($pdo, (string) $current['code'], $code);
            }
            respondOk(['id' => $id]);
        }

        if ($existing) {
            respondError(409, 'Такой код уже используется');
        }
        $pdo->prepare('INSERT INTO roles (code, title, sort_order, is_system) VALUES (?, ?, ?, 0)')
            ->execute([$code, $title, $sortOrder]);
        respondOk(['id' => (int) $pdo->lastInsertId()]);
    } catch (Throwable $e) {
        error_log('Role save error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Удаление
// ---------------------------------------------------------------------
if ($action === 'delete') {
    $id = (int) ($data['id'] ?? 0);
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, code, is_system FROM roles WHERE id = ?');
        $stmt->execute([$id]);
        $role = $stmt->fetch();
        if (!$role) {
            respondError(404, 'Роль не найдена');
        }
        if ((int) $role['is_system'] === 1) {
            respondError(422, 'Системную роль удалить нельзя');
        }
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE role = ?');
        $stmt->execute([$role['code']]);
        $used = (int) $stmt->fetchColumn();
        if ($used > 0) {
            respondError(422, 'Роль назначена пользователям: ' . $used);
        }
        // Убираем роль из настроек страниц и ссылок футера/шапки
        removeRoleFromSettings($pdo, (string) $role['code']);
        $pdo->prepare('DELETE FROM roles WHERE id = ?')->execute([$id]);
        respondOk(['deleted' => true]);
    } catch (Throwable $e) {
        error_log('Role delete error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестный запрос');
