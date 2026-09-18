<?php
/**
 * Управление пользователями админки (только admin):
 *  GET  /api/users.php              — список пользователей
 *  POST /api/users.php?action=create {login, password, role, ...профиль}
 *  POST /api/users.php?action=update {id, ...поля, password?}
 *  POST /api/users.php?action=delete {id}
 *
 * Поля профиля: last_name, first_name, middle_name, birth_date, country, region,
 * city, address, phone, max_link, telegram, whatsapp, site, avatar_media_id,
 * admin_comment. full_name собирается из ФИО.
 *
 * Системные учётные записи (is_system = 1, «Администратор» и «Менеджер»):
 * нельзя заблокировать и удалить; можно переименовать, сменить пароль и
 * отредактировать профиль.
 *
 * Уведомления на email (если он есть и настроен почтовый сервис):
 *  - при создании учётной записи — логин и пароль;
 *  - при смене пароля — новый пароль.
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/email_queue.php';

$user = requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

/** Роли для назначения — все, кроме гостя (гость — неавторизованные). */
function allowedRoles(PDO $pdo): array
{
    try {
        $codes = $pdo->query("SELECT code FROM roles WHERE code <> 'guest' ORDER BY sort_order, id")
            ->fetchAll(PDO::FETCH_COLUMN);
        if ($codes) {
            return $codes;
        }
    } catch (Throwable $e) {
        error_log('Roles lookup error: ' . $e->getMessage());
    }
    return ['client', 'manager', 'admin'];
}

/** Текстовые поля профиля: ключ => максимальная длина. */
const PROFILE_FIELDS = [
    'last_name' => 100,
    'first_name' => 100,
    'middle_name' => 100,
    'country' => 100,
    'region' => 100,
    'city' => 100,
    'address' => 255,
    'phone' => 32,
    'max_link' => 255,
    'telegram' => 255,
    'whatsapp' => 255,
    'site' => 255,
    'admin_comment' => 4000,
];

/** Значение поля профиля: null — не передано или пусто. */
function profileValue(array $data, string $key, int $limit): ?string
{
    if (!array_key_exists($key, $data)) {
        return null;
    }
    $value = trim((string) $data[$key]);
    return $value === '' ? null : mb_substr($value, 0, $limit);
}

/** Дата рождения в формате YYYY-MM-DD; null — не передано или пусто. */
function birthDateValue(array $data): ?string
{
    if (!array_key_exists('birth_date', $data)) {
        return null;
    }
    $value = trim((string) $data['birth_date']);
    if ($value === '') {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        respondError(422, 'Некорректная дата рождения (ожидается ГГГГ-ММ-ДД)');
    }
    return $value;
}

/** ID аватара: null — не передано, 0 — убрать, >0 — media.id. */
function avatarValue(array $data): ?int
{
    if (!array_key_exists('avatar_media_id', $data)) {
        return null;
    }
    $value = (int) ($data['avatar_media_id'] ?? 0);
    return $value > 0 ? $value : 0;
}

/** ФИО одной строкой. Если все части пусты — оставляем текущее значение. */
function composeFullName(?string $last, ?string $first, ?string $middle, ?string $current): ?string
{
    $parts = [];
    foreach ([$last, $first, $middle] as $part) {
        $part = trim((string) $part);
        if ($part !== '') {
            $parts[] = $part;
        }
    }
    return $parts ? implode(' ', $parts) : $current;
}

/** Строка пользователя для фронта. */
function userRow(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'login' => $row['login'],
        'email' => $row['email'],
        'role' => $row['role'],
        'full_name' => $row['full_name'],
        'last_name' => $row['last_name'],
        'first_name' => $row['first_name'],
        'middle_name' => $row['middle_name'],
        'birth_date' => $row['birth_date'],
        'country' => $row['country'],
        'region' => $row['region'],
        'city' => $row['city'],
        'address' => $row['address'],
        'phone' => $row['phone'],
        'max_link' => $row['max_link'],
        'telegram' => $row['telegram'],
        'whatsapp' => $row['whatsapp'],
        'site' => $row['site'],
        'avatar_media_id' => $row['avatar_media_id'] !== null ? (int) $row['avatar_media_id'] : null,
        'avatar_url' => $row['avatar_url'] ?? null,
        'admin_comment' => $row['admin_comment'],
        'active' => (int) $row['active'],
        'is_system' => (int) $row['is_system'],
        'created_at' => $row['created_at'],
        'last_login_at' => $row['last_login_at'],
    ];
}

