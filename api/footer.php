<?php
/**
 * Управление футером и подвалом (админка):
 *  GET  /api/footer.php                 — текущая конфигурация (admin; публично тоже ок)
 *  POST /api/footer.php?action=save     — сохранить {config} (admin)
 *
 * Конфигурация хранится в site_content (ключи footer.*):
 *  footer.about        -> JSON {subtitle, note, rows: {subtitle|note: {large, gap}}}
 *  footer.columns      -> JSON [{title, links: [{label, url, large, gap}]}]
 *  footer.contacts     -> JSON {items: [{field, show, icon, large, gap}]}
 *  footer.copyright    -> JSON {text, large}
 *  footer.bottom_links -> JSON [{label, url}]
 *
 * Логотип, название и метка — общие для сайта (ключи brand.*, раздел «Бренд»).
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

const FOOTER_KEYS = [
    'footer.about',
    'footer.columns',
    'footer.contacts',
    'footer.copyright',
    'footer.bottom_links',
];

/** Ключ прошлой версии: блок назывался «Логотип и описание». */
const FOOTER_LEGACY_KEYS = [
    'footer.logo',
];

function readFooter(): array
{
    $keys = array_merge(FOOTER_KEYS, FOOTER_LEGACY_KEYS);
    $out = [];
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT content_key, content_value FROM site_content WHERE content_key IN (' .
            implode(',', array_fill(0, count($keys), '?')) . ')');
        $stmt->execute($keys);
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $value = json_decode((string) $row['content_value'], true);
            $out[$row['content_key']] = is_array($value) ? $value : null;
        }
    } catch (Throwable $e) {
        error_log('Footer read error: ' . $e->getMessage());
    }
    return $out;
}

