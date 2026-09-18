<?php
/**
 * Формы (админка + публичный приём):
 *
 * Админка (только admin):
 *  GET  /api/forms.php                 — список форм (с числом полей и сабмитов)
 *  GET  /api/forms.php?action=get&id=N — форма с полями
 *  POST /api/forms.php?action=create   — создать {title, form_number?, submit_label?, success_message?, description?, fields:[...]}
 *  POST /api/forms.php?action=update   — обновить {id, ...}
 *  POST /api/forms.php?action=delete   — удалить {id}
 *  GET  /api/forms.php?action=submissions&id=N — сабмиты формы
 *
 * Публично (сайт):
 *  GET  /api/forms.php?action=public&id=N — готовая форма для рендера
 *  POST /api/forms.php?action=submit  — {id, data:{name:value,...}, page}
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

const FIELD_TYPES = ['text', 'email', 'phone', 'url', 'textarea', 'select'];

function validateFieldName(string $name): bool
{
    return (bool) preg_match('/^[a-z0-9_]{1,64}$/', $name);
}

function normalizeFields(array $fields): array
{
    $out = [];
    $sort = 0;
    foreach ($fields as $f) {
        if (!is_array($f)) {
            continue;
        }
        $type = (string) ($f['field_type'] ?? $f['type'] ?? 'text');
        if (!in_array($type, FIELD_TYPES, true)) {
            $type = 'text';
        }
        $label = trim((string) ($f['label'] ?? ''));
        $name = strtolower(trim((string) ($f['name'] ?? '')));
        if ($label === '' || !validateFieldName($name)) {
            continue;
        }
        $out[] = [
            'field_type' => $type,
            'label' => $label,
            'name' => $name,
            'placeholder' => array_key_exists('placeholder', $f) ? trim((string) $f['placeholder']) : null,
            'options' => array_key_exists('options', $f) && $f['options'] !== null && $f['options'] !== ''
                ? (is_array($f['options']) ? implode("\n", array_map('strval', $f['options'])) : (string) $f['options'])
                : null,
            'required' => !empty($f['required']) ? 1 : 0,
            'sort_order' => $sort++,
        ];
    }
    return $out;
}

function findNextNumber(PDO $pdo): int
{
    $stmt = $pdo->query('SELECT MAX(form_number) AS mx FROM forms');
    return (int) ($stmt->fetch()['mx'] ?? 0) + 1;
}

// ---------------------------------------------------------------------
// Публичный вывод формы (сайт)
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === 'public') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    try {
        $pdo = db();
        $stmt = $pdo->prepare(
            'SELECT id, form_number, title, description, submit_label, success_message FROM forms WHERE id = ?'
        );
        $stmt->execute([$id]);
        $form = $stmt->fetch();
        if (!$form) {
            respondError(404, 'Форма не найдена');
        }
        $stmt = $pdo->prepare(
            'SELECT id, field_type, label, name, placeholder, options, required
             FROM form_fields WHERE form_id = ? ORDER BY sort_order'
        );
        $stmt->execute([$id]);
        $fields = $stmt->fetchAll();
        foreach ($fields as &$field) {
            $field['options'] = $field['options'] === null
                ? []
                : array_values(array_filter(array_map('trim', explode("\n", $field['options']))));
            $field['required'] = (int) $field['required'];
        }
        unset($field);
        $form['fields'] = $fields;
        respondOk(['form' => $form]);
    } catch (Throwable $e) {
        error_log('Form public error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// Публичный приём сабмита (сайт)
// ---------------------------------------------------------------------
if ($method === 'POST' && $action === 'submit') {
    $data = inputJson();
    $id = (int) ($data['id'] ?? 0);
    $payload = $data['data'] ?? null;
    if ($id <= 0 || !is_array($payload)) {
        respondError(422, 'Некорректные данные формы');
    }
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, title, create_lead FROM forms WHERE id = ?');
        $stmt->execute([$id]);
        $form = $stmt->fetch();
        if (!$form) {
            respondError(404, 'Форма не найдена');
        }
        $stmt = $pdo->prepare(
            'SELECT name, label, field_type, required FROM form_fields WHERE form_id = ? ORDER BY sort_order'
        );
        $stmt->execute([$id]);
        $fields = $stmt->fetchAll();

        $clean = [];
        foreach ($fields as $field) {
            $name = $field['name'];
            $value = $payload[$name] ?? '';
            if (is_array($value)) {
                $value = implode(', ', $value);
            }
            $value = trim((string) $value);
            if ($field['required'] && $value === '') {
                respondError(422, 'Заполните поле: ' . $field['name']);
            }
            if ($field['field_type'] === 'email' && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                respondError(422, 'Некорректный e-mail: ' . $field['name']);
            }
            if ($field['field_type'] === 'url' && $value !== '' && !filter_var($value, FILTER_VALIDATE_URL)) {
                respondError(422, 'Некорректный адрес сайта: ' . $field['name']);
            }
            $clean[$name] = mb_substr($value, 0, 2000);
        }

        $page = trim((string) ($data['page'] ?? ''));
        $stmt = $pdo->prepare(
            'INSERT INTO form_submissions (form_id, data, page) VALUES (?, ?, ?)'
        );
        $stmt->execute([
            $id,
            json_encode($clean, JSON_UNESCAPED_UNICODE),
            $page !== '' ? $page : null,
        ]);
        $submissionId = (int) $pdo->lastInsertId();

        // Если форма помечена «Создавать лид» — заводим запись в leads
        if ((int) $form['create_lead'] === 1) {
            createLeadFromForm($pdo, $form, $clean, $fields, $data, $page);
        }

        respondOk(['id' => $submissionId]);
    } catch (Throwable $e) {
        error_log('Form submit error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

/**
 * Создаёт лид в таблице leads на основе отправки формы (create_lead=1).
 * Возвращает lead_id или null, если данных недостаточно.
 */
