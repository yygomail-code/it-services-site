<?php
/**
 * Общий bootstrap для API админки:
 *  - загрузка .env
 *  - JSON-ответы, CORS для локальной разработки
 *  - подключение к БД (PDO)
 *  - сессии, авторизация по ролям
 *  - CSRF-защита
 */

declare(strict_types=1);

// ---------------------------------------------------------------------
// .env
// ---------------------------------------------------------------------
function loadEnv(string $file): void
{
    if (!is_file($file)) {
        return;
    }
    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if ($key === '' || getenv($key) !== false) {
            continue;
        }
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
    }
}

loadEnv(__DIR__ . '/.env');

// ---------------------------------------------------------------------
// Конфигурация
// ---------------------------------------------------------------------
function cfg(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value !== false && $value !== '' ? $value : $default;
}

$APP_ENV = cfg('APP_ENV', 'dev');

// CORS для локальной разработки (Angular на :4200, API на :8090)
$allowedOrigin = cfg('CORS_ORIGIN', 'http://localhost:4200');
if (($APP_ENV === 'dev' || $APP_ENV === 'test') && isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
    if ($origin === $allowedOrigin || $origin === 'http://127.0.0.1:4200') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ---------------------------------------------------------------------
// БД
// ---------------------------------------------------------------------
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $host = cfg('DB_HOST', '127.0.0.1');
        $port = cfg('DB_PORT', '3306');
        $name = cfg('DB_NAME', 'it_services');
        $user = cfg('DB_USER', 'root');
        $pass = cfg('DB_PASS', '');
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name),
            $user,
            $pass,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 5,
            ]
        );
    }
    return $pdo;
}

// ---------------------------------------------------------------------
// Ответы
// ---------------------------------------------------------------------
function respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function respondOk(array $data = []): void
{
    respond(200, array_merge(['ok' => true], $data));
}

function respondError(int $code, string $message): void
{
    respond($code, ['ok' => false, 'error' => $message]);
}

// ---------------------------------------------------------------------
// Сессии и авторизация
// ---------------------------------------------------------------------
function startSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('itservices_sess');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'secure' => cfg('APP_ENV', 'dev') === 'prod',
        'samesite' => 'Lax',
    ]);
    session_start();
}

    function currentUser(): ?array
    {
        startSession();
        if (empty($_SESSION['user_id'])) {
            return null;
        }
        try {
            $stmt = db()->prepare(
                'SELECT u.id, u.login, u.email, u.role, u.full_name,
                        u.last_name, u.first_name, u.middle_name, u.birth_date, u.country, u.region, u.city,
                        u.address, u.phone, u.max_link, u.telegram, u.whatsapp, u.site, u.avatar_media_id,
                        m.url AS avatar_url
                 FROM users u
                 LEFT JOIN media m ON m.id = u.avatar_media_id
                 WHERE u.id = ? AND u.active = 1'
            );
            $stmt->execute([(int) $_SESSION['user_id']]);
            $user = $stmt->fetch();
            return $user ?: null;
        } catch (Throwable) {
            return null;
        }
    }

function requireAuth(): array
{
    $user = currentUser();
    if ($user === null) {
        respondError(401, 'Не авторизован');
    }
    return $user;
}

    function requireRole(array $roles): array
    {
        $user = requireAuth();
        if (!in_array($user['role'], $roles, true)) {
            respondError(403, 'Недостаточно прав');
        }
        // Письма не теряются: раз в 5 минут подчищаем очередь после ответа клиенту
        static $queueHookRegistered = false;
        if (!$queueHookRegistered) {
            $queueHookRegistered = true;
            require_once __DIR__ . '/email_queue.php';
            register_shutdown_function(static function (): void {
                emailQueueMaybeProcess();
            });
        }
        return $user;
    }

// ---------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------
function csrfToken(): string
{
    startSession();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function verifyCsrf(): void
{
    startSession();
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $session = $_SESSION['csrf'] ?? '';
    if ($header === '' || $session === '' || !hash_equals($session, $header)) {
        respondError(419, 'CSRF-токен недействителен');
    }
}

// ---------------------------------------------------------------------
// Входные данные
// ---------------------------------------------------------------------
function inputJson(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) {
        respondError(400, 'Некорректный JSON');
    }
    return $data;
}