// Публичное чтение (сайт)
if ($method === 'GET') {
    $raw = readFooter();
    // Нормализуем ключи: footer.about -> about и т.д. для удобства фронта
    $out = [];
    foreach (FOOTER_KEYS as $key) {
        $short = str_replace('footer.', '', $key);
        $out[$short] = $raw[$key] ?? null;
    }
    // Совместимость: старый ключ footer.logo -> about
    if ($out['about'] === null && isset($raw['footer.logo'])) {
        $out['about'] = $raw['footer.logo'];
    }
    respondOk(['footer' => $out]);
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

// Частичное сохранение: обновляем только переданные ключи,
// чтобы редакторы «Футер» и «Подвал» не затирали поля друг друга.
$values = [];

if (array_key_exists('about', $config)) {
    $about = $config['about'] ?? [];
    $aboutRows = [];
    foreach (['subtitle', 'note'] as $rowKey) {
        $row = is_array($about['rows'][$rowKey] ?? null) ? $about['rows'][$rowKey] : [];
        $aboutRows[$rowKey] = [
            'large' => !empty($row['large']) ? 1 : 0,
            'gap' => !empty($row['gap']) ? 1 : 0,
        ];
    }
    $values['footer.about'] = json_encode([
        'subtitle' => mb_substr(trim((string) ($about['subtitle'] ?? '')), 0, 255),
        'note' => mb_substr(trim((string) ($about['note'] ?? '')), 0, 1000),
        'rows' => $aboutRows,
    ], JSON_UNESCAPED_UNICODE);
}

if (array_key_exists('columns', $config)) {
    $columns = $config['columns'] ?? [];
    // Коды ролей для проверки видимости ссылок
    $roleCodes = [];
    try {
        $roleCodes = db()->query('SELECT code FROM roles')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    } catch (Throwable $e) {
        error_log('Roles lookup error: ' . $e->getMessage());
    }
    $normalizedColumns = [];
    foreach ($columns as $col) {
        if (!is_array($col)) {
            continue;
        }
        $links = [];
        foreach (($col['links'] ?? []) as $link) {
            if (!is_array($link) || trim((string) ($link['label'] ?? '')) === '') {
                continue;
            }
            $entry = [
                'label' => mb_substr(trim((string) $link['label']), 0, 255),
                'url' => mb_substr(trim((string) ($link['url'] ?? '')), 0, 500),
                'large' => !empty($link['large']) ? 1 : 0,
                'gap' => !empty($link['gap']) ? 1 : 0,
            ];
            // Видимость по ролям: массив — сохраняем (пустой = скрыта для всех),
            // поле отсутствует — старая запись (видна всем).
            // Выбраны все роли — ограничений нет (ссылка видна сразу, без ожидания сессии).
            if (array_key_exists('roles', $link) && is_array($link['roles'])) {
                $roles = [];
                foreach ($link['roles'] as $code) {
                    $code = (string) $code;
                    if ($roleCodes && !in_array($code, $roleCodes, true)) {
                        continue;
                    }
                    if (!in_array($code, $roles, true)) {
                        $roles[] = $code;
                    }
                }
                if (!($roleCodes && count($roles) === count($roleCodes))) {
                    $entry['roles'] = $roles;
                }
            }
            $links[] = $entry;
        }
        if (trim((string) ($col['title'] ?? '')) === '' && count($links) === 0) {
            continue;
        }
        $normalizedColumns[] = [
            'title' => mb_substr(trim((string) ($col['title'] ?? '')), 0, 255),
            'links' => $links,
        ];
    }
    $values['footer.columns'] = json_encode($normalizedColumns, JSON_UNESCAPED_UNICODE);
}

if (array_key_exists('contacts', $config)) {
    $contacts = $config['contacts'] ?? [];
    $allowedFields = ['phone', 'email', 'city', 'address', 'max', 'telegram', 'whatsapp', 'viber', 'vk'];
    // Старый общий флаг иконок — значение по умолчанию для строк
    $legacyIcons = array_key_exists('icons', $contacts) ? (!empty($contacts['icons']) ? 1 : 0) : 1;
    $rawItems = $contacts['items'] ?? null;
    // Обратная совместимость: старый формат {phone, email, city, show}
    if (!is_array($rawItems) && isset($contacts['phone'])) {
        $rawItems = [
            ['field' => 'phone', 'show' => 1],
            ['field' => 'email', 'show' => 1],
            ['field' => 'city', 'show' => 1],
        ];
    }
    $items = [];
    $seen = [];
    foreach ((is_array($rawItems) ? $rawItems : []) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $field = (string) ($item['field'] ?? '');
        if (!in_array($field, $allowedFields, true) || isset($seen[$field])) {
            continue;
        }
        $seen[$field] = true;
        $items[] = [
            'field' => $field,
            'show' => !empty($item['show']) ? 1 : 0,
            'icon' => array_key_exists('icon', $item) ? (!empty($item['icon']) ? 1 : 0) : $legacyIcons,
            'large' => !empty($item['large']) ? 1 : 0,
            'gap' => !empty($item['gap']) ? 1 : 0,
        ];
    }
    foreach ($allowedFields as $field) {
        if (!isset($seen[$field])) {
            $items[] = ['field' => $field, 'show' => 0, 'icon' => $legacyIcons, 'large' => 0, 'gap' => 0];
        }
    }
    $values['footer.contacts'] = json_encode([
        'items' => $items,
    ], JSON_UNESCAPED_UNICODE);
}

if (array_key_exists('copyright', $config)) {
    $copyright = $config['copyright'] ?? [];
    $values['footer.copyright'] = json_encode([
        'text' => mb_substr(trim((string) ($copyright['text'] ?? '')), 0, 500),
        'large' => !empty($copyright['large']) ? 1 : 0,
    ], JSON_UNESCAPED_UNICODE);
}

if (array_key_exists('bottom_links', $config)) {
    $bottomLinks = $config['bottom_links'] ?? [];
    $normalizedBottom = [];
    foreach ($bottomLinks as $link) {
        if (!is_array($link) || trim((string) ($link['label'] ?? '')) === '') {
            continue;
        }
        $normalizedBottom[] = [
            'label' => mb_substr(trim((string) $link['label']), 0, 255),
            'url' => mb_substr(trim((string) ($link['url'] ?? '')), 0, 500),
        ];
    }
    $values['footer.bottom_links'] = json_encode($normalizedBottom, JSON_UNESCAPED_UNICODE);
}

if ($values === []) {
    respondError(422, 'Пустая конфигурация');
}

try {
    $pdo = db();
    $stmt = $pdo->prepare(
        'INSERT INTO site_content (content_key, content_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE content_value = VALUES(content_value), updated_at = NOW()'
    );
    foreach ($values as $key => $value) {
        $stmt->execute([$key, $value]);
    }
    respondOk(['saved' => true]);
} catch (Throwable $e) {
    error_log('Footer save error: ' . $e->getMessage());
    respondError(500, 'Ошибка сервера');
}
