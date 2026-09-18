<?php
/**
 * Сервисы отправки почты (только admin):
 *  GET  /api/mail_services.php                — список сервисов, пресеты и назначения
 *  GET  /api/mail_services.php?action=queue   — очередь писем (последние 100) и счётчики
 *  GET  /api/mail_services.php?action=cron_link — ссылка запуска очереди по расписанию
 *  POST /api/mail_services.php?action=save    — создать/обновить сервис
 *  POST /api/mail_services.php?action=delete  — удалить сервис
 *  POST /api/mail_services.php?action=test    — отправить тестовое письмо (проверка настроек)
 *  POST /api/mail_services.php?action=queue_process — обработать очередь сейчас
 *  POST /api/mail_services.php?action=queue_retry   — повторить отправку письма {id}
 *  POST /api/mail_services.php?action=cron_link_generate — сгенерировать новую ссылку
 *  POST /api/mail_services.php?action=cron_link_delete   — отключить запуск по ссылке
 *
 * Пароль в API не отдаётся: вместо него признак has_password.
 * При сохранении пустой пароль означает «оставить прежний».
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/mailer.php';
require __DIR__ . '/email_queue.php';

$user = requireRole(['admin']);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

const MAIL_PURPOSES = [
    'leads' => 'Заявки с сайта',
    'registration' => 'Регистрация пользователей',
    'actions' => 'Действия пользователей',
    'purchases' => 'Покупки',
    'other' => 'Прочее',
];

/** Ответ по сервису: без пароля, с признаком его наличия. */
function mailServiceOut(array $row): array
{
    $hasPassword = trim((string) ($row['password'] ?? '')) !== '';
    unset($row['password']);
    $row['has_password'] = $hasPassword;
    $row['port'] = (int) $row['port'];
    $row['active'] = (int) $row['active'];
    $row['last_check_ok'] = $row['last_check_ok'] === null ? null : (int) $row['last_check_ok'];
    return $row;
}

