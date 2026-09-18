<?php
/**
 * Модуль «Услуги»: каталог услуг и товаров.
 *
 * Публичные:
 *  GET  /api/services.php?action=catalog&q=&category=&kind=&page=&per_page=  - список (≤15 на страницу)
 *  GET  /api/services.php?action=item&slug=...    - карточка услуги (медиа, шаблон)
 *  GET  /api/services.php?action=categories       - активные группы
 *
 * Админка (admin/manager):
 *  GET  /api/services.php?action=admin_list       - все услуги
 *  GET  /api/services.php?action=admin_item&id=N  - услуга с медиа
 *  POST /api/services.php?action=save             - создать/обновить услугу
 *  POST /api/services.php?action=delete           - удалить {id}
 *  GET  /api/services.php?action=categories_admin - все группы
 *  POST /api/services.php?action=category_save    - сохранить группу
 *  POST /api/services.php?action=category_delete  - удалить группу {id}
 *  GET  /api/services.php?action=templates        - шаблоны карточек
 *  POST /api/services.php?action=template_save    - сохранить шаблон
 *  POST /api/services.php?action=template_delete  - удалить шаблон {id}
 *  POST /api/services.php?action=section_save     - настройки раздела {enabled, roles}
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

const SERVICE_PAYMENT_METHODS = ['cash', 'card', 'transfer', 'sbp'];

// ---------------------------------------------------------------------
// Вспомогательное
// ---------------------------------------------------------------------

function validateServiceSlug(string $slug): bool
{
    return (bool) preg_match('/^[a-z0-9][a-z0-9-]{1,127}$/', $slug);
}

/** Значение настройки из app_settings. */
function serviceSetting(string $key): ?string
{
    try {
        $stmt = db()->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();
        return $value === false || $value === null ? null : (string) $value;
    } catch (Throwable $e) {
        error_log('Service setting error: ' . $e->getMessage());
        return null;
    }
}

/** Настройки раздела: включён и доступ по ролям. $name — 'services' или 'products'. */
function serviceSection(string $name = 'services'): array
{
    $enabled = serviceSetting($name . '.enabled');
    $rolesRaw = serviceSetting($name . '.roles');
    $roles = null;
    if ($rolesRaw !== null && trim($rolesRaw) !== '') {
        $decoded = json_decode($rolesRaw, true);
        $roles = is_array($decoded) ? array_values($decoded) : [];
    }
    return [
        // Без явной настройки «Услуги» включены, «Товары» — выключены (включаются в админке)
        'enabled' => $enabled === null ? $name !== 'products' : $enabled !== '0',
        'roles' => $roles,
    ];
}

/** Роли из JSON-поля: null — всем, [] — никому, список — этим ролям. */
function serviceRoles(?string $json): ?array
{
    if ($json === null || trim($json) === '') {
        return null;
    }
    $decoded = json_decode($json, true);
    return is_array($decoded) ? array_values($decoded) : [];
}

/** Доступ текущего пользователя по списку ролей. */
function serviceAllowed(?array $roles): bool
{
    if ($roles === null) {
        return true;
    }
    if ($roles === []) {
        return false;
    }
    $user = currentUser();
    $role = (string) ($user['role'] ?? 'guest');
    return in_array($role, $roles, true);
}

/** Нормализация ролей из запроса (как у страниц). */
function normalizeServiceRoles($value, array $roleCodes): ?array
{
    if ($value === null) {
        return null;
    }
    if (!is_array($value)) {
        return null;
    }
    if ($value === []) {
        return [];
    }
    $out = [];
    foreach ($value as $code) {
        $code = trim((string) $code);
        if ($code !== '' && in_array($code, $roleCodes, true)) {
            $out[] = $code;
        }
    }
    return array_values(array_unique($out));
}

