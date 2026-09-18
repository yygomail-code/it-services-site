<?php
/**
 * Шлюз лидов (MySQL + очередь писем).
 *
 * Заявка сохраняется в MySQL, письмо ставится в очередь (email_queue):
 * при сбое SMTP оно не теряется, попытки повторяются, видно в админке
 * («Почта» → «Очередь писем»). SMTP-сервисы настраиваются в админке.
 *
 * Файл НЕ должен быть доступен на чтение извне — только приём POST.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

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
$config = [
    'db_host' => getenv('DB_HOST') ?: '127.0.0.1',
    'db_port' => getenv('DB_PORT') ?: '3306',
    'db_name' => getenv('DB_NAME') ?: 'it_services',
    'db_user' => getenv('DB_USER') ?: 'root',
    'db_pass' => getenv('DB_PASS') ?: '',
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
$telegram = trim((string) ($data['telegram'] ?? ''));
$service = trim((string) ($data['service'] ?? ''));
$message = trim((string) ($data['message'] ?? ''));
$utmSource = trim((string) ($data['utm_source'] ?? ''));
$utmMedium = trim((string) ($data['utm_medium'] ?? ''));
$utmCampaign = trim((string) ($data['utm_campaign'] ?? ''));
$page = trim((string) ($data['page'] ?? ''));

// Пустые строки для опциональных/ENUM-полей → NULL (иначе MySQL ругается на ENUM)
$nullIfEmpty = static fn (string $v): ?string => $v === '' ? null : $v;
$partnerRole = $nullIfEmpty($partnerRole);
$dealType = $nullIfEmpty($dealType);
$telegram = $nullIfEmpty($telegram);
$service = $nullIfEmpty($service);
$message = $nullIfEmpty($message);
$utmSource = $nullIfEmpty($utmSource);
$utmMedium = $nullIfEmpty($utmMedium);
$utmCampaign = $nullIfEmpty($utmCampaign);
$page = $nullIfEmpty($page);

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
            (lead_id, lead_type, partner_role, deal_type, name, phone, telegram, service, message,
             utm_source, utm_medium, utm_campaign, page, status, created_at)
         VALUES
            (:lead_id, :lead_type, :partner_role, :deal_type, :name, :phone, :telegram, :service, :message,
             :utm_source, :utm_medium, :utm_campaign, :page, :status, NOW())'
    );
    $stmt->execute([
        'lead_id' => $leadId,
        'lead_type' => $leadType,
        'partner_role' => $partnerRole,
        'deal_type' => $dealType,
        'name' => $name,
        'phone' => $phone,
        'telegram' => $telegram,
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
// Письмо: ставим в очередь — при сбое SMTP письмо не теряется,
// попытки повторяются (обработка — при заходах в админку и из cron)
// ---------------------------------------------------------------------
if ($dbOk) {
    $mailTo = getenv('MAIL_TO') ?: 'hello@example.ru';
    $mailSubject = $leadType === 'partner'
        ? 'Новый лид: ПАРТНЁР — ' . $name
        : 'Новый лид: ' . $name;
    $mailText = leadMailText($leadType, [
        'lead_id' => $leadId,
        'name' => $name,
        'phone' => $phone,
        'telegram' => $telegram,
        'service' => $service,
        'message' => $message,
        'partner_role' => $partnerRole,
        'deal_type' => $dealType,
        'utm_source' => $utmSource,
        'utm_medium' => $utmMedium,
        'utm_campaign' => $utmCampaign,
        'page' => $page,
    ]);
    $mailHtml = '<pre style="font:13px/1.5 monospace; white-space:pre-wrap">'
        . htmlspecialchars($mailText, ENT_QUOTES, 'UTF-8') . '</pre>';
    require_once __DIR__ . '/email_queue.php';
    $queueId = emailQueueAdd($mailTo, $mailSubject, $mailHtml, $mailText, 'leads');
    emailQueueTrySendNow($queueId);
}

// ---------------------------------------------------------------------
// Ответ: заявка сохранена — успех; письмо уйдёт (при сбое — с повторами)
// ---------------------------------------------------------------------
if ($dbOk) {
    echo json_encode(['ok' => true, 'lead_id' => $leadId]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to save lead']);
}

/** Текст письма о новом лиде. */
function leadMailText(string $leadType, array $d): string
{
    $lines = [];
    $lines[] = 'Новая заявка с сайта';
    $lines[] = '-------------------';
    $lines[] = 'Тип: ' . ($leadType === 'partner' ? 'Партнёр' : 'Клиент');
    $lines[] = 'Имя: ' . $d['name'];
    $lines[] = 'Телефон: ' . $d['phone'];
    if (!empty($d['service'])) {
        $lines[] = 'Услуга: ' . $d['service'];
    }
    if (!empty($d['telegram'])) {
        $lines[] = 'Telegram: ' . $d['telegram'];
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
    return implode("\n", $lines);
}