// ---------------------------------------------------------------------
// GET — список
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === '') {
    try {
        $rows = db()->query('SELECT * FROM mail_services ORDER BY purpose, id')->fetchAll();
        respondOk([
            'services' => array_map('mailServiceOut', $rows),
            'presets' => mailerPresets(),
            'purposes' => MAIL_PURPOSES,
        ]);
    } catch (Throwable $e) {
        error_log('Mail services list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// GET — очередь писем
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === 'queue') {
    try {
        $rows = db()->query(
            'SELECT id, to_email, subject, purpose, status, attempts, max_attempts,
                    last_error, next_attempt_at, sent_at, created_at
             FROM email_queue ORDER BY id DESC LIMIT 100'
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['attempts'] = (int) $row['attempts'];
            $row['max_attempts'] = (int) $row['max_attempts'];
        }
        unset($row);
        $counts = db()->query('SELECT status, COUNT(*) c FROM email_queue GROUP BY status')
            ->fetchAll(PDO::FETCH_KEY_PAIR);
        respondOk(['queue' => $rows, 'counts' => $counts]);
    } catch (Throwable $e) {
        error_log('Email queue list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// GET — ссылка запуска очереди по расписанию
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === 'cron_link') {
    $key = emailQueueCronKey();
    respondOk([
        'has_key' => $key !== '',
        'link' => $key !== '' ? emailQueueCronLink($key) : null,
    ]);
}

if ($method !== 'POST') {
    respondError(405, 'Метод не поддерживается');
}

verifyCsrf();
$data = inputJson();

// ---------------------------------------------------------------------
// Очередь: обработать сейчас / повторить письмо
// ---------------------------------------------------------------------
if ($action === 'queue_process') {
    respondOk(emailQueueProcess(20));
}

if ($action === 'queue_retry') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    if (!emailQueueRetry($id)) {
        respondError(422, 'Письмо уже отправлено или не найдено');
    }
    respondOk(['sent' => emailQueueTrySendNow($id)]);
}

// ---------------------------------------------------------------------
// Ссылка запуска очереди: сгенерировать / отключить
// ---------------------------------------------------------------------
if ($action === 'cron_link_generate') {
    $key = emailQueueCronKeyGenerate();
    respondOk(['has_key' => true, 'link' => emailQueueCronLink($key)]);
}

if ($action === 'cron_link_delete') {
    emailQueueCronKeyClear();
    respondOk(['has_key' => false]);
}

// ---------------------------------------------------------------------
// Создание/обновление
// ---------------------------------------------------------------------
if ($action === 'save') {
    $id = (int) ($data['id'] ?? 0);
    $name = trim((string) ($data['name'] ?? ''));
    $provider = trim((string) ($data['provider'] ?? 'custom'));
    $host = trim((string) ($data['host'] ?? ''));
    $port = (int) ($data['port'] ?? 465);
    $encryption = trim((string) ($data['encryption'] ?? 'ssl'));
    $username = trim((string) ($data['username'] ?? ''));
    $password = (string) ($data['password'] ?? '');
    $fromEmail = trim((string) ($data['from_email'] ?? ''));
    $fromName = trim((string) ($data['from_name'] ?? ''));
    $purpose = trim((string) ($data['purpose'] ?? 'leads'));
    $active = !empty($data['active']) ? 1 : 0;

    if ($name === '') {
        respondError(422, 'Укажите название сервиса');
    }
    if ($host === '') {
        respondError(422, 'Укажите SMTP-сервер');
    }
    if ($port < 1 || $port > 65535) {
        respondError(422, 'Некорректный порт');
    }
    if (!in_array($encryption, ['ssl', 'tls', 'none'], true)) {
        respondError(422, 'Некорректный тип шифрования');
    }
    if ($username === '') {
        respondError(422, 'Укажите логин');
    }
    if ($fromEmail === '' || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        respondError(422, 'Укажите корректный адрес отправителя');
    }
    if (!array_key_exists($purpose, MAIL_PURPOSES)) {
        respondError(422, 'Некорректное назначение');
    }
    if (!array_key_exists($provider, mailerPresets())) {
        $provider = 'custom';
    }

    try {
        $pdo = db();
        if ($id > 0) {
            $exists = $pdo->prepare('SELECT id FROM mail_services WHERE id = ?');
            $exists->execute([$id]);
            if (!$exists->fetch()) {
                respondError(404, 'Сервис не найден');
            }
            if ($password !== '') {
                $pdo->prepare(
                    'UPDATE mail_services
                     SET name=?, provider=?, host=?, port=?, encryption=?, username=?, password=?,
                         from_email=?, from_name=?, purpose=?, active=?
                     WHERE id=?'
                )->execute([$name, $provider, $host, $port, $encryption, $username, $password, $fromEmail, $fromName, $purpose, $active, $id]);
            } else {
                $pdo->prepare(
                    'UPDATE mail_services
                     SET name=?, provider=?, host=?, port=?, encryption=?, username=?,
                         from_email=?, from_name=?, purpose=?, active=?
                     WHERE id=?'
                )->execute([$name, $provider, $host, $port, $encryption, $username, $fromEmail, $fromName, $purpose, $active, $id]);
            }
            respondOk(['id' => $id]);
        }

        $pdo->prepare(
            'INSERT INTO mail_services
                (name, provider, host, port, encryption, username, password, from_email, from_name, purpose, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$name, $provider, $host, $port, $encryption, $username, $password, $fromEmail, $fromName, $purpose, $active]);
        respondOk(['id' => (int) $pdo->lastInsertId()]);
    } catch (Throwable $e) {
        error_log('Mail service save error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Удаление
// ---------------------------------------------------------------------
if ($action === 'delete') {
    $id = (int) ($data['id'] ?? 0);
    try {
        db()->prepare('DELETE FROM mail_services WHERE id = ?')->execute([$id]);
        respondOk(['deleted' => true]);
    } catch (Throwable $e) {
        error_log('Mail service delete error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Проверка: тестовое письмо
// ---------------------------------------------------------------------
if ($action === 'test') {
    $id = (int) ($data['id'] ?? 0);
    $to = trim((string) ($data['to'] ?? ''));
    try {
        $stmt = db()->prepare('SELECT * FROM mail_services WHERE id = ?');
        $stmt->execute([$id]);
        $service = $stmt->fetch();
        if (!$service) {
            respondError(404, 'Сервис не найден');
        }
        if ($to === '') {
            $to = (string) $service['from_email'];
        }
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            respondError(422, 'Укажите корректный адрес получателя');
        }

        $result = mailerSend(
            $service,
            $to,
            'Проверка настроек почты',
            '<p>Это тестовое письмо из админки сайта.</p><p>Если вы его получили — сервис «'
                . htmlspecialchars((string) $service['name'], ENT_QUOTES, 'UTF-8')
                . '» настроен верно.</p>'
        );

        db()->prepare('UPDATE mail_services SET last_check_at = NOW(), last_check_ok = ?, last_check_error = ? WHERE id = ?')
            ->execute([
                $result['ok'] ? 1 : 0,
                $result['ok'] ? null : mb_substr((string) $result['error'], 0, 500),
                $id,
            ]);

        if (!$result['ok']) {
            respondError(422, 'Не удалось отправить письмо: ' . $result['error']);
        }
        respondOk(['sent_to' => $to]);
    } catch (Throwable $e) {
        error_log('Mail service test error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестный запрос');