/** Строка услуги для API. */
function serviceOut(array $row, bool $full = false): array
{
    $out = [
        'id' => (int) $row['id'],
        'slug' => (string) $row['slug'],
        'kind' => (string) $row['kind'],
        'title' => (string) $row['title'],
        'short_description' => (string) ($row['short_description'] ?? ''),
        'price' => $row['price'] === null ? null : (float) $row['price'],
        'price_prefix' => (string) $row['price_prefix'],
        'price_note' => $row['price_note'] !== null ? (string) $row['price_note'] : null,
        'icon' => $row['icon'] !== null && $row['icon'] !== '' ? (string) $row['icon'] : null,
        'unit' => (string) $row['unit'],
        'duration_min' => (int) $row['duration_min'],
        'category_id' => $row['category_id'] !== null ? (int) $row['category_id'] : null,
        'category_title' => isset($row['category_title']) ? (string) $row['category_title'] : null,
        'category_slug' => isset($row['category_slug']) ? (string) $row['category_slug'] : null,
        'rating_avg' => round((float) $row['rating_avg'], 2),
        'rating_count' => (int) $row['rating_count'],
        'comments_count' => (int) $row['comments_count'],
        'cover' => isset($row['cover']) && $row['cover'] !== '' ? (string) $row['cover'] : null,
        'booking_enabled' => (bool) $row['booking_enabled'],
        'shop_enabled' => (bool) $row['shop_enabled'],
        'comments_enabled' => (bool) $row['comments_enabled'],
        'rating_enabled' => (bool) $row['rating_enabled'],
        'active' => (bool) $row['active'],
        'sort_order' => (int) $row['sort_order'],
    ];
    if (!$full) {
        return $out;
    }
    $methods = json_decode((string) ($row['payment_methods'] ?? '[]'), true);
    $out += [
        'full_description' => (string) ($row['full_description'] ?? ''),
        'buffer_before_min' => (int) $row['buffer_before_min'],
        'buffer_after_min' => (int) $row['buffer_after_min'],
        'address' => $row['address'] !== null ? (string) $row['address'] : null,
        'map_lat' => $row['map_lat'] !== null ? (float) $row['map_lat'] : null,
        'map_lng' => $row['map_lng'] !== null ? (float) $row['map_lng'] : null,
        'auto_confirm' => (bool) $row['auto_confirm'],
        'prepay' => (bool) $row['prepay'],
        'postpay' => (bool) $row['postpay'],
        'payment_methods' => is_array($methods) ? array_values($methods) : [],
        'roles' => serviceRoles($row['roles'] ?? null),
        'template_id' => $row['template_id'] !== null ? (int) $row['template_id'] : null,
        'meta_title' => $row['meta_title'] !== null ? (string) $row['meta_title'] : null,
        'meta_description' => $row['meta_description'] !== null ? (string) $row['meta_description'] : null,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
    return $out;
}

/** Медиа услуги. */
function serviceMedia(int $serviceId): array
{
    $stmt = db()->prepare(
        'SELECT id, media_id, url, sort_order, is_cover FROM service_media WHERE service_id = ? ORDER BY sort_order, id'
    );
    $stmt->execute([$serviceId]);
    return array_map(static fn(array $m): array => [
        'id' => (int) $m['id'],
        'media_id' => $m['media_id'] !== null ? (int) $m['media_id'] : null,
        'url' => (string) $m['url'],
        'is_cover' => (bool) $m['is_cover'],
    ], $stmt->fetchAll(PDO::FETCH_ASSOC));
}

/** Обложки для списка (одним запросом). */
function serviceCovers(array $serviceIds): array
{
    if ($serviceIds === []) {
        return [];
    }
    $in = implode(',', array_fill(0, count($serviceIds), '?'));
    $stmt = db()->prepare(
        "SELECT service_id, url FROM service_media WHERE service_id IN ($in) ORDER BY is_cover DESC, sort_order, id"
    );
    $stmt->execute(array_values($serviceIds));
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $id = (int) $row['service_id'];
        if (!isset($out[$id])) {
            $out[$id] = (string) $row['url'];
        }
    }
    return $out;
}

