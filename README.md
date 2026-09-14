# Витрина ИТ-услуг (Angular + PHP)

Персональный многостраничный сайт-витрина ИТ-услуг одного исполнителя с двумя воронками лидов: клиентской и партнёрской. Сборка с prerender → чистый HTML (Node на хостинге не нужен), PHP-шлюз для приёма лидов (Яндекс SMTP + MySQL).

## Стек

- **Фронт:** Angular 22 (standalone), SCSS, mobile-first, prerender/SSG
- **Бэк:** PHP 8.x — `api/lead.php` (SMTP Яндекс + MySQL)
- **БД:** MySQL, таблица `leads` (CRM-готовая)
- **SEO:** prerender-HTML, meta, JSON-LD (Organization/Service/FAQ), sitemap.xml, robots.txt

## Команды

```bash
npm install          # установка зависимостей
npm start            # dev-сервер http://localhost:4200
npm run build        # production-сборка (SSR + prerender) → dist/it-services
npm run build:static # статическая сборка (только HTML, без Node) → dist
npm test             # unit-тесты (Vitest)

npm run dev:start    # запуск локальной среды: MariaDB + PHP dev-сервер (http://127.0.0.1:8090)
npm run dev:stop     # остановка локальной среды
```

## Локальная среда (Windows)

Установлены portable-версии:
- **PHP 8.5.10 NTS x64** → `C:\php` (в PATH)
- **MariaDB 11.4.13** (совместима с MySQL, тот же протокол/PDO) → `C:\mariadb`, данные в `C:\mariadb-data`
- БД `it_services`, таблица `leads` созданы по `db/schema.sql`

Запуск: `npm run dev:start` (поднимет MariaDB на 3306 и PHP на 8090).
Шлюз: `POST http://127.0.0.1:8090/api/lead.php`.
Конфигурация шлюза: `api/.env` (скопируйте `api/.env.example`). Режим `APP_ENV=dev` — письмо не отправляется, только запись в БД.

## Структура

```
src/app/
  components/   header, footer, lead-form, service-card, case-card
  data/         services.data.ts, portfolio.data.ts, partners.data.ts
  models/       content.model.ts, lead.model.ts
  pages/        home, services, service-detail, portfolio, portfolio-detail, about, partners, contacts, policy
  services/     content.service.ts, lead.service.ts, utm.service.ts, seo.service.ts
api/
  lead.php      шлюз лидов (SMTP + MySQL)
  .env.example  пример окружения
db/
  schema.sql    схема таблицы leads
public/
  robots.txt, sitemap.xml, favicon.ico, logo.svg
```

## Развёртывание

1. `npm run build:static` → папка `dist/it-services/browser` (чистый HTML)
2. Залить на хостинг: содержимое `browser/` в корень сайта, `api/lead.php` — вне публичной статики
3. Создать БД по `db/schema.sql`, заполнить `.env` (APP_ENV=prod, SMTP, MAIL_TO)
4. Настроить nginx/apache: отдача статики, POST `/api/lead.php` → PHP, SSL

Подробности — в CONTEXT.md, HANDOFF.md, PROMPT.md.
