<?php
/**
 * Внутренние настройки приложения (таблица app_settings): ключ → значение.
 * На сайт не публикуются — только для серверных механизмов
 * (например, ключ запуска очереди писем по ссылке).
 */

declare(strict_types=1);

/** Значение настройки или null, если её нет. */
function appSettingGet(string $key): ?string
{
    try {
        $stmt = db()->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();
        return $value === false ? null : (string) $value;
    } catch (Throwable $e) {
        error_log('App settings get error: ' . $e->getMessage());
        return null;
    }
}

/** Сохранить значение; null — удалить настройку. */
function appSettingSet(string $key, ?string $value): void
{
    if ($value === null) {
        db()->prepare('DELETE FROM app_settings WHERE setting_key = ?')->execute([$key]);
        return;
    }
    db()->prepare(
        'INSERT INTO app_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?'
    )->execute([$key, $value, $value]);
}