/** Шаблон карточки: по id услуги или по умолчанию для её типа. */
function serviceTemplate(?int $templateId, string $kind): ?array
{
    $pdo = db();
    if ($templateId !== null) {
        $stmt = $pdo->prepare('SELECT id, name, kind, fields FROM card_templates WHERE id = ?');
        $stmt->execute([$templateId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            return serviceTemplateOut($row);
        }
    }
    $stmt = $pdo->prepare('SELECT id, name, kind, fields FROM card_templates WHERE kind = ? ORDER BY is_default DESC, id LIMIT 1');
    $stmt->execute([$kind]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? serviceTemplateOut($row) : null;
}

function serviceTemplateOut(array $row): array
{
    $fields = json_decode((string) $row['fields'], true);
    return [
        'id' => (int) $row['id'],
        'name' => (string) $row['name'],
        'kind' => (string) $row['kind'],
        'fields' => is_array($fields) ? array_values($fields) : [],
    ];
}

/** Нормализация услуги из запроса. */
function normalizeServiceData(array $data, array $roleCodes): array
{
    $slug = strtolower(trim((string) ($data['slug'] ?? '')));
    $title = trim((string) ($data['title'] ?? ''));
    $kind = ($data['kind'] ?? 'service') === 'product' ? 'product' : 'service';
    $priceRaw = $data['price'] ?? null;
    $price = $priceRaw === null || $priceRaw === '' ? null : round((float) $priceRaw, 2);
    $prefix = ($data['price_prefix'] ?? 'none') === 'from' ? 'from' : 'none';
    $unit = ($data['unit'] ?? 'piece') === 'time' ? 'time' : 'piece';
    $methods = [];
    foreach ((array) ($data['payment_methods'] ?? []) as $m) {
        $m = trim((string) $m);
        if (in_array($m, SERVICE_PAYMENT_METHODS, true) && !in_array($m, $methods, true)) {
            $methods[] = $m;
        }
    }

    if ($slug === '' || !validateServiceSlug($slug)) {
        respondError(422, 'Некорректный адрес услуги (a-z, 0-9, дефис)');
    }
    if ($title === '') {
        respondError(422, 'Укажите название услуги');
    }
    if ($price !== null && $price < 0) {
        respondError(422, 'Стоимость не может быть отрицательной');
    }
    if (mb_strlen($title) > 255) {
        respondError(422, 'Название слишком длинное');
    }

    return [
        'slug' => $slug,
        'kind' => $kind,
        'title' => $title,
        'short_description' => trim((string) ($data['short_description'] ?? '')),
        'full_description' => trim((string) ($data['full_description'] ?? '')),
        'price' => $price,
        'price_prefix' => $prefix,
        'price_note' => trim((string) ($data['price_note'] ?? '')) ?: null,
        'icon' => mb_substr(trim((string) ($data['icon'] ?? '')), 0, 16) ?: null,
        'unit' => $unit,
        'duration_min' => min(1440, max(5, (int) ($data['duration_min'] ?? 60))),
        'buffer_before_min' => min(1440, max(0, (int) ($data['buffer_before_min'] ?? 0))),
        'buffer_after_min' => min(1440, max(0, (int) ($data['buffer_after_min'] ?? 0))),
        'category_id' => (int) ($data['category_id'] ?? 0) ?: null,
        'template_id' => (int) ($data['template_id'] ?? 0) ?: null,
        'address' => trim((string) ($data['address'] ?? '')) ?: null,
        'map_lat' => ($data['map_lat'] ?? '') === '' ? null : (float) $data['map_lat'],
        'map_lng' => ($data['map_lng'] ?? '') === '' ? null : (float) $data['map_lng'],
        'booking_enabled' => !empty($data['booking_enabled']) ? 1 : 0,
        'shop_enabled' => !empty($data['shop_enabled']) ? 1 : 0,
        'comments_enabled' => !empty($data['comments_enabled']) ? 1 : 0,
        'rating_enabled' => !empty($data['rating_enabled']) ? 1 : 0,
        'auto_confirm' => !empty($data['auto_confirm']) ? 1 : 0,
        'prepay' => !empty($data['prepay']) ? 1 : 0,
        'postpay' => !empty($data['postpay']) ? 1 : 0,
        'payment_methods' => json_encode($methods, JSON_UNESCAPED_UNICODE),
        'roles' => ($roles = normalizeServiceRoles($data['roles'] ?? null, $roleCodes)) === null
            ? null
            : json_encode($roles, JSON_UNESCAPED_UNICODE),
        'active' => !empty($data['active']) ? 1 : 0,
        'sort_order' => (int) ($data['sort_order'] ?? 100),
        'meta_title' => trim((string) ($data['meta_title'] ?? '')) ?: null,
        'meta_description' => trim((string) ($data['meta_description'] ?? '')) ?: null,
    ];
}

// ---------------------------------------------------------------------
// Публичные действия
// ---------------------------------------------------------------------

if ($method === 'GET' && $action === 'catalog') {
    $kind = trim((string) ($_GET['kind'] ?? ''));
    $isProducts = $kind === 'product';
    $section = serviceSection($isProducts ? 'products' : 'services');
    if (!$section['enabled']) {
        respondError(404, $isProducts ? 'Раздел товаров недоступен' : 'Раздел услуг недоступен');
    }
    $sectionAllowed = serviceAllowed($section['roles']);

    $q = trim((string) ($_GET['q'] ?? ''));
    $category = trim((string) ($_GET['category'] ?? ''));
    $booking = trim((string) ($_GET['booking'] ?? ''));
    $sort = trim((string) ($_GET['sort'] ?? ''));
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(50, max(1, (int) ($_GET['per_page'] ?? 15)));

    if (!$sectionAllowed) {
        respondOk([
            'restricted' => true,
            'items' => [],
            'categories' => [],
            'total' => 0,
            'page' => 1,
            'per_page' => $perPage,
            'pages' => 1,
        ]);
    }

    // Разделы не смешиваются: /services — только услуги, /products — только товары
    $where = ['s.active = 1', 's.kind = ?'];
    $params = [$isProducts ? 'product' : 'service'];
    if ($q !== '') {
        $where[] = '(s.title LIKE ? OR s.short_description LIKE ?)';
        $params[] = '%' . $q . '%';
        $params[] = '%' . $q . '%';
    }
    if ($booking === '1') {
        $where[] = 's.booking_enabled = 1';
    }
    if ($category !== '') {
        $where[] = 'c.slug = ?';
        $params[] = $category;
    }

    // Сортировка каталога (выпадающий список на сайте)
    $orderBy = 's.sort_order, s.id';
    if ($sort === 'price_asc') {
        $orderBy = '(s.price IS NULL), s.price ASC, s.sort_order, s.id';
    } elseif ($sort === 'price_desc') {
        $orderBy = '(s.price IS NULL), s.price DESC, s.sort_order, s.id';
    } elseif ($sort === 'title') {
        $orderBy = 's.title ASC, s.id';
    } elseif ($sort === 'rating') {
        $orderBy = 's.rating_avg DESC, s.rating_count DESC, s.sort_order, s.id';
    }

    try {
        $sql = 'SELECT s.*, c.title AS category_title, c.slug AS category_slug
                FROM services s
                LEFT JOIN service_categories c ON c.id = s.category_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY ' . $orderBy;
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        error_log('Services catalog error: ' . $e->getMessage());
        respondError(500, 'Ошибка загрузки услуг');
    }

    // Фильтр по ролям (у каждой услуги свой доступ) и пагинация
    $rows = array_values(array_filter($rows, static fn(array $r): bool => serviceAllowed(serviceRoles($r['roles'] ?? null))));
    $total = count($rows);
    $pages = max(1, (int) ceil($total / $perPage));
    $page = min($page, $pages);
    $slice = array_slice($rows, ($page - 1) * $perPage, $perPage);

    $covers = serviceCovers(array_map(static fn(array $r): int => (int) $r['id'], $slice));
    $items = [];
    foreach ($slice as $row) {
        $item = serviceOut($row);
        $item['cover'] = $covers[(int) $row['id']] ?? null;
        $items[] = $item;
    }

    $catStmt = db()->prepare(
        'SELECT c.id, c.title, c.slug, COUNT(s.id) AS services_count
         FROM service_categories c
         LEFT JOIN services s ON s.category_id = c.id AND s.active = 1 AND s.kind = ?
         WHERE c.active = 1 AND (c.kind IS NULL OR c.kind = ?)
         GROUP BY c.id, c.title, c.slug
         ORDER BY c.sort_order, c.id'
    );
    $catStmt->execute([$isProducts ? 'product' : 'service', $isProducts ? 'product' : 'service']);
    $categories = array_map(static fn(array $c): array => [
        'id' => (int) $c['id'],
        'title' => (string) $c['title'],
        'slug' => (string) $c['slug'],
        'services_count' => (int) $c['services_count'],
    ], $catStmt->fetchAll(PDO::FETCH_ASSOC));

    respondOk([
        'restricted' => false,
        'items' => $items,
        'categories' => $categories,
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'pages' => $pages,
    ]);
}

if ($method === 'GET' && $action === 'item') {
    $slug = strtolower(trim((string) ($_GET['slug'] ?? '')));
    if ($slug === '' || !validateServiceSlug($slug)) {
        respondError(422, 'Некорректный адрес услуги');
    }
    try {
        $stmt = db()->prepare(
            'SELECT s.*, c.title AS category_title, c.slug AS category_slug
             FROM services s
             LEFT JOIN service_categories c ON c.id = s.category_id
             WHERE s.slug = ? AND s.active = 1 LIMIT 1'
        );
        $stmt->execute([$slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        error_log('Service item error: ' . $e->getMessage());
        respondError(500, 'Ошибка загрузки услуги');
    }
    if (!$row) {
        respondError(404, 'Услуга не найдена');
    }

    // Раздел проверяется по типу позиции: услуга — services, товар — products
    $isProduct = ($row['kind'] ?? '') === 'product';
    $section = serviceSection($isProduct ? 'products' : 'services');
    if (!$section['enabled']) {
        respondError(404, $isProduct ? 'Раздел товаров недоступен' : 'Раздел услуг недоступен');
    }

    $allowed = serviceAllowed($section['roles']) && serviceAllowed(serviceRoles($row['roles'] ?? null));
    if (!$allowed) {
        respondOk(['restricted' => true, 'item' => null]);
    }

    $item = serviceOut($row, true);
    $item['media'] = serviceMedia((int) $row['id']);
    $item['cover'] = $item['media'][0]['url'] ?? null;
    $item['template'] = serviceTemplate($item['template_id'], (string) $row['kind']);
    respondOk(['restricted' => false, 'item' => $item]);
}

if ($method === 'GET' && $action === 'categories') {
    $kind = trim((string) ($_GET['kind'] ?? ''));
    $isProducts = $kind === 'product';
    $section = serviceSection($isProducts ? 'products' : 'services');
    if (!$section['enabled'] || !serviceAllowed($section['roles'])) {
        respondOk(['categories' => []]);
    }
    $stmt = db()->prepare(
        'SELECT c.id, c.title, c.slug, COUNT(s.id) AS services_count
         FROM service_categories c
         LEFT JOIN services s ON s.category_id = c.id AND s.active = 1 AND s.kind = ?
         WHERE c.active = 1 AND (c.kind IS NULL OR c.kind = ?)
         GROUP BY c.id, c.title, c.slug
         ORDER BY c.sort_order, c.id'
    );
    $stmt->execute([$isProducts ? 'product' : 'service', $isProducts ? 'product' : 'service']);
    respondOk([
        'categories' => array_map(static fn(array $c): array => [
            'id' => (int) $c['id'],
            'title' => (string) $c['title'],
            'slug' => (string) $c['slug'],
            'services_count' => (int) $c['services_count'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)),
    ]);
}

// ---------------------------------------------------------------------
// Админка
// ---------------------------------------------------------------------

requireRole(['admin', 'manager']);

if ($method === 'GET' && $action === 'admin_list') {
    $q = trim((string) ($_GET['q'] ?? ''));
    $kind = trim((string) ($_GET['kind'] ?? ''));
    $category = (int) ($_GET['category'] ?? 0);
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(200, max(10, (int) ($_GET['per_page'] ?? 50)));

    $where = ['1=1'];
    $params = [];
    if ($q !== '') {
        $where[] = '(s.title LIKE ? OR s.slug LIKE ?)';
        $params[] = '%' . $q . '%';
        $params[] = '%' . $q . '%';
    }
    if ($kind === 'service' || $kind === 'product') {
        $where[] = 's.kind = ?';
        $params[] = $kind;
    }
    if ($category > 0) {
        $where[] = 's.category_id = ?';
        $params[] = $category;
    }

    $whereSql = implode(' AND ', $where);
    $countStmt = db()->prepare(
        'SELECT COUNT(*) FROM services s LEFT JOIN service_categories c ON c.id = s.category_id WHERE ' . $whereSql
    );
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();
    $pages = max(1, (int) ceil($total / $perPage));
    $page = min($page, $pages);

    $stmt = db()->prepare(
        'SELECT s.*, c.title AS category_title, c.slug AS category_slug
         FROM services s
         LEFT JOIN service_categories c ON c.id = s.category_id
         WHERE ' . $whereSql . '
         ORDER BY s.sort_order, s.id
         LIMIT ' . $perPage . ' OFFSET ' . (($page - 1) * $perPage)
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $covers = serviceCovers(array_map(static fn(array $r): int => (int) $r['id'], $rows));

    $items = [];
    foreach ($rows as $row) {
        $item = serviceOut($row, true);
        $item['cover'] = $covers[(int) $row['id']] ?? null;
        $items[] = $item;
    }
    respondOk([
        'items' => $items,
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'pages' => $pages,
    ]);
}

if ($method === 'GET' && $action === 'admin_item') {
    $id = (int) ($_GET['id'] ?? 0);
    $stmt = db()->prepare(
        'SELECT s.*, c.title AS category_title, c.slug AS category_slug
         FROM services s LEFT JOIN service_categories c ON c.id = s.category_id
         WHERE s.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        respondError(404, 'Услуга не найдена');
    }
    $item = serviceOut($row, true);
    $item['media'] = serviceMedia($id);
    respondOk(['item' => $item]);
}

if ($method === 'POST' && $action === 'save') {
    verifyCsrf();
    $data = inputJson();
    $roleCodes = [];
    try {
        $roleCodes = db()->query('SELECT code FROM roles')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    } catch (Throwable $e) {
        error_log('Roles lookup error: ' . $e->getMessage());
    }
    $p = normalizeServiceData($data, $roleCodes);
    $id = (int) ($data['id'] ?? 0);

    try {
        $pdo = db();
        $dup = $pdo->prepare('SELECT id FROM services WHERE slug = ? AND id <> ?');
        $dup->execute([$p['slug'], $id]);
        if ($dup->fetchColumn()) {
            respondError(422, 'Услуга с таким адресом уже существует');
        }

        if ($id > 0) {
            $fields = [];
            $params = [];
            foreach ($p as $key => $value) {
                $fields[] = "$key = :$key";
                $params[":$key"] = $value;
            }
            $params[':id'] = $id;
            $pdo->prepare('UPDATE services SET ' . implode(', ', $fields) . ' WHERE id = :id')->execute($params);
        } else {
            $cols = array_keys($p);
            $placeholders = array_map(static fn(string $c): string => ":$c", $cols);
            $pdo->prepare('INSERT INTO services (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $placeholders) . ')')
                ->execute($p);
            $id = (int) $pdo->lastInsertId();
        }

        // Медиа: полная замена набора
        if (isset($data['media']) && is_array($data['media'])) {
            $pdo->prepare('DELETE FROM service_media WHERE service_id = ?')->execute([$id]);
            $coverSet = false;
            $rows = [];
            foreach ($data['media'] as $m) {
                if (!is_array($m)) {
                    continue;
                }
                $url = trim((string) ($m['url'] ?? ''));
                if ($url === '') {
                    continue;
                }
                $rows[] = [
                    'media_id' => (int) ($m['media_id'] ?? 0) ?: null,
                    'url' => mb_substr($url, 0, 512),
                    'is_cover' => !empty($m['is_cover']) ? 1 : 0,
                ];
            }
            foreach ($rows as $i => $m) {
                $isCover = $m['is_cover'] === 1 && !$coverSet ? 1 : 0;
                if ($isCover) {
                    $coverSet = true;
                }
                $pdo->prepare(
                    'INSERT INTO service_media (service_id, media_id, url, sort_order, is_cover) VALUES (?, ?, ?, ?, ?)'
                )->execute([$id, $m['media_id'], $m['url'], 100 + $i * 10, $isCover]);
            }
            if (!$coverSet && $rows !== []) {
                $pdo->prepare('UPDATE service_media SET is_cover = 1 WHERE service_id = ? ORDER BY sort_order, id LIMIT 1')->execute([$id]);
            }
        }

        $stmt = $pdo->prepare('SELECT s.*, c.title AS category_title, c.slug AS category_slug FROM services s LEFT JOIN service_categories c ON c.id = s.category_id WHERE s.id = ?');
        $stmt->execute([$id]);
        $item = serviceOut($stmt->fetch(PDO::FETCH_ASSOC), true);
        $item['media'] = serviceMedia($id);
        respondOk(['item' => $item]);
    } catch (Throwable $e) {
        error_log('Service save error: ' . $e->getMessage());
        respondError(500, 'Не удалось сохранить услугу');
    }
}

if ($method === 'POST' && $action === 'delete') {
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Некорректная услуга');
    }
    try {
        $pdo = db();
        $pdo->prepare('DELETE FROM service_media WHERE service_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM services WHERE id = ?')->execute([$id]);
        respondOk();
    } catch (Throwable $e) {
        error_log('Service delete error: ' . $e->getMessage());
        respondError(500, 'Не удалось удалить услугу');
    }
}

// ---- Группы услуг ----

if ($method === 'GET' && $action === 'categories_admin') {
    $stmt = db()->query(
        'SELECT c.*, COUNT(s.id) AS services_count
         FROM service_categories c
         LEFT JOIN services s ON s.category_id = c.id
         GROUP BY c.id
         ORDER BY c.sort_order, c.id'
    );
    respondOk([
        'categories' => array_map(static fn(array $c): array => [
            'id' => (int) $c['id'],
            'parent_id' => $c['parent_id'] !== null ? (int) $c['parent_id'] : null,
            'title' => (string) $c['title'],
            'slug' => (string) $c['slug'],
            'kind' => $c['kind'] !== null && $c['kind'] !== '' ? (string) $c['kind'] : null,
            'sort_order' => (int) $c['sort_order'],
            'active' => (bool) $c['active'],
            'services_count' => (int) $c['services_count'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)),
    ]);
}

if ($method === 'POST' && $action === 'category_save') {
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    $title = trim((string) ($data['title'] ?? ''));
    $slug = strtolower(trim((string) ($data['slug'] ?? '')));
    $kind = in_array($data['kind'] ?? null, ['service', 'product'], true) ? (string) $data['kind'] : null;
    if ($title === '') {
        respondError(422, 'Укажите название группы');
    }
    if ($slug === '' || !validateServiceSlug($slug)) {
        respondError(422, 'Некорректный адрес группы (a-z, 0-9, дефис)');
    }
    $parentId = (int) ($data['parent_id'] ?? 0) ?: null;
    if ($parentId === $id) {
        $parentId = null;
    }
    try {
        $pdo = db();
        $dup = $pdo->prepare('SELECT id FROM service_categories WHERE slug = ? AND id <> ?');
        $dup->execute([$slug, $id]);
        if ($dup->fetchColumn()) {
            respondError(422, 'Группа с таким адресом уже существует');
        }
        $params = [
            ':title' => $title,
            ':slug' => $slug,
            ':parent_id' => $parentId,
            ':kind' => $kind,
            ':sort_order' => (int) ($data['sort_order'] ?? 100),
            ':active' => !empty($data['active']) ? 1 : 0,
        ];
        if ($id > 0) {
            $params[':id'] = $id;
            $pdo->prepare('UPDATE service_categories SET title = :title, slug = :slug, parent_id = :parent_id, kind = :kind, sort_order = :sort_order, active = :active WHERE id = :id')->execute($params);
        } else {
            $pdo->prepare('INSERT INTO service_categories (title, slug, parent_id, kind, sort_order, active) VALUES (:title, :slug, :parent_id, :kind, :sort_order, :active)')->execute($params);
            $id = (int) $pdo->lastInsertId();
        }
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('Service category save error: ' . $e->getMessage());
        respondError(500, 'Не удалось сохранить группу');
    }
}

if ($method === 'POST' && $action === 'category_delete') {
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Некорректная группа');
    }
    try {
        $pdo = db();
        $pdo->prepare('UPDATE services SET category_id = NULL WHERE category_id = ?')->execute([$id]);
        $pdo->prepare('UPDATE service_categories SET parent_id = NULL WHERE parent_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM service_categories WHERE id = ?')->execute([$id]);
        respondOk();
    } catch (Throwable $e) {
        error_log('Service category delete error: ' . $e->getMessage());
        respondError(500, 'Не удалось удалить группу');
    }
}

// ---- Шаблоны карточек ----

if ($method === 'GET' && $action === 'templates') {
    $stmt = db()->query('SELECT * FROM card_templates ORDER BY kind, is_default DESC, id');
    respondOk([
        'templates' => array_map('serviceTemplateOut', $stmt->fetchAll(PDO::FETCH_ASSOC)),
    ]);
}

if ($method === 'POST' && $action === 'template_save') {
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    $name = trim((string) ($data['name'] ?? ''));
    $kind = ($data['kind'] ?? 'service') === 'product' ? 'product' : 'service';
    $fields = [];
    foreach ((array) ($data['fields'] ?? []) as $f) {
        if (!is_array($f)) {
            continue;
        }
        $key = trim((string) ($f['key'] ?? ''));
        if ($key === '') {
            continue;
        }
        $fields[] = ['key' => $key, 'on' => !empty($f['on'])];
    }
    if ($name === '') {
        respondError(422, 'Укажите название шаблона');
    }
    if ($fields === []) {
        respondError(422, 'Добавьте поля карточки');
    }
    try {
        $pdo = db();
        $json = json_encode($fields, JSON_UNESCAPED_UNICODE);
        if ($id > 0) {
            $pdo->prepare('UPDATE card_templates SET name = ?, kind = ?, fields = ?, is_default = ? WHERE id = ?')
                ->execute([$name, $kind, $json, !empty($data['is_default']) ? 1 : 0, $id]);
        } else {
            $pdo->prepare('INSERT INTO card_templates (name, kind, fields, is_default) VALUES (?, ?, ?, ?)')
                ->execute([$name, $kind, $json, !empty($data['is_default']) ? 1 : 0]);
            $id = (int) $pdo->lastInsertId();
        }
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('Template save error: ' . $e->getMessage());
        respondError(500, 'Не удалось сохранить шаблон');
    }
}

if ($method === 'POST' && $action === 'template_delete') {
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Некорректный шаблон');
    }
    try {
        $pdo = db();
        $pdo->prepare('UPDATE services SET template_id = NULL WHERE template_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM card_templates WHERE id = ?')->execute([$id]);
        respondOk();
    } catch (Throwable $e) {
        error_log('Template delete error: ' . $e->getMessage());
        respondError(500, 'Не удалось удалить шаблон');
    }
}

// ---- Настройки разделов («Услуги» и «Товары») ----

if ($method === 'GET' && $action === 'section') {
    respondOk(['sections' => [
        'services' => serviceSection('services'),
        'products' => serviceSection('products'),
    ]]);
}

if ($method === 'POST' && $action === 'section_save') {
    verifyCsrf();
    $data = inputJson();
    $name = ($data['name'] ?? 'services') === 'products' ? 'products' : 'services';
    $roleCodes = [];
    try {
        $roleCodes = db()->query('SELECT code FROM roles')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    } catch (Throwable $e) {
        error_log('Roles lookup error: ' . $e->getMessage());
    }
    $roles = normalizeServiceRoles($data['roles'] ?? null, $roleCodes);
    try {
        $pdo = db();
        $enabled = !empty($data['enabled']) ? '1' : '0';
        $pdo->prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)')
            ->execute([$name . '.enabled', $enabled]);
        $pdo->prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)')
            ->execute([$name . '.roles', $roles === null ? null : json_encode($roles, JSON_UNESCAPED_UNICODE)]);
        respondOk(['sections' => [
            'services' => serviceSection('services'),
            'products' => serviceSection('products'),
        ]]);
    } catch (Throwable $e) {
        error_log('Section save error: ' . $e->getMessage());
        respondError(500, 'Не удалось сохранить настройки раздела');
    }
}

respondError(404, 'Неизвестное действие');
