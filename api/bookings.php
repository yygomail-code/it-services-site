<?php
/**
 * Модуль «Запись»: брони на услуги по дате и времени.
 *
 * Публичные:
 *  GET  /api/bookings.php?action=slots&service_id=N&date=YYYY-MM-DD  - свободные слоты дня
 *  POST /api/bookings.php?action=create   - создать запись {service_id, date, time, name, phone, email, telegram, comment, utm_*, page}
 *  GET  /api/bookings.php?action=item&booking_id=BK-XXXXXX&token=…  - запись для страницы отмены
 *  POST /api/bookings.php?action=cancel   - отмена клиентом {booking_id, token, reason}
 *
 * Админка (admin/manager):
 *  GET  /api/bookings.php?action=list     - список (status, q, date_from, date_to, service_id, page, per_page)
 *  GET  /api/bookings.php?action=admin_item&id=N
 *  POST /api/bookings.php?action=status   - подтвердить/отменить/выполнить {id, status, reason}
 *  POST /api/bookings.php?action=payment  - оплата {id, payment_status, payment_method, payment_amount}
 *  POST /api/bookings.php?action=reschedule - перенести {id, date, time}
 *  GET  /api/bookings.php?action=schedule - расписание модуля
 *  POST /api/bookings.php?action=schedule_save - сохранить расписание {days, from, to, step, horizon_days, min_hours_ahead}
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/email_queue.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

const BOOKING_STATUSES = ['new', 'confirmed', 'done', 'canceled', 'no_show'];
const BOOKING_ACTIVE_STATUSES = ['new', 'confirmed', 'done'];
const BOOKING_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];
const BOOKING_PAYMENT_METHODS = ['cash', 'card', 'transfer', 'sbp'];
const BOOKING_STATUS_LABELS = [
    'new' => 'Ждёт подтверждения',
    'confirmed' => 'Подтверждена',
    'done' => 'Выполнена',
    'canceled' => 'Отменена',
    'no_show' => 'Не пришёл',
];
const BOOKING_PAYMENT_LABELS = [
    'unpaid' => 'Не оплачена',
    'paid' => 'Оплачена',
    'refunded' => 'Возврат',
];

// ---------------------------------------------------------------------
// Настройки модуля
// ---------------------------------------------------------------------

/** Настройка модуля из app_settings. */
function bookingSetting(string $key, string $default = ''): string
{
    try {
        $stmt = db()->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();
        return $value === false || $value === null ? $default : (string) $value;
    } catch (Throwable $e) {
        error_log('Booking setting error: ' . $e->getMessage());
        return $default;
    }
}

/** Расписание и лимиты модуля: дни недели, часы, шаг, горизонт, минимум до записи. */
function bookingSchedule(): array
{
    $defaults = [
        'days' => [1, 2, 3, 4, 5],
        'from' => '10:00',
        'to' => '18:00',
        'step' => 30,
        'horizon_days' => 30,
        'min_hours_ahead' => 2,
    ];
    $raw = bookingSetting('booking.schedule', '');
    $decoded = $raw !== '' ? json_decode($raw, true) : null;
    if (is_array($decoded)) {
        $defaults['days'] = array_values(array_filter(array_map('intval', (array) ($decoded['days'] ?? [])), fn ($d) => $d >= 1 && $d <= 7));
        $defaults['from'] = (string) ($decoded['from'] ?? $defaults['from']);
        $defaults['to'] = (string) ($decoded['to'] ?? $defaults['to']);
        $defaults['step'] = (int) ($decoded['step'] ?? $defaults['step']);
    }
    $defaults['horizon_days'] = max(1, (int) bookingSetting('booking.horizon_days', '30'));
    $defaults['min_hours_ahead'] = max(0, (int) bookingSetting('booking.min_hours_ahead', '2'));
    return $defaults;
}

/** «Сейчас» по часам БД — все даты и время в записях хранятся в локальном времени сервера. */
function bookingNow(): DateTimeImmutable
{
    $now = (string) db()->query('SELECT NOW()')->fetchColumn();
    return new DateTimeImmutable($now);
}