/** Письмо о создании учётной записи (через очередь — не теряется при сбое). */
function notifyAccountCreated(array $account, string $password): bool
{
    $email = trim((string) ($account['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $name = trim((string) ($account['full_name'] ?? '')) ?: (string) $account['login'];
    $login = (string) $account['login'];
    $subject = 'Учётная запись создана';
    $text = "Здравствуйте, {$name}!\n\n"
        . "Для вас создана учётная запись.\n"
        . "Логин: {$login}\n"
        . "Пароль: {$password}\n\n"
        . 'Рекомендуем сменить пароль после первого входа.';
    $html = '<p>Здравствуйте, ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '!</p>'
        . '<p>Для вас создана учётная запись.</p>'
        . '<p><b>Логин:</b> ' . htmlspecialchars($login, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Пароль:</b> ' . htmlspecialchars($password, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p>Рекомендуем сменить пароль после первого входа.</p>';
    $id = emailQueueAdd($email, $subject, $html, $text, 'registration');
    emailQueueTrySendNow($id);
    return true;
}

/** Письмо о смене пароля (через очередь). */
function notifyPasswordChanged(array $account, string $password): bool
{
    $email = trim((string) ($account['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $login = (string) $account['login'];
    $subject = 'Пароль изменён';
    $text = "Здравствуйте!\n\n"
        . "Пароль от вашей учётной записи изменён.\n"
        . "Логин: {$login}\n"
        . "Новый пароль: {$password}\n\n"
        . 'Если вы не запрашивали смену пароля — свяжитесь с администратором сайта.';
    $html = '<p>Здравствуйте!</p>'
        . '<p>Пароль от вашей учётной записи изменён.</p>'
        . '<p><b>Логин:</b> ' . htmlspecialchars($login, ENT_QUOTES, 'UTF-8') . '<br>'
        . '<b>Новый пароль:</b> ' . htmlspecialchars($password, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p>Если вы не запрашивали смену пароля — свяжитесь с администратором сайта.</p>';
    $id = emailQueueAdd($email, $subject, $html, $text, 'actions');
    emailQueueTrySendNow($id);
    return true;
}

// ---------------------------------------------------------------------
// GET — список
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === '') {
    try {
        $stmt = db()->query(
            'SELECT u.*, m.url AS avatar_url
             FROM users u
             LEFT JOIN media m ON m.id = u.avatar_media_id
             ORDER BY u.id'
        );
        respondOk(['users' => array_map('userRow', $stmt->fetchAll())]);
    } catch (Throwable $e) {
        error_log('Users list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

if ($method !== 'POST') {
    respondError(405, 'Метод не поддерживается');
}

verifyCsrf();
$data = inputJson();

// ---------------------------------------------------------------------
// Создание
// ---------------------------------------------------------------------
if ($action === 'create') {
    $login = trim((string) ($data['login'] ?? ''));
    $password = (string) ($data['password'] ?? '');
    $role = trim((string) ($data['role'] ?? 'client'));
    $email = trim((string) ($data['email'] ?? ''));
    $active = isset($data['active']) ? (int) (bool) $data['active'] : 1;

    if ($login === '' || !preg_match('/^[a-zA-Z0-9_\.\-]{3,64}$/', $login)) {
        respondError(422, 'Некорректный логин (3-64 символа, буквы/цифры/_-.)');
    }
    if (strlen($password) < 6) {
        respondError(422, 'Пароль должен быть не менее 6 символов');
    }
    if (!in_array($role, allowedRoles(db()), true)) {
        respondError(422, 'Некорректная роль');
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respondError(422, 'Некорректный email');
    }

    $profile = [];
    foreach (PROFILE_FIELDS as $key => $limit) {
        $profile[$key] = profileValue($data, $key, $limit);
    }
    $birthDate = birthDateValue($data);
    $avatarId = avatarValue($data);

    $fullName = composeFullName(
        $profile['last_name'],
        $profile['first_name'],
        $profile['middle_name'],
        null,
    );

    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id FROM users WHERE login = ?');
        $stmt->execute([$login]);
        if ($stmt->fetch()) {
            respondError(409, 'Логин уже занят');
        }
        if ($email !== '') {
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                respondError(409, 'Email уже занят');
            }
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users
                (login, email, password_hash, role, full_name,
                 last_name, first_name, middle_name, birth_date, country, region, city,
                 address, phone, max_link, telegram, whatsapp, site, avatar_media_id,
                 admin_comment, active, is_system)
             VALUES
                (:login, :email, :pass, :role, :full_name,
                 :last_name, :first_name, :middle_name, :birth_date, :country, :region, :city,
                 :address, :phone, :max_link, :telegram, :whatsapp, :site, :avatar_media_id,
                 :admin_comment, :active, 0)'
        );
        $stmt->execute([
            'login' => $login,
            'email' => $email !== '' ? $email : null,
            'pass' => password_hash($password, PASSWORD_BCRYPT),
            'role' => $role,
            'full_name' => $fullName,
            'last_name' => $profile['last_name'],
            'first_name' => $profile['first_name'],
            'middle_name' => $profile['middle_name'],
            'birth_date' => $birthDate,
            'country' => $profile['country'],
            'region' => $profile['region'],
            'city' => $profile['city'],
            'address' => $profile['address'],
            'phone' => $profile['phone'],
            'max_link' => $profile['max_link'],
            'telegram' => $profile['telegram'],
            'whatsapp' => $profile['whatsapp'],
            'site' => $profile['site'],
            'avatar_media_id' => $avatarId !== null && $avatarId > 0 ? $avatarId : null,
            'admin_comment' => $profile['admin_comment'],
            'active' => $active,
        ]);

        $id = (int) $pdo->lastInsertId();

        // Уведомление на email (если он есть и настроена почта)
        $notified = notifyAccountCreated([
            'login' => $login,
            'email' => $email,
            'full_name' => $fullName,
        ], $password);

        respondOk(['id' => $id, 'notified' => $notified]);
    } catch (Throwable $e) {
        error_log('User create error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Обновление
// ---------------------------------------------------------------------
if ($action === 'update') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $target = $stmt->fetch();
    if (!$target) {
        respondError(404, 'Пользователь не найден');
    }
    $isSystem = (int) $target['is_system'] === 1;

    $fields = [];
    $params = ['id' => $id];

    // Логин (можно переименовать, в т.ч. системный)
    if (array_key_exists('login', $data)) {
        $login = trim((string) $data['login']);
        if ($login === '' || !preg_match('/^[a-zA-Z0-9_\.\-]{3,64}$/', $login)) {
            respondError(422, 'Некорректный логин (3-64 символа, буквы/цифры/_-.)');
        }
        if ($login !== $target['login']) {
            $stmt = $pdo->prepare('SELECT id FROM users WHERE login = ? AND id <> ?');
            $stmt->execute([$login, $id]);
            if ($stmt->fetch()) {
                respondError(409, 'Логин уже занят');
            }
        }
        $fields[] = 'login = :login';
        $params['login'] = $login;
    }

    // Email
    if (array_key_exists('email', $data)) {
        $email = trim((string) $data['email']);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondError(422, 'Некорректный email');
        }
        if ($email !== '' && $email !== $target['email']) {
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
            $stmt->execute([$email, $id]);
            if ($stmt->fetch()) {
                respondError(409, 'Email уже занят');
            }
        }
        $fields[] = 'email = :email';
        $params['email'] = $email !== '' ? $email : null;
    }

    // Роль (системным не меняем)
    if (array_key_exists('role', $data)) {
        $role = trim((string) $data['role']);
        if (!in_array($role, allowedRoles($pdo), true)) {
            respondError(422, 'Некорректная роль');
        }
        if ($isSystem && $role !== $target['role']) {
            respondError(422, 'Системной учётной записи нельзя сменить роль');
        }
        $fields[] = 'role = :role';
        $params['role'] = $role;
    }

    // Состояние (системные всегда активны)
    if (array_key_exists('active', $data)) {
        $active = (int) (bool) $data['active'];
        if ($isSystem && $active === 0) {
            respondError(422, 'Системную учётную запись нельзя заблокировать');
        }
        $fields[] = 'active = :active';
        $params['active'] = $active;
    }

    // Профиль
    foreach (PROFILE_FIELDS as $key => $limit) {
        if (array_key_exists($key, $data)) {
            $fields[] = $key . ' = :' . $key;
            $params[$key] = profileValue($data, $key, $limit);
        }
    }
    if (array_key_exists('birth_date', $data)) {
        $fields[] = 'birth_date = :birth_date';
        $params['birth_date'] = birthDateValue($data);
    }
    if (array_key_exists('avatar_media_id', $data)) {
        $avatarId = avatarValue($data);
        $fields[] = 'avatar_media_id = :avatar_media_id';
        $params['avatar_media_id'] = $avatarId !== null && $avatarId > 0 ? $avatarId : null;
    }

    // ФИО одной строкой
    if (
        array_key_exists('last_name', $data)
        || array_key_exists('first_name', $data)
        || array_key_exists('middle_name', $data)
    ) {
        $last = array_key_exists('last_name', $data) ? (string) ($params['last_name'] ?? '') : (string) $target['last_name'];
        $first = array_key_exists('first_name', $data) ? (string) ($params['first_name'] ?? '') : (string) $target['first_name'];
        $middle = array_key_exists('middle_name', $data) ? (string) ($params['middle_name'] ?? '') : (string) $target['middle_name'];
        $fields[] = 'full_name = :full_name';
        $params['full_name'] = composeFullName($last, $first, $middle, $target['full_name']);
    }

    // Пароль
    $password = array_key_exists('password', $data) ? (string) $data['password'] : null;
    $passwordChanged = false;
    if ($password !== null && $password !== '') {
        if (strlen($password) < 6) {
            respondError(422, 'Пароль должен быть не менее 6 символов');
        }
        $fields[] = 'password_hash = :pass';
        $params['pass'] = password_hash($password, PASSWORD_BCRYPT);
        $passwordChanged = true;
    }

    if (!$fields) {
        respondError(422, 'Нет данных для обновления');
    }

    // Защита себя: нельзя сменить свою роль и заблокироваться
    if ($id === (int) $user['id']) {
        $newRole = $params['role'] ?? null;
        if ($newRole !== null && $user['role'] === 'admin' && $newRole !== 'admin') {
            respondError(422, 'Нельзя сменить роль администратора у себя');
        }
        if (($params['active'] ?? 1) === 0) {
            respondError(422, 'Нельзя заблокировать себя');
        }
    }

    try {
        $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($params);

        // Уведомление о смене пароля
        $notified = false;
        if ($passwordChanged) {
            $notified = notifyPasswordChanged([
                'login' => $params['login'] ?? $target['login'],
                'email' => $params['email'] ?? $target['email'],
            ], $password);
        }

        respondOk(['id' => $id, 'notified' => $notified]);
    } catch (Throwable $e) {
        error_log('User update error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Удаление
// ---------------------------------------------------------------------
if ($action === 'delete') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    if ($id === (int) $user['id']) {
        respondError(422, 'Нельзя удалить самого себя');
    }
    try {
        $stmt = db()->prepare('SELECT is_system FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $target = $stmt->fetch();
        if (!$target) {
            respondError(404, 'Пользователь не найден');
        }
        if ((int) $target['is_system'] === 1) {
            respondError(422, 'Системную учётную запись нельзя удалить');
        }
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('User delete error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестное действие');
