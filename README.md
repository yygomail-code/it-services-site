# Витрина ИТ-услуг (Angular + PHP)

Персональный многостраничный сайт-витрина ИТ-услуг одного исполнителя с двумя воронками лидов: клиентской и партнёрской. Сборка с prerender → чистый HTML (Node на хостинге не нужен), PHP-шлюз для приёма лидов (Яндекс SMTP + MySQL).

## Стек

- **Фронт:** Angular 22 (standalone), SCSS, mobile-first, prerender/SSG
- **Бэк:** PHP 8.x — шлюз лидов и API админки (`auth.php`, `leads.php`, `content.php`, `pages.php`, `services.php`, `forms.php`, `media.php`, `users.php`, `roles.php`, `footer.php`)
- **БД:** MySQL/MariaDB — таблицы `leads`, `users`, `roles`, `site_content`, `pages`, `media`, `forms`, `services` (каталог услуг: группы, шаблоны карточек, медиа)
- **Админка:** `/admin` — лиды, услуги (каталог, группы, шаблоны карточек), страницы (блочный редактор, доступ по ролям), медиатека, формы, пользователи, роли, почта, контакты, хеадер, футер, бренд, подвал
- **SEO:** prerender-HTML с контентом из БД, meta + canonical, JSON-LD (Organization/Service/FAQ), sitemap.xml, robots.txt

## Команды

```bash
npm install          # установка зависимостей
npm start            # dev-сервер http://localhost:4200
npm run build        # production-сборка (SSR + prerender) → dist/it-services
npm run build:static # сборка для хостинга без Node → dist/it-services/browser
npm test             # unit-тесты (Vitest)

npm run dev:start    # запуск локальной среды: MariaDB + PHP dev-сервер (http://127.0.0.1:8090)
npm run dev:stop     # остановка локальной среды
```

Prerender подтягивает контент из БД, поэтому перед `build` и `build:static`
нужна запущенная локальная среда (`npm run dev:start`) — иначе страницы из БД
соберутся пустыми. Адрес API для сборки переопределяется переменной
`PRERENDER_API_BASE` (по умолчанию `http://127.0.0.1:8090`).

## Локальная среда (Windows)

Установлены portable-версии:
- **PHP 8.5.10 NTS x64** → `C:\php` (в PATH)
- **MariaDB 11.4.13** (совместима с MySQL, тот же протокол/PDO) → `C:\mariadb`, данные в `C:\mariadb-data`
- БД `it_services`, таблицы созданы по `db/schema.sql` (+ миграции из `db/migrate_*.sql`)

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
- Пользователи по умолчанию (из `db/seed.sql`; смените пароли!):
  - **admin / admin123** — Администратор
  - **manager1 / manager123** — Менеджер
  Системные учётные записи: заблокировать и удалить нельзя, переименовать и сменить пароль — можно.
- Роли: список настраивается в разделе **«Роли»** (код, название, порядок).
  Базовые: **client** — доступ только к личному кабинету; **manager** — лиды;
  **admin** — всё. **Гость** — системная роль для неавторизованных посетителей.
- Пользователи: раздел **«Пользователи»** — профиль (ФИО, дата рождения, адрес, контакты, сайт),
  роль, состояние **активен/заблокирован** (заблокированный войти не может), аватар из медиатеки,
  комментарий; кнопка генерации пароля; уведомления на email при создании учётной записи и смене
  пароля (через активный сервис раздела **«Почта»**)
- Доступ к страницам и ссылкам можно ограничить по ролям (раздел страницы → «Доступ»,
  у ссылок — кнопка-глаз). Гость на закрытой странице видит заглушку с кнопкой «Войти»,
  вошедший без нужной роли — «Нет доступа»; закрытые страницы отдаются с `noindex`.
- Контент, изменённый админом (таблица `site_content`), подставляется на сайт автоматически (телефон, город, заголовки, бренд, футер и др.)

## Структура

```
src/app/
  components/   header, footer, lead-form, form-render, service-card, case-card,
                services-grid, cases-grid, page-content (блоки страниц),
                cookie-consent, contact-icon
  data/         portfolio.data.ts, partners.data.ts
  models/       content.model.ts, lead.model.ts, admin.model.ts
  pages/        home, services-catalog (каталог услуг из БД), service-page (карточка
                услуги), portfolio, portfolio-detail, page-dynamic (страницы из БД),
                login, profile
  services/     content, lead, utm, seo, page, public-services, form, auth, admin,
                ui-settings, guards
  admin/        admin-layout, admin-login, admin-leads, admin-services (+ карточка
                услуги, группы, шаблоны карточек), admin-pages, admin-page-edit,
                page-canvas (канвас страницы на TipTap: блоки, секции, drag&drop),
                admin-media, admin-forms, admin-form-edit, admin-users, admin-roles,
                admin-settings, admin-header, admin-footer, admin-footer-bottom, admin-brand
styles/
  site-content.scss стили контента страниц (.pc-*), общие для сайта и канваса
api/
  bootstrap.php общий bootstrap (БД, сессии, CSRF, роли)
  lead.php      шлюз лидов (MySQL + очередь писем)
  auth.php      авторизация (login/logout/me/csrf)
  leads.php     лиды (список/статус/удаление)
  pages.php     страницы сайта (публичное чтение + редактирование)
  services.php  модуль «Услуги» (каталог, карточки, группы, шаблоны — публично и админка)
  content.php   контент сайта (чтение — публично, запись — admin)
  forms.php     конструктор форм и приём заявок
  media.php     медиатека (загрузка/список/удаление)
  users.php     пользователи
  roles.php     роли
  mail_services.php сервисы отправки почты (Яндекс, Mail.ru, Google, свой SMTP)
  mailer.php    общий SMTP-отправитель (SSL/STARTTLS)
  email_queue.php очередь писем (сохранение до отправки, повторы при сбое SMTP)
  cron_email_queue.php обработка очереди: CLI или по ссылке с ключом (?key=…)
  app_settings.php внутренние настройки (ключи серверных механизмов, не публикуются)
  header.php    настройки шапки (подпись, меню, кнопка)
  footer.php    настройки футера
  .env.example  пример окружения
db/
  schema.sql    схема БД
  seed.sql      начальный админ (admin/admin123)
  seed_content.sql, seed_pages.sql, seed_services.sql
  migrate_*.sql миграции
public/
  robots.txt, sitemap.xml, .htaccess, favicon.ico, logo.svg
proxy.conf.json прокси /api → 127.0.0.1:8090 (dev)
```

## Развёртывание

Коротко: `npm run dev:start` → `npm run build:static` → залить содержимое
`dist/it-services/browser/` в корень сайта, папку `api/` — рядом, создать БД
по `db/schema.sql` + сидам, заполнить `api/.env`.

Подробная инструкция (Apache/nginx, права, чек-лист) — в **[DEPLOY.md](DEPLOY.md)**.