// ---------------------------------------------------------------------
// Слоты
// ---------------------------------------------------------------------

/** Занятые интервалы дня: запись + её буферы (учитываются все активные записи, мастер один). */
function bookingBusyIntervals(string $date, ?int $excludeId = null): array
{
    $start = $date . ' 00:00:00';
    $end = (new DateTimeImmutable($date . ' 00:00:00'))->modify('+1 day')->format('Y-m-d H:i:s');
    $sql = 'SELECT id, slot_at, slot_end, buffer_before_min, buffer_after_min
            FROM bookings
            WHERE status IN ("' . implode('","', BOOKING_ACTIVE_STATUSES) . '")
              AND slot_at < ? AND slot_end > ?';
    $params = [$end, $start];
    if ($excludeId !== null) {
        $sql .= ' AND id <> ?';
        $params[] = $excludeId;
    }
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $intervals = [];
    foreach ($stmt->fetchAll() as $row) {
        $busyStart = (new DateTimeImmutable((string) $row['slot_at']))->modify('-' . (int) $row['buffer_before_min'] . ' minutes');
        $busyEnd = (new DateTimeImmutable((string) $row['slot_end']))->modify('+' . (int) $row['buffer_after_min'] . ' minutes');
        $intervals[] = [$busyStart, $busyEnd];
    }
    return $intervals;
}

/** Пересекаются ли интервалы [aStart, aEnd) и [bStart, bEnd). */
function bookingOverlaps(DateTimeImmutable $aStart, DateTimeImmutable $aEnd, DateTimeImmutable $bStart, DateTimeImmutable $bEnd): bool
{
    return $aStart < $bEnd && $bStart < $aEnd;
}

/**
 * Слоты услуги на дату: все варианты с признаком доступности.
 * Возвращает ['ok' => bool, 'error' => string, 'slots' => [['time' => 'HH:MM', 'available' => bool]]].
 */
function bookingSlotsFor(int $serviceId, string $date): array
{
    $schedule = bookingSchedule();
    $now = bookingNow();

    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$day || $day->format('Y-m-d') !== $date) {
        return ['ok' => false, 'error' => 'Некорректная дата', 'slots' => []];
    }
    $today = new DateTimeImmutable($now->format('Y-m-d'));
    if ($day < $today) {
        return ['ok' => false, 'error' => 'Дата уже прошла', 'slots' => []];
    }
    $horizon = $today->modify('+' . $schedule['horizon_days'] . ' days');
    if ($day > $horizon) {
        return ['ok' => false, 'error' => 'Дата слишком далеко', 'slots' => []];
    }
    if (!in_array((int) $day->format('N'), $schedule['days'], true)) {
        return ['ok' => true, 'error' => '', 'slots' => [], 'day_off' => true];
    }

    $stmt = db()->prepare('SELECT * FROM services WHERE id = ? AND active = 1 AND booking_enabled = 1');
    $stmt->execute([$serviceId]);
    $service = $stmt->fetch();
    if (!$service) {
        return ['ok' => false, 'error' => 'Услуга недоступна для записи', 'slots' => []];
    }

    $duration = max(5, (int) $service['duration_min']);
    $step = max(5, (int) $schedule['step']);
    $from = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $date . ' ' . $schedule['from']);
    $to = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $date . ' ' . $schedule['to']);
    if (!$from || !$to || $to <= $from) {
        return ['ok' => false, 'error' => 'Некорректное расписание', 'slots' => []];
    }

    $busy = bookingBusyIntervals($date);
    $earliest = $now->modify('+' . $schedule['min_hours_ahead'] . ' hours');

    $slots = [];
    for ($start = $from; $start->modify('+' . $duration . ' minutes') <= $to; $start = $start->modify('+' . $step . ' minutes')) {
        $end = $start->modify('+' . $duration . ' minutes');
        $available = $start >= $earliest;
        if ($available) {
            $busyStart = $start->modify('-' . (int) $service['buffer_before_min'] . ' minutes');
            $busyEnd = $end->modify('+' . (int) $service['buffer_after_min'] . ' minutes');
            foreach ($busy as [$bStart, $bEnd]) {
                if (bookingOverlaps($busyStart, $busyEnd, $bStart, $bEnd)) {
                    $available = false;
                    break;
                }
            }
        }
        $slots[] = ['time' => $start->format('H:i'), 'available' => $available];
    }

    return ['ok' => true, 'error' => '', 'slots' => $slots, 'service' => $service];
}