function createLeadFromForm(PDO $pdo, array $form, array $clean, array $fields, array $data, string $page): ?string
{
    $labels = [];
    foreach ($fields as $f) {
        $labels[$f['name']] = $f['label'];
    }

    $name = trim((string) ($clean['name'] ?? ''));
    $phone = trim((string) ($clean['phone'] ?? ''));
    if ($name === '' || $phone === '') {
        return null;
    }
    if (!preg_match('/^[+0-9()\-\s]{6,20}$/', $phone)) {
        return null;
    }

    $partnerRole = mb_substr(trim((string) ($clean['role'] ?? '')), 0, 64);
    $dealRaw = trim((string) ($clean['deal_type'] ?? ''));
    $dealType = null;
    if ($dealRaw !== '') {
        if (mb_stripos($dealRaw, 'еферальн') !== false) {
            $dealType = 'referral';
        } elseif (mb_stripos($dealRaw, 'одрядн') !== false) {
            $dealType = 'outsource';
        }
    }
    $leadType = ($partnerRole !== '' || $dealType !== null) ? 'partner' : 'client';

    $skip = ['name', 'phone', 'role', 'deal_type'];
    $messageParts = [];
    foreach ($clean as $key => $value) {
        if (in_array($key, $skip, true) || $value === '') {
            continue;
        }
        $messageParts[] = ($labels[$key] ?? $key) . ': ' . $value;
    }
    $message = $messageParts !== [] ? mb_substr(implode("\n", $messageParts), 0, 5000) : null;

    $nullIfEmpty = static fn (string $v): ?string => $v === '' ? null : $v;
    $utmSource = $nullIfEmpty(trim((string) ($data['utm_source'] ?? '')));
    $utmMedium = $nullIfEmpty(trim((string) ($data['utm_medium'] ?? '')));
    $utmCampaign = $nullIfEmpty(trim((string) ($data['utm_campaign'] ?? '')));

    $leadId = date('YmdHis') . '-' . bin2hex(random_bytes(4));
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
        'partner_role' => $partnerRole !== '' ? $partnerRole : null,
        'deal_type' => $dealType,
        'name' => mb_substr($name, 0, 255),
        'phone' => mb_substr($phone, 0, 50),
        'service' => mb_substr((string) $form['title'], 0, 255),
        'message' => $message,
        'utm_source' => $utmSource,
        'utm_medium' => $utmMedium,
        'utm_campaign' => $utmCampaign,
            'page' => $page !== '' ? $page : null,
            'status' => 'new',
        ]);

        // Уведомление о заявке — через очередь (при сбое SMTP письмо не теряется)
        $mailTo = getenv('MAIL_TO') ?: 'hello@example.ru';
        $mailSubject = $leadType === 'partner'
            ? 'Новый лид: ПАРТНЁР — ' . $name
            : 'Новый лид: ' . $name;
        $mailLines = [];
        $mailLines[] = 'Новая заявка с сайта';
        $mailLines[] = '-------------------';
        $mailLines[] = 'Форма: ' . $form['title'];
        $mailLines[] = 'Тип: ' . ($leadType === 'partner' ? 'Партнёр' : 'Клиент');
        $mailLines[] = 'Имя: ' . $name;
        $mailLines[] = 'Телефон: ' . $phone;
        if ($partnerRole !== '') {
            $mailLines[] = 'Роль партнёра: ' . $partnerRole;
        }
        if ($dealType !== null) {
            $mailLines[] = 'Формат: ' . $dealType;
        }
        if ($message !== null && $message !== '') {
            $mailLines[] = 'Сообщение:';
            $mailLines[] = $message;
        }
        if ($utmSource || $utmMedium || $utmCampaign) {
            $mailLines[] = 'Источник: ' . implode(' / ', array_filter([$utmSource, $utmMedium, $utmCampaign]));
        }
        $mailLines[] = 'Страница: ' . ($page !== '' ? $page : '-');
        $mailLines[] = 'Lead ID: ' . $leadId;
        $mailText = implode("\n", $mailLines);
        $mailHtml = '<pre style="font:13px/1.5 monospace; white-space:pre-wrap">'
            . htmlspecialchars($mailText, ENT_QUOTES, 'UTF-8') . '</pre>';
        require_once __DIR__ . '/email_queue.php';
        $queueId = emailQueueAdd($mailTo, $mailSubject, $mailHtml, $mailText, 'leads');
        emailQueueTrySendNow($queueId);

        return $leadId;
    }

