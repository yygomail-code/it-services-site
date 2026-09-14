<?php
/**
 * Шлюз лидов (почта + MySQL).
 *
 * Режимы:
 *  - APP_ENV=dev  — пишет в MySQL, письмо НЕ отправляет
 *  - APP_ENV=prod — полный цикл: письмо (Яндекс SMTP) + запись в MySQL
 *
 * Секреты берутся из переменных окружения (.env или реального окружения).
 * Файл НЕ должен быть доступен на чтение извне — только приём POST.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ---------------------------------------------------------------------
// Только POST
// ---------------------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

// ---------------------------------------------------------------------
// Конфигурация из окружения
// ---------------------------------------------------------------------
$env = getenv('APP_ENV') ?: 'dev';
$config = [
    'env' => $env,
    'db_host' => getenv('DB_HOST') ?: '127.0.0.1',
    'db_port' => getenv('DB_PORT') ?: '3306',
    'db_name' => getenv('DB_NAME') ?: 'it_services',
    'db_user' => getenv('DB_USER') ?: 'root',
    'db_pass' => getenv('DB_PASS') ?: '',
    'smtp_host' => getenv('SMTP_HOST') ?: 'smtp.yandex.ru',
    'smtp_port' => (int) (getenv('SMTP_PORT') ?: '465'),
    'smtp_user' => getenv('SMTP_USER') ?: '',
    'smtp_pass' => getenv('SMTP_PASS') ?: '',
    'mail_to' => getenv('MAIL_TO') ?: 'hello@example.ru',
];

// ---------------------------------------------------------------------
// Входные данные
// ---------------------------------------------------------------------
$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

// Валидация обязательных полей
$name = trim((string) ($data['name'] ?? ''));
$phone = trim((string) ($data['phone'] ?? ''));

if ($name === '' || $phone === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Name and phone are required']);
    exit;
}

// Простая проверка телефона
if (!preg_match('/^[+0-9()\-\s]{6,20}$/', $phone)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Invalid phone']);
    exit;
}

// Honeypot (антиспам): скрытое поле, боты его заполняют
if (isset($data['website']) && $data['website'] !== '') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

$leadType = ($data['lead_type'] ?? 'client') === 'partner' ? 'partner' : 'client';
$partnerRole = $leadType === 'partner' ? trim((string) ($data['partner_role'] ?? '')) : '';
$dealType = $leadType === 'partner' ? trim((string) ($data['deal_type'] ?? '')) : '';
$service = trim((string) ($data['service'] ?? ''));
$message = trim((string) ($data['message'] ?? ''));
$utmSource = trim((string) ($data['utm_source'] ?? ''));
$utmMedium = trim((string) ($data['utm_medium'] ?? ''));
$utmCampaign = trim((string) ($data['utm_campaign'] ?? ''));
$page = trim((string) ($data['page'] ?? ''));

// Уникальный ID лида
$leadId = date('YmdHis') . '-' . bin2hex(random_bytes(4));

// ---------------------------------------------------------------------
// Запись в MySQL
// ---------------------------------------------------------------------
$dbOk = false;
try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']),
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]
    );

    $stmt = $pdo->prepare(
        'INSERT INTO leads
            (lead_id, lead_type, partner_role, deal_type, name, phone, service, message,
             utm_source, utm_medium, utm_campaign, page, status, created_at)
         VALUES
            (:lead_id, :lead_type, :partner_role, :deal_type, :name, :phone, :service, :message,
             :utm_source, :utm_medium, :utm_campaign, :page, :status, NOW())'
    );
    $stmt->execute([
        'lead_id' => $leadId,
        'lead_type' => $leadType,
        'partner_role' => $partnerRole,
        'deal_type' => $dealType,
        'name' => $name,
        'phone' => $phone,
        'service' => $service,
        'message' => $message,
        'utm_source' => $utmSource,
        'utm_medium' => $utmMedium,
        'utm_campaign' => $utmCampaign,
        'page' => $page,
        'status' => 'new',
    ]);
    $dbOk = true;
} catch (Throwable $e) {
    // Логируем, но не падаем — письмо важнее, чем БД
    error_log('Lead DB error: ' . $e->getMessage());
}

// ---------------------------------------------------------------------
// Письмо (только в prod)
// ---------------------------------------------------------------------
$mailOk = true;
if ($env === 'prod') {
    $mailOk = sendMail($config, $leadType, [
        'lead_id' => $leadId,
        'name' => $name,
        'phone' => $phone,
        'service' => $service,
        'message' => $message,
        'partner_role' => $partnerRole,
        'deal_type' => $dealType,
        'utm_source' => $utmSource,
        'utm_medium' => $utmMedium,
        'utm_campaign' => $utmCampaign,
        'page' => $page,
    ]);
}

// ---------------------------------------------------------------------
// Ответ
// ---------------------------------------------------------------------
if ($dbOk && ($env !== 'prod' || $mailOk)) {
    echo json_encode(['ok' => true, 'lead_id' => $leadId]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to save lead']);
}

/**
 * Отправка письма через SMTP (без внешних библиотек, сокет + STARTTLS/SSL).
 */