// ---------------------------------------------------------------------
// Вспомогательное
// ---------------------------------------------------------------------

/** Публичный номер брони: BK-XXXXXX (без похожих символов). */
function bookingIdGenerate(): string
{
    $alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        $candidate = 'BK-' . $code;
        $stmt = db()->prepare('SELECT COUNT(*) FROM bookings WHERE booking_id = ?');
        $stmt->execute([$candidate]);
        if ((int) $stmt->fetchColumn() === 0) {
            return $candidate;
        }
    }
    throw new RuntimeException('Не удалось создать номер брони');
}

function bookingToken(): string
{
    return bin2hex(random_bytes(16));
}

/** Телефон: цифры, пробелы, +, скобки, дефисы; 5–20 цифр. */
function bookingPhoneValid(string $phone): bool
{
    if (!preg_match('/^[+()\d\s-]{5,25}$/', $phone)) {
        return false;
    }
    $digits = preg_replace('/\D/', '', $phone);
    return strlen((string) $digits) >= 5 && strlen((string) $digits) <= 15;
}

/** Запись для API. */
function bookingOut(array $row, bool $full = false): array
{
    $out = [
        'id' => (int) $row['id'],
        'booking_id' => $row['booking_id'],
        'service_id' => (int) $row['service_id'],
        'service_title' => $row['service_title'],
        'slot_at' => $row['slot_at'],
        'slot_end' => $row['slot_end'],
        'status' => $row['status'],
        'status_label' => BOOKING_STATUS_LABELS[$row['status']] ?? $row['status'],
        'payment_status' => $row['payment_status'],
        'payment_status_label' => BOOKING_PAYMENT_LABELS[$row['payment_status']] ?? $row['payment_status'],
        'created_at' => $row['created_at'],
    ];
    if ($full) {
        $out += [
            'name' => $row['name'],
            'phone' => $row['phone'],
            'email' => $row['email'],
            'telegram' => $row['telegram'],
            'comment' => $row['comment'],
            'user_id' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'cancel_reason' => $row['cancel_reason'],
            'canceled_by' => $row['canceled_by'],
            'canceled_at' => $row['canceled_at'],
            'payment_method' => $row['payment_method'],
            'payment_amount' => $row['payment_amount'] !== null ? (float) $row['payment_amount'] : null,
            'paid_at' => $row['paid_at'],
            'utm_source' => $row['utm_source'],
            'utm_medium' => $row['utm_medium'],
            'utm_campaign' => $row['utm_campaign'],
            'page' => $row['page'],
            'updated_at' => $row['updated_at'],
        ];
    }
    return $out;
}

/** Ссылка на сайт для писем (SITE_URL из .env, иначе Origin/Referer/Host). */
function bookingSiteUrl(): string
{
    $configured = trim(cfg('SITE_URL', ''));
    if ($configured !== '') {
        return rtrim($configured, '/');
    }
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && preg_match('#^https?://#', $origin)) {
        return rtrim($origin, '/');
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    return $scheme . '://' . $host;
}

/** Человекочитаемые дата и время записи. */
function bookingWhen(array $row): string
{
    $at = new DateTimeImmutable((string) $row['slot_at']);
    $months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return $at->format('j') . ' ' . $months[(int) $at->format('n') - 1] . ' ' . $at->format('Y') . ', ' . $at->format('H:i');
}

