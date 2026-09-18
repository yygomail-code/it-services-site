-- Удаление старой страницы «Услуги» (#4, slug = services).
-- Маршрут /services теперь принадлежит модулю «Услуги» (таблицы services и др.),
-- страница из редактора страниц больше не используется. Её контент был перенесён
-- в модуль (каталог + карточки), бэкап: %TEMP%\opencode\backup-pages-hardcoded\page-4-services.json.
-- Применять на базах, созданных до 2026-09-17 (в db/seed_pages.sql страницы больше нет).

SET NAMES utf8mb4;

DELETE FROM pages WHERE slug = 'services';
