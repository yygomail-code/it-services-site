# Витрина ИТ-услуг (Angular + PHP)

Персональный многостраничный сайт-витрина ИТ-услуг одного исполнителя с двумя воронками лидов: клиентской и партнёрской. Сборка с prerender → чистый HTML (Node на хостинге не нужен), PHP-шлюз для приёма лидов (Яндекс SMTP + MySQL).

## Стек

- **Фронт:** Angular 22 (standalone), SCSS, mobile-first, prerender/SSG
- **Бэк:** PHP 8.x — `api/lead.php` (SMTP Яндекс + MySQL), админка-API (`api/auth.php`, `api/leads.php`, `api/content.php`, `api/users.php`)
- **БД:** MySQL/MariaDB — таблицы `leads`, `users`, `site_content`
- **Админка:** `/admin` (авторизация, роли клиент/менеджер/админ, лиды, контент, пользователи, настройки)
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

Dev-сервер Angular проксирует `/api/*` на `http://127.0.0.1:8090` (см. `proxy.conf.json`), поэтому формы и админка работают через `http://localhost:4200`.

## Админка и авторизация

- Единая точка входа: кнопка **«Войти»** в шапке сайта → `/login`
- После входа пользователь попадает по роли:
  - **client** → `/profile` (личный кабинет, раздел в разработке)
  - **manager / admin** → `/admin` (админка)
- При попытке клиента зайти в `/admin` — автоматический редирект в `/profile` (защита и в UI, и в API)
- URL админки: `http://localhost:4200/admin/login`
- Пользователь по умолчанию: **admin / admin123** (создаётся из `db/seed.sql`; смените пароль!)
- Роли:
  - **client** — учётка создаётся, доступ только к личному кабинету
  - **manager** — лиды (просмотр, статусы, удаление)
  - **admin** — лиды + контент + пользователи + настройки
- Контент, изменённый админом (таблица `site_content`), подставляется на сайт автоматически (телефон, город, заголовок главной и др.)

## Структура

```
src/app/
  components/   header, footer, lead-form, service-card, case-card, cookie-consent
  data/         services.data.ts, portfolio.data.ts, partners.data.ts
  models/       content.model.ts, lead.model.ts, admin.model.ts
  pages/        home, services, service-detail, portfolio, portfolio-detail, about, partners, contacts, policy, terms
  services/     content.service.ts, lead.service.ts, utm.service.ts, seo.service.ts, auth.service.ts, admin.service.ts, admin.guard.ts
  admin/        admin-layout, admin-login, admin-leads, admin-content, admin-users, admin-settings
api/
  lead.php      шлюз лидов (SMTP + MySQL)
  bootstrap.php общий bootstrap (БД, сессии, CSRF, роли)
  auth.php      авторизация (login/logout/me/csrf)
  leads.php     лиды (список/статус/удаление) — manager, admin
  content.php   контент сайта (чтение — публично, запись — admin)
  users.php     пользователи (admin)
  .env.example  пример окружения
db/
  schema.sql    схема БД (leads, users, site_content)
  seed.sql      начальный админ (admin/admin123)
public/
  robots.txt, sitemap.xml, favicon.ico, logo.svg
proxy.conf.json прокси /api → 127.0.0.1:8090 (dev)
```

## Развёртывание

1. `npm run build:static` → папка `dist/it-services/browser` (чистый HTML)
2. Залить на хостинг: содержимое `browser/` в корень сайта, `api/` — в каталог PHP
3. Создать БД по `db/schema.sql` + `db/seed.sql`, заполнить `.env` (APP_ENV=prod, SMTP, MAIL_TO)
4. Настроить nginx/apache: отдача статики, `/api/*.php` → PHP, SSL
5. Админка рендерится на клиенте (`/admin/**` — без prerender), поэтому доступна с любого хостинга

Подробности — в CONTEXT.md, HANDOFF.md, PROMPT.md.