/** Письмо о новой записи администратору. */
function bookingAdminMail(array $row): array
{
    $when = bookingWhen($row);
    $subject = 'Новая запись ' . $row['booking_id'] . ' — ' . $when;
    $rows = [
        'Номер' => $row['booking_id'],
        'Услуга' => $row['service_title'],
        'Когда' => $when,
        'Имя' => $row['name'],
        'Телефон' => $row['phone'],
        'Email' => $row['email'] ?? '',
        'Telegram' => $row['telegram'] ?? '',
        'Комментарий' => $row['comment'] ?? '',
        'Оплата' => BOOKING_PAYMENT_LABELS[$row['payment_status']] ?? $row['payment_status'],
    ];
    $html = '<h2>Новая запись на услугу</h2><table cellpadding="6" style="border-collapse:collapse">';
    $text = "Новая запись на услугу\n";
    foreach ($rows as $label => $value) {
        if (trim((string) $value) === '') {
            continue;
        }
        $safe = htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
        $html .= '<tr><td style="color:#666">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</td><td><strong>' . $safe . '</strong></td></tr>';
        $text .= $label . ': ' . $value . "\n";
    }
    $html .= '</table>';
    return [$subject, $html, $text];
}

/** Письмо клиенту: подтверждение и ссылка на отмену. */
function bookingClientMail(array $row, string $cancelUrl): array
{
    $when = bookingWhen($row);
    $subject = 'Запись ' . $row['booking_id'] . ' на ' . $when;
    $text = "Вы записались на услугу «{$row['service_title']}».\nКогда: {$when}\nНомер записи: {$row['booking_id']}\n";
    $text .= "Перенести или отменить запись: {$cancelUrl}\n";
    $html = '<h2>Запись подтверждена</h2>'
        . '<p>Услуга: <strong>' . htmlspecialchars((string) $row['service_title'], ENT_QUOTES, 'UTF-8') . '</strong><br>'
        . 'Когда: <strong>' . htmlspecialchars($when, ENT_QUOTES, 'UTF-8') . '</strong><br>'
        . 'Номер записи: <strong>' . htmlspecialchars((string) $row['booking_id'], ENT_QUOTES, 'UTF-8') . '</strong></p>'
        . '<p>Если планы изменятся, отмените запись по ссылке: '
        . '<a href="' . htmlspecialchars($cancelUrl, ENT_QUOTES, 'UTF-8') . '">отменить запись</a>.</p>';
    return [$subject, $html, $text];
}

/** Уведомление администратору о письме (письмо ставится в очередь). */
function bookingNotifyAdmin(array $row): void
{
    $mailTo = getenv('MAIL_TO') ?: 'hello@example.ru';
    [$subject, $html, $text] = bookingAdminMail($row);
    emailQueueAdd($mailTo, $subject, $html, $text, 'leads');
}

