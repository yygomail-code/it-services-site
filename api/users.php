<?php
/**
 * Управление пользователями админки (только admin):
 *  GET  /api/users.php              — список пользователей
 *  POST /api/users.php?action=create {login, email?, password, role, full_name?, active?}
 *  POST /api/users.php?action=update {id, email?, role?, full_name?, active?, password?}
 *  POST /api/users.php?action=delete {id} — нельзя удалить самого себя
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$user = requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

$allowedRoles = ['client', 'manager', 'admin'];

// ---------------------------------------------------------------------
// GET — список
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === '') {
    try {
        $stmt = db()->query(
            'SELECT id, login, email, role, full_name, active, created_at, last_login_at
             FROM users ORDER BY id'
        );
        $users = $stmt->fetchAll();
        respondOk(['users' => $users]);
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
    $fullName = trim((string) ($data['full_name'] ?? ''));
    $active = isset($data['active']) ? (int) (bool) $data['active'] : 1;

    if ($login === '' || !preg_match('/^[a-zA-Z0-9_\.\-]{3,64}$/', $login)) {
        respondError(422, 'Недопустимый логин (3–64 символа, буквы/цифры/_-.)');
    }
    if (strlen($password) < 6) {
        respondError(422, 'Пароль должен быть не короче 6 символов');
    }
    if (!in_array($role, $allowedRoles, true)) {
        respondError(422, 'Недопустимая роль');
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respondError(422, 'Некорректный email');
    }

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
            'INSERT INTO users (login, email, password_hash, role, full_name, active)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $login,
            $email !== '' ? $email : null,
            password_hash($password, PASSWORD_BCRYPT),
            $role,
            $fullName !== '' ? $fullName : null,
            $active,
        ]);
        respondOk(['id' => (int) $pdo->lastInsertId()]);
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

    $fields = [];
    $params = ['id' => $id];

    $email = isset($data['email']) ? trim((string) $data['email']) : null;
    if ($email !== null) {
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondError(422, 'Некорректный email');
        }
        $fields[] = 'email = :email';
        $params['email'] = $email !== '' ? $email : null;
    }

    $role = isset($data['role']) ? trim((string) $data['role']) : null;
    if ($role !== null) {
        if (!in_array($role, $allowedRoles, true)) {
            respondError(422, 'Недопустимая роль');
        }
        $fields[] = 'role = :role';
        $params['role'] = $role;
    }

    $fullName = array_key_exists('full_name', $data) ? trim((string) $data['full_name']) : null;
    if ($fullName !== null) {
        $fields[] = 'full_name = :full_name';
        $params['full_name'] = $fullName !== '' ? $fullName : null;
    }

    if (array_key_exists('active', $data)) {
        $fields[] = 'active = :active';
        $params['active'] = (int) (bool) $data['active'];
    }

    $password = array_key_exists('password', $data) ? (string) $data['password'] : null;
    if ($password !== null) {
        if ($password !== '' && strlen($password) < 6) {
            respondError(422, 'Пароль должен быть не короче 6 символов');
        }
        if ($password !== '') {
            $fields[] = 'password_hash = :pass';
            $params['pass'] = password_hash($password, PASSWORD_BCRYPT);
        }
    }

    if (!$fields) {
        respondError(422, 'Нет данных для обновления');
    }

    try {
        // Защита: нельзя понизить/деактивировать самого себя
        if ($id === (int) $user['id']) {
            if (($params['role'] ?? null) === 'client') {
                respondError(422, 'Нельзя снять роль администратора с самого себя');
            }
            if (($params['active'] ?? 1) === 0) {
                respondError(422, 'Нельзя деактивировать самого себя');
            }
        }
        db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($params);
        respondOk(['id' => $id]);
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
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('User delete error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестное действие');