function sendMail(array $cfg, string $leadType, array $d): bool
{
    $subject = $leadType === 'partner'
        ? 'Новый лид: ПАРТНЁР — ' . ($d['name'] ?? '')
        : 'Новый лид: ' . ($d['name'] ?? '');

    $lines = [];
    $lines[] = 'Новая заявка с сайта';
    $lines[] = '-------------------';
    $lines[] = 'Тип: ' . ($leadType === 'partner' ? 'Партнёр' : 'Клиент');
    $lines[] = 'Имя: ' . $d['name'];
    $lines[] = 'Телефон: ' . $d['phone'];
    if (!empty($d['service'])) {
        $lines[] = 'Услуга: ' . $d['service'];
    }
    if (!empty($d['partner_role'])) {
        $lines[] = 'Роль партнёра: ' . $d['partner_role'];
    }
    if (!empty($d['deal_type'])) {
        $lines[] = 'Формат: ' . $d['deal_type'];
    }
    if (!empty($d['message'])) {
        $lines[] = 'Сообщение: ' . $d['message'];
    }
    if (!empty($d['utm_source']) || !empty($d['utm_medium']) || !empty($d['utm_campaign'])) {
        $lines[] = 'Источник: ' . implode(' / ', array_filter([
            $d['utm_source'],
            $d['utm_medium'],
            $d['utm_campaign'],
        ]));
    }
    $lines[] = 'Страница: ' . ($d['page'] ?: '-');
    $lines[] = 'Lead ID: ' . $d['lead_id'];
    $body = implode("\n", $lines);

    $mail = "From: {$cfg['smtp_user']}\r\n"
        . "To: {$cfg['mail_to']}\r\n"
        . 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . "\r\n"
        . base64_encode($body);

    $errno = 0;
    $errstr = '';
    $host = $cfg['smtp_host'];
    $port = $cfg['smtp_port'];

    // SSL-сокет (465)
    $fp = @stream_socket_client(
        "ssl://{$host}:{$port}",
        $errno,
        $errstr,
        15,
        STREAM_CLIENT_CONNECT,
        stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]])
    );

    if (!$fp) {
        error_log("Lead SMTP connect failed: {$errno} {$errstr}");
        return false;
    }

    $read = function () use ($fp): string {
        $resp = '';
        while ($line = fgets($fp, 515)) {
            $resp .= $line;
            // Код из 3 цифр + пробел = финальная строка ответа
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return trim($resp);
    };

    $ok = function (string $resp): bool {
        return isset($resp[0]) && $resp[0] === '2' || isset($resp[0]) && $resp[0] === '3';
    };

    $resp = $read(); // 220
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, "EHLO lead.local\r\n");
    $resp = $read();
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, "AUTH LOGIN\r\n");
    $resp = $read();
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, base64_encode($cfg['smtp_user']) . "\r\n");
    $resp = $read();
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, base64_encode($cfg['smtp_pass']) . "\r\n");
    $resp = $read();
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, "MAIL FROM:<{$cfg['smtp_user']}>\r\n");
    $resp = $read();
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, "RCPT TO:<{$cfg['mail_to']}>\r\n");
    $resp = $read();
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, "DATA\r\n");
    $resp = $read();
    if (!$ok($resp)) {
        fclose($fp);
        return false;
    }

    fwrite($fp, $mail . "\r\n.\r\n");
    $resp = $read();

    fwrite($fp, "QUIT\r\n");
    fclose($fp);

    return $ok($resp);
}
