# HANDOFF.md — Журнал передачи между сессиями

## Последняя сессия
- Дата: 2026-09-14
- Статус: Этапы 1–4 завершены, локальная среда (PHP + MariaDB) установлена и проверена
- Установлено: PHP 8.5.10 (C:\php), MariaDB 11.4.13 (C:\mariadb), БД it_services + leads
- Шлюз lead.php проверен end-to-end: клиентский и партнёрский лиды пишутся в БД с UTM

## Согласованные решения
| Вопрос | Решение |
|---|---|
| Фронт | Angular standalone, mobile-first, prerender → чистый HTML |
| Бэк | PHP 8.5.x — шлюз `api/lead.php` (Яндекс SMTP + MySQL) |
| Мессенджеры | НЕ подключаем (только почта; задел — интерфейс `Notifier`) |
| БД | MariaDB 11.4 (совместима с MySQL), таблица `leads`, локально |
| Воронки | Клиентская (услуги) + партнёрская (/partners, 7 ролей) |
| Уведомления | Письмо на Яндекс.Почту — пока только почта (APP_ENV=prod) |
| Хостинг | Виртуальный сервер: PHP + MySQL + статика, без Node |
| Данные | Имя, телефон, фото, кейсы — заглушки, заполняются позже |

## Что сделано
- Angular 22 standalone + SCSS: роутинг, layout, 9 страниц, 24 prerendered маршрута
- Контент: 11 услуг, 6 кейсов, 7 партнёрских ролей (JSON-модели)
- Форма лидов с UTM (LeadForm, LeadService, UtmService) — проверена с PHP
- PHP-шлюз lead.php: валидация, honeypot-антиспам, чтение .env, MySQL (PDO), SMTP (сокет)
- MySQL-схема db/schema.sql (таблица leads)
- SEO: meta, JSON-LD (Organization/Service/FAQ), sitemap.xml, robots.txt
- Локальная среда: скрипты scripts/dev-start.ps1, dev-stop.ps1, npm run dev:*
- PATH: C:\php и C:\mariadb\bin добавлены (пользовательские)

## Текущий этап
- Этап 5 (SEO): базовое готово; осталось заменить example.ru на реальный домен
- Этап 6 (деплой): не начат

## Что дальше (порядок)
1. Реальный домен: заменить example.ru (SeoService, sitemap, robots, index.html, footer/contacts)
2. Реальные данные: имя, телефон, фото, кейсы
3. Яндекс.Метрика + цели, Google Search Console
4. Проверка SMTP в prod (реальные учётные данные Яндекс в api/.env)
5. Деплой на хостинг: build:static → залить browser/ + api/lead.php

## Открытые вопросы
- Реальный домен (заменить example.ru)
- Реальные контакты и фото
- Данные Яндекс SMTP (логин, пароль приложения) для prod
- Способ деплоя на хостинг (FTP/rsync/git)