/** Письмо клиенту (если указан email). */
function bookingNotifyClient(array $row): void
{
    $email = trim((string) ($row['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return;
    }
    $cancelUrl = bookingSiteUrl() . '/booking/' . rawurlencode((string) $row['booking_id']) . '?token=' . rawurlencode((string) $row['confirm_token']);
    [$subject, $html, $text] = bookingClientMail($row, $cancelUrl);
    emailQueueAdd($email, $subject, $html, $text, 'actions');
}

/** Запись по booking_id (для писем и страниц). */
function bookingById(string $bookingId): ?array
{
    $stmt = db()->prepare('SELECT * FROM bookings WHERE booking_id = ?');
    $stmt->execute([$bookingId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

// =====================================================================
// Публичные обработчики
// =====================================================================

// --- Свободные слоты дня ---
if ($method === 'GET' && $action === 'slots') {
    $serviceId = (int) ($_GET['service_id'] ?? 0);
    $date = trim((string) ($_GET['date'] ?? ''));
    $result = bookingSlotsFor($serviceId, $date);
    if (!$result['ok']) {
        respondError(422, $result['error']);
    }
    respondOk([
        'date' => $date,
        'slots' => $result['slots'],
        'day_off' => $result['day_off'] ?? false,
        'duration_min' => (int) ($result['service']['duration_min'] ?? 0),
    ]);
}

// --- Создание записи ---
if ($method === 'POST' && $action === 'create') {
    $data = inputJson();

    $serviceId = (int) ($data['service_id'] ?? 0);
    $date = trim((string) ($data['date'] ?? ''));
    $time = trim((string) ($data['time'] ?? ''));
    $name = trim((string) ($data['name'] ?? ''));
    $phone = trim((string) ($data['phone'] ?? ''));
    $email = trim((string) ($data['email'] ?? ''));
    $telegram = trim((string) ($data['telegram'] ?? ''));
    $comment = trim((string) ($data['comment'] ?? ''));

    if ($name === '' || mb_strlen($name) < 2) {
        respondError(422, 'Укажите имя');
    }
    if (!bookingPhoneValid($phone)) {
        respondError(422, 'Укажите корректный телефон');
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respondError(422, 'Некорректный email');
    }
    if (!preg_match('/^\d{1,2}:\d{2}$/', $time)) {
        respondError(422, 'Некорректное время');
    }

    $result = bookingSlotsFor($serviceId, $date);
    if (!$result['ok']) {
        respondError(422, $result['error']);
    }
    $service = $result['service'];
    $slot = null;
    foreach ($result['slots'] as $s) {
        if ($s['time'] === $time) {
            $slot = $s;
            break;
        }
    }
    if ($slot === null) {
        respondError(422, 'Такого времени нет в расписании');
    }
    if (!$slot['available']) {
        respondError(409, 'Это время уже занято — выберите другое');
    }

    $slotAt = new DateTimeImmutable($date . ' ' . $time . ':00');
    $slotEnd = $slotAt->modify('+' . max(5, (int) $service['duration_min']) . ' minutes');

    // Блокировка на время проверки и вставки: защита от одновременных записей
    $lock = (int) db()->query("SELECT GET_LOCK('booking_slot', 5)")->fetchColumn();
    if ($lock !== 1) {
        respondError(503, 'Попробуйте ещё раз через минуту');
    }

    try {
        // Повторная проверка слота под блокировкой
        $busy = bookingBusyIntervals($date);
        $busyStart = $slotAt->modify('-' . (int) $service['buffer_before_min'] . ' minutes');
        $busyEnd = $slotEnd->modify('+' . (int) $service['buffer_after_min'] . ' minutes');
        foreach ($busy as [$bStart, $bEnd]) {
            if (bookingOverlaps($busyStart, $busyEnd, $bStart, $bEnd)) {
                respondError(409, 'Это время только что заняли — выберите другое');
            }
        }

        // У клиента уже есть запись на это время (по телефону)
        $stmt = db()->prepare(
            'SELECT booking_id FROM bookings
             WHERE phone = ? AND status IN ("' . implode('","', BOOKING_ACTIVE_STATUSES) . '")
               AND slot_at < ? AND slot_end > ? LIMIT 1'
        );
        $stmt->execute([$phone, $slotEnd->format('Y-m-d H:i:s'), $slotAt->format('Y-m-d H:i:s')]);
        $existing = $stmt->fetchColumn();
        if ($existing) {
            respondError(409, 'У вас уже есть запись на это время (' . $existing . ')');
        }

        $user = currentUser();
        $status = (int) $service['auto_confirm'] === 1 ? 'confirmed' : 'new';
        $bookingId = bookingIdGenerate();
        $token = bookingToken();

        $stmt = db()->prepare(
            'INSERT INTO bookings
             (booking_id, service_id, service_title, slot_at, slot_end, buffer_before_min, buffer_after_min,
              name, phone, email, telegram, comment, user_id, status, payment_status, confirm_token,
              utm_source, utm_medium, utm_campaign, page)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "unpaid", ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $bookingId,
            $serviceId,
            (string) $service['title'],
            $slotAt->format('Y-m-d H:i:s'),
            $slotEnd->format('Y-m-d H:i:s'),
            (int) $service['buffer_before_min'],
            (int) $service['buffer_after_min'],
            $name,
            $phone,
            $email !== '' ? $email : null,
            $telegram !== '' ? $telegram : null,
            $comment !== '' ? $comment : null,
            $user['id'] ?? null,
            $status,
            $token,
            trim((string) ($data['utm_source'] ?? '')) ?: null,
            trim((string) ($data['utm_medium'] ?? '')) ?: null,
            trim((string) ($data['utm_campaign'] ?? '')) ?: null,
            trim((string) ($data['page'] ?? '')) ?: null,
        ]);

        $row = bookingById($bookingId);
        bookingNotifyAdmin($row);
        bookingNotifyClient($row);

        respondOk([
            'booking' => bookingOut($row, true),
            'message' => $status === 'confirmed'
                ? 'Запись подтверждена — ждём вас!'
                : 'Заявка на запись принята: подтвержу по телефону или письмом.',
        ]);
    } finally {
        db()->query("SELECT RELEASE_LOCK('booking_slot')");
    }
}

// --- Запись для страницы отмены (booking_id + token) ---
if ($method === 'GET' && $action === 'item') {
    $bookingId = trim((string) ($_GET['booking_id'] ?? ''));
    $token = trim((string) ($_GET['token'] ?? ''));
    $row = $bookingId !== '' ? bookingById($bookingId) : null;
    if (!$row || !hash_equals((string) $row['confirm_token'], $token)) {
        respondError(404, 'Запись не найдена');
    }
    $canCancel = in_array($row['status'], ['new', 'confirmed'], true);
    respondOk([
        'booking' => bookingOut($row, true) + [
            'can_cancel' => $canCancel,
            'when_label' => bookingWhen($row),
        ],
    ]);
}

// --- Отмена клиентом ---
if ($method === 'POST' && $action === 'cancel') {
    $data = inputJson();
    $bookingId = trim((string) ($data['booking_id'] ?? ''));
    $token = trim((string) ($data['token'] ?? ''));
    $reason = trim((string) ($data['reason'] ?? ''));

    $row = $bookingId !== '' ? bookingById($bookingId) : null;
    if (!$row || !hash_equals((string) $row['confirm_token'], $token)) {
        respondError(404, 'Запись не найдена');
    }
    if (!in_array($row['status'], ['new', 'confirmed'], true)) {
        respondError(409, 'Эту запись уже нельзя отменить');
    }

    $stmt = db()->prepare(
        'UPDATE bookings SET status = "canceled", cancel_reason = ?, canceled_by = "client", canceled_at = NOW() WHERE id = ?'
    );
    $stmt->execute([$reason !== '' ? mb_substr($reason, 0, 255) : null, (int) $row['id']]);

    $row = bookingById($bookingId);
    bookingNotifyAdmin($row);

    respondOk(['booking' => bookingOut($row, true), 'message' => 'Запись отменена']);
}

// =====================================================================
// Админка
// =====================================================================

if (in_array($action, ['list', 'admin_item', 'status', 'payment', 'reschedule', 'schedule', 'schedule_save'], true)) {
    requireRole(['admin', 'manager']);
}

// --- Список записей ---
if ($method === 'GET' && $action === 'list') {
    $status = trim((string) ($_GET['status'] ?? ''));
    $q = trim((string) ($_GET['q'] ?? ''));
    $dateFrom = trim((string) ($_GET['date_from'] ?? ''));
    $dateTo = trim((string) ($_GET['date_to'] ?? ''));
    $serviceId = (int) ($_GET['service_id'] ?? 0);
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(200, max(10, (int) ($_GET['per_page'] ?? 50)));

    $where = [];
    $params = [];
    if (in_array($status, BOOKING_STATUSES, true)) {
        $where[] = 'status = ?';
        $params[] = $status;
    } elseif ($status === 'active') {
        $where[] = 'status IN ("' . implode('","', BOOKING_ACTIVE_STATUSES) . '")';
    }
    if ($q !== '') {
        $where[] = '(name LIKE ? OR phone LIKE ? OR booking_id LIKE ? OR service_title LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like);
    }
    if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $where[] = 'slot_at >= ?';
        $params[] = $dateFrom . ' 00:00:00';
    }
    if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $where[] = 'slot_at <= ?';
        $params[] = $dateTo . ' 23:59:59';
    }
    if ($serviceId > 0) {
        $where[] = 'service_id = ?';
        $params[] = $serviceId;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $countStmt = db()->prepare("SELECT COUNT(*) FROM bookings $whereSql");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $listStmt = db()->prepare("SELECT * FROM bookings $whereSql ORDER BY slot_at DESC, id DESC LIMIT " . (($page - 1) * $perPage) . ", $perPage");
    $listStmt->execute($params);
    $items = array_map(fn ($row) => bookingOut($row, true), $listStmt->fetchAll());

    $today = (string) db()->query('SELECT CURDATE()')->fetchColumn();
    $counts = [
        'new' => (int) db()->query('SELECT COUNT(*) FROM bookings WHERE status = "new"')->fetchColumn(),
        'today' => (int) db()->query('SELECT COUNT(*) FROM bookings WHERE status IN ("new","confirmed","done") AND DATE(slot_at) = CURDATE()')->fetchColumn(),
    ];

    respondOk([
        'items' => $items,
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'pages' => max(1, (int) ceil($total / $perPage)),
        'counts' => $counts,
        'today' => $today,
    ]);
}

// --- Одна запись (админ) ---
if ($method === 'GET' && $action === 'admin_item') {
    $id = (int) ($_GET['id'] ?? 0);
    $stmt = db()->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        respondError(404, 'Запись не найдена');
    }
    respondOk(['booking' => bookingOut($row, true) + ['when_label' => bookingWhen($row)]]);
}

// --- Смена статуса ---
if ($method === 'POST' && $action === 'status') {
    $user = requireRole(['admin', 'manager']);
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    $status = trim((string) ($data['status'] ?? ''));
    $reason = trim((string) ($data['reason'] ?? ''));

    if (!in_array($status, BOOKING_STATUSES, true)) {
        respondError(422, 'Недопустимый статус');
    }
    $stmt = db()->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        respondError(404, 'Запись не найдена');
    }

    if ($status === 'canceled') {
        $stmt = db()->prepare(
            'UPDATE bookings SET status = "canceled", cancel_reason = ?, canceled_by = ?, canceled_at = NOW() WHERE id = ?'
        );
        $stmt->execute([
            $reason !== '' ? mb_substr($reason, 0, 255) : null,
            $user['role'] === 'admin' ? 'admin' : 'manager',
            $id,
        ]);
    } else {
        $stmt = db()->prepare('UPDATE bookings SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
    }

    $row = bookingById((string) $row['booking_id']);
    if ($status === 'confirmed') {
        bookingNotifyClient($row);
    }
    if ($status === 'canceled') {
        bookingNotifyAdmin($row);
    }

    respondOk(['booking' => bookingOut($row, true)]);
}

// --- Оплата ---
if ($method === 'POST' && $action === 'payment') {
    requireRole(['admin', 'manager']);
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    $status = trim((string) ($data['payment_status'] ?? ''));
    $method = trim((string) ($data['payment_method'] ?? ''));
    $amount = $data['payment_amount'] ?? null;

    if (!in_array($status, BOOKING_PAYMENT_STATUSES, true)) {
        respondError(422, 'Недопустимый статус оплаты');
    }
    if ($method !== '' && !in_array($method, BOOKING_PAYMENT_METHODS, true)) {
        respondError(422, 'Недопустимый способ оплаты');
    }
    if ($amount !== null && $amount !== '' && !is_numeric($amount)) {
        respondError(422, 'Некорректная сумма');
    }

    $stmt = db()->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        respondError(404, 'Запись не найдена');
    }

    $stmt = db()->prepare(
        'UPDATE bookings SET payment_status = ?, payment_method = ?, payment_amount = ?,
                paid_at = IF(? = "paid", NOW(), NULL) WHERE id = ?'
    );
    $stmt->execute([
        $status,
        $method !== '' ? $method : null,
        ($amount !== null && $amount !== '') ? (float) $amount : null,
        $status,
        $id,
    ]);

    $row = db()->query('SELECT * FROM bookings WHERE id = ' . $id)->fetch();
    respondOk(['booking' => bookingOut($row, true)]);
}

// --- Перенос записи ---
if ($method === 'POST' && $action === 'reschedule') {
    requireRole(['admin', 'manager']);
    verifyCsrf();
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    $date = trim((string) ($data['date'] ?? ''));
    $time = trim((string) ($data['time'] ?? ''));

    $stmt = db()->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        respondError(404, 'Запись не найдена');
    }
    if (!in_array($row['status'], ['new', 'confirmed'], true)) {
        respondError(409, 'Эту запись уже нельзя перенести');
    }

    $result = bookingSlotsFor((int) $row['service_id'], $date);
    if (!$result['ok']) {
        respondError(422, $result['error']);
    }
    $slot = null;
    foreach ($result['slots'] as $s) {
        if ($s['time'] === $time && $s['available']) {
            $slot = $s;
            break;
        }
    }
    if ($slot === null) {
        respondError(409, 'Это время недоступно');
    }

    $slotAt = new DateTimeImmutable($date . ' ' . $time . ':00');
    $durationMin = max(5, (int) round(
        ((new DateTimeImmutable((string) $row['slot_end']))->getTimestamp()
            - (new DateTimeImmutable((string) $row['slot_at']))->getTimestamp()) / 60
    ));
    $slotEnd = $slotAt->modify('+' . $durationMin . ' minutes');

    $stmt = db()->prepare('UPDATE bookings SET slot_at = ?, slot_end = ? WHERE id = ?');
    $stmt->execute([$slotAt->format('Y-m-d H:i:s'), $slotEnd->format('Y-m-d H:i:s'), $id]);

    $row = bookingById((string) $row['booking_id']);
    bookingNotifyClient($row);
    respondOk(['booking' => bookingOut($row, true)]);
}