// ---------------------------------------------------------------------
// Далее — только admin
// ---------------------------------------------------------------------
requireRole(['admin']);

// Список форм
if ($method === 'GET' && $action === '') {
    try {
        $rows = db()->query(
            'SELECT f.id, f.form_number, f.title, f.description, f.submit_label, f.success_message,
                    f.created_at, f.updated_at,
                    (SELECT COUNT(*) FROM form_fields ff WHERE ff.form_id = f.id) AS fields_count,
                    (SELECT COUNT(*) FROM form_submissions fs WHERE fs.form_id = f.id) AS submissions_count
             FROM forms f ORDER BY f.form_number'
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['fields_count'] = (int) $row['fields_count'];
            $row['submissions_count'] = (int) $row['submissions_count'];
        }
        unset($row);
        respondOk(['forms' => $rows]);
    } catch (Throwable $e) {
        error_log('Forms list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// Одна форма с полями
if ($method === 'GET' && $action === 'get') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT * FROM forms WHERE id = ?');
        $stmt->execute([$id]);
        $form = $stmt->fetch();
        if (!$form) {
            respondError(404, 'Форма не найдена');
        }
        $stmt = $pdo->prepare(
            'SELECT id, field_type, label, name, placeholder, options, required, sort_order
             FROM form_fields WHERE form_id = ? ORDER BY sort_order'
        );
        $stmt->execute([$id]);
        $fields = $stmt->fetchAll();
        foreach ($fields as &$field) {
            $field['options'] = $field['options'] === null
                ? []
                : array_values(array_filter(array_map('trim', explode("\n", $field['options']))));
            $field['required'] = (int) $field['required'];
        }
        unset($field);
        $form['fields'] = $fields;
        respondOk(['form' => $form]);
    } catch (Throwable $e) {
        error_log('Form get error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// Сабмиты формы
if ($method === 'GET' && $action === 'submissions') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    try {
        $stmt = db()->prepare(
            'SELECT id, form_id, data, page, created_at FROM form_submissions
             WHERE form_id = ? ORDER BY id DESC LIMIT 500'
        );
        $stmt->execute([$id]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['data'] = json_decode($row['data'], true) ?: [];
        }
        unset($row);
        respondOk(['submissions' => $rows]);
    } catch (Throwable $e) {
        error_log('Form submissions error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

if ($method !== 'POST') {
    respondError(405, 'Метод не поддерживается');
}

verifyCsrf();
$data = inputJson();

function normalizeFormData(array $data, PDO $pdo, ?int $existingId = null): array
{
    $title = trim((string) ($data['title'] ?? ''));
    if ($title === '') {
        respondError(422, 'Укажите название формы');
    }
    $number = isset($data['form_number']) ? (int) $data['form_number'] : 0;
    if ($number <= 0) {
        if ($existingId !== null) {
            // При обновлении номер не передан — сохраняем текущий
            $stmt = $pdo->prepare('SELECT form_number FROM forms WHERE id = ?');
            $stmt->execute([$existingId]);
            $current = $stmt->fetch();
            $number = $current ? (int) $current['form_number'] : findNextNumber($pdo);
        } else {
            $number = findNextNumber($pdo);
        }
    }
    $submitLabel = trim((string) ($data['submit_label'] ?? ''));
    if ($submitLabel === '') {
        $submitLabel = 'Отправить';
    }
    $successMessage = trim((string) ($data['success_message'] ?? ''));
    if ($successMessage === '') {
        $successMessage = 'Спасибо! Заявка отправлена.';
    }
    return [
        'form_number' => $number,
        'title' => mb_substr($title, 0, 255),
        'description' => array_key_exists('description', $data) && trim((string) $data['description']) !== ''
            ? mb_substr(trim((string) $data['description']), 0, 2000)
            : null,
        'submit_label' => mb_substr($submitLabel, 0, 100),
        'success_message' => mb_substr($successMessage, 0, 500),
        'create_lead' => !empty($data['create_lead']) ? 1 : 0,
        'fields' => normalizeFields($data['fields'] ?? []),
    ];
}

// Создание
if ($action === 'create') {
    $p = normalizeFormData($data, db());    try {
        $pdo = db();
        // Проверка уникальности номера
        $stmt = $pdo->prepare('SELECT id FROM forms WHERE form_number = ?');
        $stmt->execute([$p['form_number']]);
        if ($stmt->fetch()) {
            respondError(409, 'Форма с таким номером уже существует');
        }
        $stmt = $pdo->prepare(
            'INSERT INTO forms (form_number, title, description, submit_label, success_message, create_lead)
             VALUES (:form_number, :title, :description, :submit_label, :success_message, :create_lead)'
        );
        $stmt->execute([
            'form_number' => $p['form_number'],
            'title' => $p['title'],
            'description' => $p['description'],
            'submit_label' => $p['submit_label'],
            'success_message' => $p['success_message'],
            'create_lead' => $p['create_lead'],
        ]);
        $formId = (int) $pdo->lastInsertId();
        insertFields($pdo, $formId, $p['fields']);
        respondOk(['id' => $formId, 'form_number' => $p['form_number']]);
    } catch (Throwable $e) {
        error_log('Form create error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// Обновление
if ($action === 'update') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    $p = normalizeFormData($data, db(), $id);
    try {
        $pdo = db();
        $stmt = $pdo->prepare('SELECT id FROM forms WHERE form_number = ? AND id <> ?');
        $stmt->execute([$p['form_number'], $id]);
        if ($stmt->fetch()) {
            respondError(409, 'Форма с таким номером уже существует');
        }
        $stmt = $pdo->prepare(
            'UPDATE forms
             SET form_number = :form_number, title = :title, description = :description,
                 submit_label = :submit_label, success_message = :success_message, create_lead = :create_lead
             WHERE id = :id'
        );
        $stmt->execute([
            'form_number' => $p['form_number'],
            'title' => $p['title'],
            'description' => $p['description'],
            'submit_label' => $p['submit_label'],
            'success_message' => $p['success_message'],
            'create_lead' => $p['create_lead'],
            'id' => $id,
        ]);
        // Перезаписываем поля (удалить старые + вставить новые)
        $pdo->prepare('DELETE FROM form_fields WHERE form_id = ?')->execute([$id]);
        insertFields($pdo, $id, $p['fields']);
        respondOk(['id' => $id, 'form_number' => $p['form_number']]);
    } catch (Throwable $e) {
        error_log('Form update error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// Удаление
if ($action === 'delete') {
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        respondError(422, 'Не указан ID');
    }
    try {
        db()->prepare('DELETE FROM forms WHERE id = ?')->execute([$id]);
        respondOk(['id' => $id]);
    } catch (Throwable $e) {
        error_log('Form delete error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

respondError(404, 'Неизвестное действие');

function insertFields(PDO $pdo, int $formId, array $fields): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO form_fields (form_id, field_type, label, name, placeholder, options, required, sort_order)
         VALUES (:form_id, :field_type, :label, :name, :placeholder, :options, :required, :sort_order)'
    );
    foreach ($fields as $f) {
        $stmt->execute([
            'form_id' => $formId,
            'field_type' => $f['field_type'],
            'label' => $f['label'],
            'name' => $f['name'],
            'placeholder' => $f['placeholder'],
            'options' => $f['options'],
            'required' => $f['required'],
            'sort_order' => $f['sort_order'],
        ]);
    }
}
