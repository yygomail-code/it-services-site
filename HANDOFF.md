# HANDOFF.md — Журнал передачи между сессиями

## Последняя сессия
- Дата: 2026-09-14
- Статус: Этапы 1–2 завершены (каркас + контент), этап 3 частично (PHP/MySQL файлы созданы)
- Создан Angular 22 standalone проект с prerender (24 маршрута), PHP-шлюз `api/lead.php`, схема БД `db/schema.sql`
- Сборка и тест проходят (24 prerendered, 1 тест)

## Согласованные решения
| Вопрос | Решение |
|---|---|
| Фронт | Angular standalone, mobile-first, prerender → чистый HTML |
| Бэк | PHP 8.x — шлюз `api/lead.php` (Яндекс SMTP + MySQL) |
| Мессенджеры | НЕ подключаем (только почта; задел — интерфейс `Notifier`) |
| БД | MySQL, таблица `leads` (CRM-готовая), локально для разработки |
| Воронки | Клиентская (услуги) + партнёрская (/partners, 7 ролей) |
| Уведомления | Письмо на Яндекс.Почту — пока только почта |
| Хостинг | Виртуальный сервер: PHP + MySQL + статика, без Node |
| Данные | Имя, телефон, фото, кейсы — заглушки, заполняются позже |

## Что сделано
- Angular 22 standalone + SCSS, роутинг, layout (header/footer), мобильное меню
- Страницы: home, services, service-detail, portfolio, portfolio-detail, about, partners, contacts, policy
- Контент-модели: 11 услуг (ядро + трендовые), 6 кейсов, 7 партнёрских ролей
- Форма лидов с UTM (LeadFormComponent, LeadService, UtmService)
- SeoService (title/description/canonical/OG + JSON-LD Service/FAQ)
- PHP-шлюз `api/lead.php` (SMTP-сокет без библиотек, MySQL PDO, honeypot-антиспам)
- `db/schema.sql`, `api/.env.example`
- SEO: sitemap.xml, robots.txt, logo.svg, JSON-LD в index.html

## Текущий этап
- Этап 3: PHP-шлюз создан, но локально PHP 8.5.6 и MySQL НЕ установлены (пользователь решит: winget/Docker)

## Что дальше (порядок)
1. Установить локально PHP 8.5.6 + MySQL (или подтвердить доступ)
2. Проверить `lead.php` синтаксис и работу с БД
3. Проверить форму end-to-end локально (dev-режим, без писем)
4. SEO: подключить реальный домен (заменить example.ru), Яндекс.Метрика
5. Деплой: prerender + инструкция

## Открытые вопросы
- Реальный домен и данные (имя, телефон, фото, кейсы) — заполняются позже
- Локальная установка PHP/MySQL: способ (winget/Docker/вручную)
- Коммиты: каркас готов к коммиту (см. git status)
