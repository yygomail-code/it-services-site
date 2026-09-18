<?php
/**
 * Отправка писем через SMTP-сервисы из раздела «Почта».
 * Поддерживает неявный SSL (465), STARTTLS (587) и соединение без шифрования (25).
 *
 * Использование:
 *   $result = mailerSend($service, 'user@example.ru', 'Тема', '<p>Текст</p>');
 *   if (!$result['ok']) { ... $result['error'] ... }
 */

declare(strict_types=1);

/** Пресеты популярных сервисов: параметры соединения и подсказка по паролю. */
function mailerPresets(): array
{
    return [
        'yandex' => [
            'label' => 'Яндекс.Почта',
            'host' => 'smtp.yandex.ru',
            'port' => 465,
            'encryption' => 'ssl',
            'hint' => 'Нужен пароль приложения: Яндекс ID → Безопасность → Пароли приложений → «Почта».',
        ],
        'mailru' => [
            'label' => 'Mail.ru',
            'host' => 'smtp.mail.ru',
            'port' => 465,
            'encryption' => 'ssl',
            'hint' => 'Нужен пароль для внешнего приложения: Почта Mail.ru → Настройки → Безопасность → Пароли для внешних приложений.',
        ],
        'google' => [
            'label' => 'Google (Gmail)',
            'host' => 'smtp.gmail.com',
            'port' => 465,
            'encryption' => 'ssl',
            'hint' => 'Нужен пароль приложения при включённой двухэтапной аутентификации: Аккаунт Google → Безопасность → Пароли приложений.',
        ],
        'custom' => [
            'label' => 'Другой SMTP-сервер',
            'host' => '',
            'port' => 465,
            'encryption' => 'ssl',
            'hint' => 'Параметры соединения уточните у почтового провайдера.',
        ],
    ];
}

/**
 * Активный почтовый сервис для назначения (например, registration — письма
 * о создании учётной записи, actions — о смене пароля). Если сервиса с таким
 * назначением нет — берётся любой активный. Если активных нет — null.
 */
function mailerFindService(string $purpose): ?array
{
    try {
        $stmt = db()->prepare('SELECT * FROM mail_services WHERE active = 1 AND purpose = ? ORDER BY id LIMIT 1');
        $stmt->execute([$purpose]);
        $service = $stmt->fetch();
        if ($service) {
            return $service;
        }
        $service = db()->query('SELECT * FROM mail_services WHERE active = 1 ORDER BY id LIMIT 1')->fetch();
        return $service ?: null;
    } catch (Throwable $e) {
        error_log('Mailer service lookup error: ' . $e->getMessage());
        return null;
    }
}

/**
 * Отправляет письмо через SMTP.
 * Возвращает ['ok' => bool, 'error' => string|null].
 */
function mailerSend(array $service, string $to, string $subject, string $html, string $text = ''): array
{
    $host = trim((string) ($service['host'] ?? ''));
    $port = (int) ($service['port'] ?? 465);
    $encryption = (string) ($service['encryption'] ?? 'ssl');
    $user = trim((string) ($service['username'] ?? ''));
    $pass = (string) ($service['password'] ?? '');
    $fromEmail = trim((string) ($service['from_email'] ?? '')) ?: $user;
    $fromName = trim((string) ($service['from_name'] ?? ''));

    if ($host === '' || $user === '' || $pass === '' || $fromEmail === '') {
        return ['ok' => false, 'error' => 'Заполнены не все параметры подключения'];
    }

    $transport = $encryption === 'ssl' ? 'ssl://' : 'tcp://';
    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client($transport . $host . ':' . $port, $errno, $errstr, 5);
    if (!$fp) {
        return ['ok' => false, 'error' => "Не удалось подключиться к {$host}:{$port} — {$errstr}"];
    }
    stream_set_timeout($fp, 5);

    try {
        if (!mailerExpect($fp, [220])) {
            throw new RuntimeException('Сервер не ответил приветствием');
        }
        $ehlo = gethostname() ?: 'localhost';
        mailerCmd($fp, "EHLO {$ehlo}", [250]);

        if ($encryption === 'tls') {
            mailerCmd($fp, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Не удалось включить TLS');
            }
            mailerCmd($fp, "EHLO {$ehlo}", [250]);
        }

        mailerCmd($fp, 'AUTH LOGIN', [334]);
        mailerCmd($fp, base64_encode($user), [334]);
        mailerCmd($fp, base64_encode($pass), [235]);

        mailerCmd($fp, "MAIL FROM:<{$fromEmail}>", [250]);
        mailerCmd($fp, "RCPT TO:<{$to}>", [250, 251]);
        mailerCmd($fp, 'DATA', [354]);

        $boundary = 'b' . bin2hex(random_bytes(12));
        $plain = $text !== ''
            ? $text
            : trim(html_entity_decode(strip_tags(preg_replace('/<br\s*\/?>/i', "\n", $html) ?? $html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        $headers = [
            'From: ' . mailerEncodeName($fromName) . "<{$fromEmail}>",
            "To: <{$to}>",
            'Subject: ' . mailerEncodeHeader($subject),
            'MIME-Version: 1.0',
            "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
            'Date: ' . date('r'),
        ];
        $body = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($plain))
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html))
            . "--{$boundary}--\r\n";

        // Точки в начале строк экранируются по правилам SMTP
        $data = preg_replace('/^\./m', '..', implode("\r\n", $headers) . "\r\n\r\n" . $body) ?? '';
        fwrite($fp, $data . "\r\n.\r\n");
        if (!mailerExpect($fp, [250])) {
            throw new RuntimeException('Сервер отклонил письмо');
        }
        @fwrite($fp, "QUIT\r\n");
        @fclose($fp);

        return ['ok' => true, 'error' => null];
    } catch (Throwable $e) {
        @fclose($fp);
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

/** Отправляет команду и проверяет код ответа. */
function mailerCmd($fp, string $command, array $codes): void
{
    fwrite($fp, $command . "\r\n");
    if (!mailerExpect($fp, $codes)) {
        throw new RuntimeException('Ошибка SMTP на команде ' . strtok($command, ' '));
    }
}

/** Читает многострочный ответ сервера и проверяет код. */
function mailerExpect($fp, array $codes): bool
{
    $response = '';
    while (($line = fgets($fp, 1024)) !== false) {
        $response .= $line;
        if (strlen($line) < 4 || $line[3] !== '-') {
            break;
        }
    }
    if ($response === '') {
        return false;
    }
    return in_array((int) substr($response, 0, 3), $codes, true);
}

/** Кодирует заголовок письма (UTF-8 → base64). */
function mailerEncodeHeader(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

/** Кодирует имя отправителя (пустое — не выводим). */
function mailerEncodeName(string $name): string
{
    return $name !== '' ? mailerEncodeHeader($name) . ' ' : '';
}
