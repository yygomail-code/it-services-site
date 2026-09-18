<?php
/**
 * Управление шапкой сайта (админка):
 *  GET  /api/header.php                 — конфигурация (публично, читает сайт)
 *  POST /api/header.php?action=save     — сохранить {config} (admin)
 *
 * Конфигурация хранится в site_content (ключ header.config):
 *  JSON {subtitle, subtitle_large, menu: [{label, url, roles}], cta: {label, url, roles}|null}
 *
 * Логотип, название и метка — общие для сайта (ключи brand.*, раздел «Бренд»).
 * Ссылка «Войти»/имя пользователя — автоматическая, не настраивается.
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

const HEADER_KEY = 'header.config';

function readHeaderConfig(): ?array
{
    try {
        $stmt = db()->prepare('SELECT content_value FROM site_content WHERE content_key = ?');
        $stmt->execute([HEADER_KEY]);
        $value = $stmt->fetchColumn();
        if ($value === false || $value === null || $value === '') {
            return null;
        }
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : null;
    } catch (Throwable $e) {
        error_log('Header read error: ' . $e->getMessage());
        return null;
    }
}

/**
 * Роли видимости: массив — как есть (пустой = скрыто для всех),
 * поле отсутствует — null (старая запись, видна всем).
 * Выбраны все роли — тоже null: ограничений нет, элемент виден сразу.
 */
function normalizeHeaderRoles(array $item, array $roleCodes): ?array
{
    if (!array_key_exists('roles', $item) || !is_array($item['roles'])) {
        return null;
    }
    $roles = [];
    foreach ($item['roles'] as $code) {
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

// Публичное чтение (сайт)
if ($method === 'GET') {
    respondOk(['header' => readHeaderConfig()]);
}

if ($method !== 'POST') {
    respondError(404, 'Неизвестный запрос');
}

requireRole(['admin']);
verifyCsrf();
$data = inputJson();

if ($action !== 'save') {
    respondError(404, 'Неизвестный запрос');
}

$config = $data['config'] ?? null;
if (!is_array($config)) {
    respondError(422, 'Некорректная конфигурация');
}

// Коды ролей для проверки видимости
$roleCodes = [];
try {
    $roleCodes = db()->query('SELECT code FROM roles')->fetchAll(PDO::FETCH_COLUMN) ?: [];
} catch (Throwable $e) {
    error_log('Roles lookup error: ' . $e->getMessage());
}

$menu = [];
foreach (($config['menu'] ?? []) as $item) {
    if (!is_array($item) || trim((string) ($item['label'] ?? '')) === '') {
        continue;
    }
    $entry = [
        'label' => mb_substr(trim((string) $item['label']), 0, 255),
        'url' => mb_substr(trim((string) ($item['url'] ?? '')), 0, 500),
    ];
    $roles = normalizeHeaderRoles($item, $roleCodes);
    if ($roles !== null) {
        $entry['roles'] = $roles;
    }
    $menu[] = $entry;
}

$cta = $config['cta'] ?? null;
$normalizedCta = null;
if (is_array($cta) && trim((string) ($cta['label'] ?? '')) !== '') {
    $normalizedCta = [
        'label' => mb_substr(trim((string) $cta['label']), 0, 255),
        'url' => mb_substr(trim((string) ($cta['url'] ?? '')), 0, 500),
    ];
    $roles = normalizeHeaderRoles($cta, $roleCodes);
    if ($roles !== null) {
        $normalizedCta['roles'] = $roles;
    }
}

// Блок входа не настраивается: «Вход» добавляется обычным пунктом меню

$value = json_encode([
    'subtitle' => mb_substr(trim((string) ($config['subtitle'] ?? '')), 0, 255),
    'subtitle_large' => !empty($config['subtitle_large']) ? 1 : 0,
    'menu' => $menu,
    'cta' => $normalizedCta,
], JSON_UNESCAPED_UNICODE);

try {
    $stmt = db()->prepare(
        'INSERT INTO site_content (content_key, content_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE content_value = VALUES(content_value), updated_at = NOW()'
    );
    $stmt->execute([HEADER_KEY, $value]);
    respondOk(['saved' => true]);
} catch (Throwable $e) {
    error_log('Header save error: ' . $e->getMessage());
    respondError(500, 'Ошибка сервера');
}
