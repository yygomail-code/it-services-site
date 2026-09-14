<?php
/**
 * Работа с лидами (менеджер, админ):
 *  GET    /api/leads.php                 — список (фильтры: status, lead_type, q, page, limit)
 *  POST   /api/leads.php?action=update   — обновить {id, status?, comment?}
 *  POST   /api/leads.php?action=delete   — удалить {id}
 *  GET    /api/leads.php?action=stats    — счётчики по статусам
 */

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$user = requireRole(['manager', 'admin']);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$action = $_GET['action'] ?? '';

// ---------------------------------------------------------------------
// GET — список лидов
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === '') {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int) ($_GET['limit'] ?? 25)));
    $offset = ($page - 1) * $limit;

    $where = [];
    $params = [];

    $status = trim((string) ($_GET['status'] ?? ''));
    if ($status !== '' && $status !== 'all') {
        $where[] = 'status = :status';
        $params['status'] = $status;
    }

    $leadType = trim((string) ($_GET['lead_type'] ?? ''));
    if ($leadType !== '' && $leadType !== 'all') {
        $where[] = 'lead_type = :lead_type';
        $params['lead_type'] = $leadType;
    }

    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '') {
        $where[] = '(name LIKE :q OR phone LIKE :q OR service LIKE :q OR lead_id LIKE :q)';
        $params['q'] = '%' . $q . '%';
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    try {
        $pdo = db();
        $stmt = $pdo->prepare("SELECT COUNT(*) AS total FROM leads $whereSql");
        $stmt->execute($params);
        $total = (int) $stmt->fetch()['total'];

        $stmt = $pdo->prepare(
            "SELECT id, lead_id, lead_type, partner_role, deal_type, name, phone, telegram,
                    service, message, utm_source, utm_medium, utm_campaign, page, status, created_at
             FROM leads $whereSql
             ORDER BY created_at DESC, id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $k => $v) {
            $stmt->bindValue(':' . $k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $leads = $stmt->fetchAll();

        respondOk([
            'leads' => $leads,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => max(1, (int) ceil($total / $limit)),
        ]);
    } catch (Throwable $e) {
        error_log('Leads list error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// GET — статистика
// ---------------------------------------------------------------------
if ($method === 'GET' && $action === 'stats') {
    try {
        $stmt = db()->query(
            "SELECT status, COUNT(*) AS cnt FROM leads GROUP BY status"
        );
        $rows = $stmt->fetchAll();
        $stats = ['new' => 0, 'in_progress' => 0, 'closed' => 0, 'rejected' => 0];
        foreach ($rows as $row) {
            $stats[$row['status']] = (int) $row['cnt'];
        }
        $total = array_sum($stats);
        respondOk(['stats' => $stats, 'total' => $total]);
    } catch (Throwable $e) {
        error_log('Leads stats error: ' . $e->getMessage());
        respondError(500, 'Ошибка сервера');
    }
}

// ---------------------------------------------------------------------
// POST — update / delete
// ---------------------------------------------------------------------
if ($method === 'POST') {
    verifyCsrf();
    $data = inputJson();

    if ($action === 'update') {
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) {
            respondError(422, 'Не указан ID лида');
        }

        $fields = [];
        $params = ['id' => $id];

        $status = trim((string) ($data['status'] ?? ''));
        $allowedStatuses = ['new', 'in_progress', 'closed', 'rejected'];
        if ($status !== '') {
            if (!in_array($status, $allowedStatuses, true)) {
                respondError(422, 'Недопустимый статус');
            }
            $fields[] = 'status = :status';
            $params['status'] = $status;
        }

        $comment = $data['comment'] ?? null;
        if (is_string($comment)) {
            $fields[] = 'notify_to = :comment';
            $params['comment'] = trim($comment) === '' ? null : trim($comment);
        }

        if (!$fields) {
            respondError(422, 'Нет данных для обновления');
        }

        try {
            $stmt = db()->prepare('UPDATE leads SET ' . implode(', ', $fields) . ' WHERE id = :id');
            $stmt->execute($params);
            respondOk(['id' => $id]);
        } catch (Throwable $e) {
            error_log('Leads update error: ' . $e->getMessage());
            respondError(500, 'Ошибка сервера');
        }
    }

    if ($action === 'delete') {
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) {
            respondError(422, 'Не указан ID лида');
        }
        try {
            db()->prepare('DELETE FROM leads WHERE id = ?')->execute([$id]);
            respondOk(['id' => $id]);
        } catch (Throwable $e) {
            error_log('Leads delete error: ' . $e->getMessage());
            respondError(500, 'Ошибка сервера');
        }
    }

    respondError(404, 'Неизвестное действие');
}

respondError(404, 'Неизвестный запрос');