// --- Расписание модуля ---
if ($method === 'GET' && $action === 'schedule') {
    respondOk(['schedule' => bookingSchedule()]);
}

if ($method === 'POST' && $action === 'schedule_save') {
    requireRole(['admin']);
    verifyCsrf();
    $data = inputJson();

    $days = array_values(array_unique(array_filter(array_map('intval', (array) ($data['days'] ?? [])), fn ($d) => $d >= 1 && $d <= 7)));
    sort($days);
    $from = trim((string) ($data['from'] ?? ''));
    $to = trim((string) ($data['to'] ?? ''));
    $step = max(5, min(240, (int) ($data['step'] ?? 30)));
    $horizon = max(1, min(365, (int) ($data['horizon_days'] ?? 30)));
    $minAhead = max(0, min(72, (int) ($data['min_hours_ahead'] ?? 2)));

    if (!preg_match('/^\d{1,2}:\d{2}$/', $from) || !preg_match('/^\d{1,2}:\d{2}$/', $to)) {
        respondError(422, 'Укажите время начала и конца приёма');
    }
    if ($from >= $to) {
        respondError(422, 'Начало приёма должно быть раньше конца');
    }

    $schedule = json_encode(['days' => $days, 'from' => $from, 'to' => $to, 'step' => $step], JSON_UNESCAPED_UNICODE);
    $stmt = db()->prepare('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
    $stmt->execute(['booking.schedule', $schedule]);
    $stmt->execute(['booking.horizon_days', (string) $horizon]);
    $stmt->execute(['booking.min_hours_ahead', (string) $minAhead]);

    respondOk(['schedule' => bookingSchedule()]);
}

respondError(404, 'Неизвестный запрос');
