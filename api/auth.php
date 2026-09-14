<?php
/**
 * Авторизация админки:
 *  POST /api/auth.php?action=login   {login, password, csrf}
 *  POST /api/auth.php?action=logout  {csrf}
 *  GET  /api/auth.php?action=me      — текущий пользователь + csrf
 *  GET  /api/auth.php?action=csrf    — только CSRF-токен
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'csrf':
        startSession();
        respondOk(['csrf' => csrfToken()]);
        break;

    case 'me':
        startSession();
        $user = currentUser();
        respondOk([
            'user' => $user,
            'csrf' => csrfToken(),
        ]);
        break;

    case 'login':
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            respondError(405, 'Метод не поддерживается');
        }
        verifyCsrf();
        $data = inputJson();
        $login = trim((string) ($data['login'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        if ($login === '' || $password === '') {
            respondError(422, 'Укажите логин и пароль');
        }

        try {
            $stmt = db()->prepare('SELECT * FROM users WHERE login = ? AND active = 1');
            $stmt->execute([$login]);
            $user = $stmt->fetch();
        } catch (Throwable $e) {
            error_log('Auth DB error: ' . $e->getMessage());
            respondError(500, 'Ошибка сервера');
        }

        if (!$user || !password_verify($password, $user['password_hash'])) {
            // Небольшая задержка против перебора
            usleep(300000);
            respondError(401, 'Неверный логин или пароль');
        }

        if ($user['role'] === 'client') {
            respondError(403, 'Учётная запись клиента не имеет доступа к админке');
        }

        startSession();
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        csrfToken();

        try {
            db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')
                ->execute([(int) $user['id']]);
        } catch (Throwable) {
        }

        respondOk([
            'user' => [
                'id' => (int) $user['id'],
                'login' => $user['login'],
                'email' => $user['email'],
                'role' => $user['role'],
                'full_name' => $user['full_name'],
            ],
            'csrf' => $_SESSION['csrf'],
        ]);
        break;

    case 'logout':
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            respondError(405, 'Метод не поддерживается');
        }
        verifyCsrf();
        startSession();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        respondOk();
        break;

    default:
        respondError(404, 'Неизвестное действие');
}
