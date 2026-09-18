# PROJECT-SPEC.md — спецификация проекта «Витрина ИТ-услуг»

Назначение документа: полное описание системы — продукт, архитектура, модель данных,
контракты, правила и накопленные уроки. Документ годится для трёх задач:
1. продолжать разработку и подключать новые сессии/исполнителей;
2. передать проект другому разработчику;
3. при необходимости — пересобрать проект с нуля (в конце есть готовый промт).

Составлен по фактическому состоянию кода и БД (2026-09-18). При расхождении документа
и кода — источник истины код и живая БД; документ обновлять в том же изменении.

---

## 1. Продукт

**Что это:** персональный многостраничный сайт-витрина ИТ-услуг одного исполнителя,
работающий как воронка лидов. Две воронки:

- **Клиентская:** посетитель → услуга/товар → заявка или запись → лид/бронь.
- **Партнёрская:** партнёр (дизайнер, маркетолог, студия…) → сотрудничество → лид-партнёр
  (форматы: `referral` — комиссия за клиента, `outsource` — субподряд).

Трафик: соцсети, Авито, фриланс-биржи, прямой. UTM-метки подставляются из URL в скрытые
поля форм автоматически.

**Роли:**
- `guest` — посетитель без входа;
- `client` — учётная запись клиента (кабинет; в админку доступа нет);
- `manager` — админка: лиды + каталог (услуги/товары) + записи;
- `admin` — всё: контент, страницы, медиа, формы, пользователи, роли, почта, настройки.

**Ключевые пользовательские сценарии:**
1. Гость смотрит каталог услуг/товаров (фильтры по группам, поиск, сортировка, пагинация
   15/стр), открывает карточку (галерея, цена, описание, адрес с картой, форма заявки).
2. Оставляет заявку (имя, телефон, Telegram, комментарий) — письмо уходит в очередь и не теряется.
3. Записывается на услугу: дата → свободный слот → форма; получает письмо-подтверждение
   со ссылкой на отмену; может отменить запись сам.
4. Партнёр оставляет заявку о сотрудничестве (роль партнёра, формат сделки).
5. Владелец в админке: видит лиды и записи, управляет каталогом, контентом страниц
   (канвас-редактор), медиатекой, формами, пользователями, почтой.

**Ограничения среды (жёсткие):**
- На хостинге нет Node — только PHP, MySQL, статика. Фронт собирается в статический HTML
  (Angular prerender/SSG), Node нужен только на машине разработчика.
- Мессенджеры не подключаются: уведомления только почтой (задел — интерфейс `Notifier` в PHP).
- Онлайн-платежей нет: оплата записи/заказа только фиксируется вручную.

---

## 2. Стек и архитектура

| Слой | Технология |
|---|---|
| Фронт | Angular 22 standalone, zoneless, SCSS, mobile-first, prerender (SSG) + client hydration |
| Бэк | PHP 8.5 без фреймворка: экшен-роутеры `api/*.php`, PDO/MySQL, сессии + CSRF |
| БД | MariaDB/MySQL (utf8mb4), локально `it_services` |
| Почта | SMTP-сервисы (Яндекс/Mail.ru/Google/свой) + очередь `email_queue` |

**Схема размещения:** статический фронт (`dist/it-services/browser`) + `/api/*` + `/uploads/*`.
`.htaccess`: существующие файлы/каталоги — как есть; несуществующие `/api/*`, `/uploads/*` —
честный 404; всё остальное — `index.csr.html` (SPA-каркас для админки/кабинета/страниц из БД).

**Локальная разработка:**
- PHP: `php -S 127.0.0.1:8090 -t .` (из корня).
- Angular: `npm start` (порт 4200, прокси `/api` и `/uploads` → 8090, `changeOrigin: true`).
- Prerender при сборке требует запущенного API: `PRERENDER_API_BASE` (по умолчанию
  `http://127.0.0.1:8090`).
- Сборка: `npm run build` → `dist/it-services` (27 prerender-маршрутов).

**Почему так:** дешёвый shared-хостинг (Apache + PHP + MySQL), без Node и без внешних сервисов;
SSG даёт SEO и скорость, PHP — динамику (заявки, записи, админка) и файловое хранилище.

---

## 3. Модель данных (17 таблиц)

| Таблица | Назначение | Ключевые поля |
|---|---|---|
| `users` | пользователи | login, email, password_hash, role, full_name, last_name/first_name/middle_name, birth_date, country/region/city, address, phone, max_link, telegram, whatsapp, site, avatar_media_id, active |
| `roles` | справочник ролей | code, label, описание/права |
| `leads` | заявки | lead_id, lead_type (client\|partner), partner_role, deal_type, name, phone, telegram, service, message, utm_source/medium/campaign, page, status, notify_to, created_at |
| `email_queue` | очередь писем | to_email, subject, html, text_body, purpose (leads\|registration\|actions\|purchases\|other), status (pending\|sent\|failed), attempts, next_attempt_at, error |
| `mail_services` | SMTP-подключения | name, host, port, user, pass, from_email, from_name, secure, active, purpose |
| `media` | медиатека | url, type, size, alt, created_at |
| `pages` | страницы (контент) | slug, title, meta_title, meta_description, roles (JSON), content (JSON: секции → колонки → блоки), active, sort_order |
| `site_content` | тексты/настройки сайта | content_key (PK), content_value (строка или JSON) |
| `forms` | конструктор форм | name, slug, fields (JSON), submit_label, active |
| `form_fields` | поля форм | form_id, name, label, type, required, options |
| `form_submissions` | отправки форм | form_id, data (JSON), created_at |
| `services` | услуги и товары | slug, kind (service\|product), title, short_description, full_description, price, price_prefix (none\|from), price_note, icon, unit (piece\|time), duration_min, buffer_before_min, buffer_after_min, category_id, template_id, address, map_lat/map_lng, booking_enabled, shop_enabled, comments_enabled, rating_enabled, auto_confirm, prepay, postpay, payment_methods (JSON), roles (JSON), active, sort_order, rating_avg/count, comments_count, meta_title/meta_description |
| `service_categories` | группы каталога | slug, title, kind (NULL=все \| service \| product), sort_order, active |
| `card_templates` | шаблоны карточек | name, kind, fields (JSON: порядок и состав полей карточки) |
| `service_media` | галереи позиций | service_id, media_id, url, is_cover, sort_order |
| `app_settings` | настройки модулей | setting_key (PK), setting_value |
| `bookings` | записи на услуги | booking_id (BK-XXXXXX), service_id, service_title (снимок), slot_at, slot_end, buffer_before_min/after, name, phone, email, telegram, comment, user_id, status (new\|confirmed\|done\|canceled\|no_show), cancel_reason, canceled_by (client\|manager\|admin), canceled_at, payment_status (unpaid\|paid\|refunded), payment_method (cash\|card\|transfer\|sbp), payment_amount, paid_at, confirm_token, utm_*, page, created_at/updated_at |

**Правила видимости по ролям** (услуги, страницы, ссылки меню/футера): `NULL`/отсутствие —
видят все; `[]` — не видит никто; список — только эти роли.

---

## 4. Настройки и контент

**`app_settings` (ключи):**
- `services.enabled` / `services.roles` — раздел «Услуги» (по умолчанию включён);
- `products.enabled` / `products.roles` — раздел «Товары» (по умолчанию выключен);
- `booking.schedule` — JSON `{"days":[1..7],"from":"10:00","to":"18:00","step":30}`;
- `booking.horizon_days` — на сколько дней вперёд открыта запись (30);
- `booking.min_hours_ahead` — минимум часов до записи (2).

**`site_content` (ключи):**
- `header.config` — JSON: `{subtitle, subtitle_large, menu:[{label,url,roles}], cta:{label,url,roles}|null}`;
- `footer.columns` — JSON: колонки ссылок `[{title, links:[{label,url,roles,large,gap}]}]`;
- `footer.bottom_links` — JSON: ссылки подвала;
- `footer.about`, `footer.copyright`, `footer.logo`, `footer.contacts` — JSON-настройки футера;
- `brand.name`, `brand.mark`, `brand.logo` — бренд;
- `contacts.phone/email/telegram/whatsapp/viber/vk/max/city/address` — контакты;
- `main.herotitle`, `main.herosubtitle` — главная.

---

## 5. API (контракты)

**Общие правила:**
- Все ответы JSON: успех `{"ok":true, ...}`, ошибка `{"ok":false,"error":"текст"}`.
- Коды: 401 (не авторизован), 403 (нет прав), 404, 409 (конфликт: занято/нельзя),
  419 (CSRF), 422 (валидация), 503 (повторите позже).
- Мутации админки — только POST + заголовок `X-CSRF-Token` (токен: `GET /api/auth.php?action=csrf`),
  сессия `itservices_sess`, `credentials: include`.
- Доступ: `requireAuth()`, `requireRole(['admin','manager'])`.
- Вход: `POST /api/auth.php?action=login {login, password}` → сессия; `?action=me` — профиль + csrf;
  `?action=logout`.

| Файл | Действия | Доступ |
|---|---|---|
| `auth.php` | csrf, me, login, logout | все |
| `lead.php` | POST без action: заявка + письмо в очередь | все |
| `content.php` | GET — весь site_content; `set` — сохранить значения | чтение все / запись admin |
| `header.php` | GET — конфиг шапки; `save` — сохранить | admin |
| `footer.php` | GET — конфиг футера; `save` — сохранить | admin |
| `pages.php` | public, get, create, update, delete | чтение все / запись admin |
| `media.php` | загрузка (multipart), update, delete | admin |
| `forms.php` | public, submit, get, submissions, create, update, delete | public/submit все, остальное admin |
| `users.php` | create, update, delete (+ список) | admin |
| `roles.php` | save, delete | admin |
| `leads.php` | список, stats, update, delete | admin/manager |
| `mail_services.php` | список, save, delete, test, queue, queue_process, queue_retry, cron_link* | admin |
| `cron_email_queue.php` | обработка очереди по ключу | cron |
| `app_settings.php` | хелперы `appSettingGet/Set` (подключается другими) | — |
| `services.php` | catalog, item, categories, admin_list, admin_item, save, delete, categories_admin, category_save, category_delete, templates, template_save, template_delete, section, section_save | публично/чтение manager+, запись manager+ |
| `bookings.php` | slots, create, item, cancel, list, admin_item, status, payment, reschedule, schedule, schedule_save | публично/админ manager+ (расписание — admin) |
| `bootstrap.php` | ядро: env, db(), respond*, сессии, CSRF, currentUser, requireRole, inputJson, CORS | — |
| `mailer.php`, `email_queue.php` | SMTP и очередь писем | — |

**Ключевые контракты подробнее:**

- `GET services.php?action=catalog&q=&category=&kind=&sort=&page=&per_page=` → `{items, total, pages}`;
  сортировки: `''` (порядок), `price_asc`, `price_desc`, `title`, `rating`; 15/стр.
- `GET services.php?action=item&slug=` → `{item, media, template, section}`; `restricted` —
  раздел выключен или роль не подходит.
- `GET bookings.php?action=slots&service_id=&date=YYYY-MM-DD` → `{slots:[{time,available}], day_off, duration_min}`;
  учитываются расписание, буферы и занятость **по всем услугам** (мастер один), горизонт,
  минимум за N часов.
- `POST bookings.php?action=create {service_id,date,time,name,phone,email,telegram,comment,utm_*,page}`
  → `{booking, message}`; статус `confirmed` при `auto_confirm=1`, иначе `new`; письма админу и клиенту;
  защита от гонок `GET_LOCK('booking_slot')`, повторная проверка слота, запрет дубля по телефону (409).
- `GET bookings.php?action=item&booking_id=&token=` → `{booking, can_cancel}` (страница отмены).
- `POST bookings.php?action=cancel {booking_id,token,reason}` → отмена клиентом.
- Админ: `list` (status/q/date_from/date_to/service_id/page/per_page → items/total/pages/counts),
  `status` (подтверждение/отмена/выполнено/не пришёл), `payment` (paid/unpaid/refunded + способ + сумма),
  `reschedule`, `schedule`/`schedule_save`.

---

## 6. Контракт модуля («ядро + модули»)

**Ядро** (не отключается): страницы/контент, медиатека, формы и лиды, пользователи/роли,
почта и очередь писем, SEO, настройки сайта (шапка/футер/бренд/контакты), редактор страниц.

**Модуль** — самостоятельный блок с единым контрактом:
1. **Идентификатор** (`catalog`, `booking`, `orders`, `reviews`…) и флаг `modules.<id>.enabled`
   в `app_settings` (пример: `services.enabled`/`products.enabled`).
2. **API:** `api/<id>.php` — экшен-роутер (`action=…`), CSRF, `requireRole`.
3. **Таблицы:** префикс `<id>_*` (или явные, как `services`).
4. **Админ-раздел:** `admin/<id>/*` — один пункт меню; вложенное — внутри раздела.
5. **Публичные маршруты:** `/<id>` и `/<id>/:slug`; выключенный модуль отдаёт 404 и скрывает пункт меню.
6. **Настройки и уведомления:** письма только через `email_queue`; доступ — через роли.

**Реестр модулей:**

| Модуль | Статус | Что даёт |
|---|---|---|
| catalog | готов | услуги и товары: каталог, карточки, группы, шаблоны, медиа |
| leads | готов | заявки с форм + очередь писем |
| pages / media / forms / users / mail | готовы | ядро |
| **booking** | ядро готово, UI в работе | запись: слоты, подтверждение, отмена, оплата, перенос |
| orders | план | корзина, заказ, доставка/самовывоз, статусы, письма |
| reviews | план | отзывы и рейтинг с пре-модерацией |
| promo / payments | позже | промокоды, онлайн-оплата |

**Правила «без перегруза»:** у клиента минимум действий (гость без регистрации, одна кнопка
на действие, состояние в URL); один модуль = один пункт меню и одна страница-раздел;
все письма — через очередь; все флаги — в одном месте; модуль можно выключить без следов.

---

## 7. Frontend: структура и принципы

**Структура `src/app`:**
- `pages/` — home, services-catalog, service-page, portfolio, portfolio-detail, page-dynamic,
  login, profile, not-found;
- `admin/` — admin-layout, admin-login, admin-leads, admin-services, admin-service-edit,
  admin-service-categories, admin-service-templates, admin-pages, admin-page-edit, admin-media,
  admin-media-picker, admin-forms, admin-form-edit, admin-header, admin-footer, admin-footer-bottom,
  admin-brand, admin-users, admin-roles, admin-mail, admin-settings, admin-link-editor,
  admin-roles-picker, page-canvas;
- `components/` — header, footer, lead-form, service-card, services-grid, case-card, cases-grid,
  page-content, form-render, cookie-consent, contact-icon;
- `services/` — admin.service, content.service, auth.service, public-services.service, seo.service,
  form.service, lead.service, page.service, utm.service, ui-settings.service, guards, app-tick.interceptor;
- `models/`, `utils/`, `data/`.

**Публичные маршруты:** `/`, `/services`, `/services/:slug`, `/products`, `/products/:slug`,
`/portfolio`, `/portfolio/:slug`, `/about`, `/partners`, `/contacts`, `/policy`, `/terms`,
`/cookie-policy`, `/pages/:slug`, `/login`, `/profile`, `**` → 404.

**Админ-маршруты:** `/admin/login`; `/admin` (layout, guard): leads, services, services/:id,
service-categories, service-templates, pages, pages/:id, media, forms, forms/:id, header, footer,
brand, footer-bottom, users, roles, mail, settings.

**Админ-меню (группы):** Работа (Лиды, Каталог), Контент (Страницы, Медиатека, Формы),
Система (Пользователи, Роли, Почта), Сайт (Контакты, Хеадер, Футер, Бренд, Подвал).

**Принципы UI:**
- mobile-first; состояния: loading / empty / unavailable / restricted / notFound;
- фильтры и сортировки — в URL (shareable), поиск живой с задержкой ~350 мс;
- редактор страниц «один в один» с сайтом (канвас: секции/колонки/блоки, перетаскивание границ);
- без эмодзи; заглушка «Нет фото»; иконки — SVG;
- админка в стиле WordPress: списки с фильтрами, формы, «✓ Сохранено», подтверждения удаления;
- липкая мобильная панель действий на карточке (заявка/звонок).

---

## 8. SEO

- Prerender (SSG) — роботы видят контент без JS; 27 статических маршрутов.
- Уникальные `title`/`description` на страницу; canonical; `noindex` для служебных/закрытых.
- JSON-LD: Organization, Person, Service, Product, FAQ, BreadcrumbList (через инжектированный DOCUMENT).
- `sitemap.xml`, `robots.txt` (статические — обновлять при изменении состава разделов).
- WebP/AVIF + lazy-load; LCP < 2.5 c; Яндекс.Метрика + цели по формам и телефону.

---

## 9. Почта

- Письмо **сначала** сохраняется в `email_queue` (status pending), потом отправляется.
- Ретраи: 5/10/15/20/25 минут, до 5 попыток; после — `failed`, видно в админке
  («Почта» → «Очередь писем») с кнопкой «Отправить ещё раз».
- Назначения (`purpose`): leads, registration, actions, purchases, other — выбирают SMTP-сервис.
- Обработка очереди: при заходах в админку (троттлинг 5 мин), вручную, cron
  (`php api/cron_email_queue.php`) или ссылкой с ключом (для планировщиков-URL).
- Заявки уходят на `MAIL_TO` из `.env`; клиенту — подтверждение записи со ссылкой отмены.

---

## 10. Тестирование

**Сценарные тесты API** (PHP + curl, cookie-jar, CSRF-заголовок): вход, CRUD, слоты/записи,
конфликты, валидация, очередь писем. Пример — `%TEMP%\opencode\booking-scenarios.php`.

**CDP-тесты UI** (headless Chrome + DevTools Protocol, Node): навигация, клики, проверки DOM,
подмена `confirm`, `ng.getComponent()` для доступа к состоянию, эмуляция мобильного
(`Emulation.setDeviceMetricsOverride`), проверки после гидратации.

**Обязательные проверки перед завершением задачи:**
1. `npm run build` — сборка без ошибок, 27 prerender-маршрутов (API запущен).
2. CDP-тест затронутого сценария (включая мобильную ширину для публичных страниц).
3. Для API — сценарный тест (успех + конфликт + валидация).
4. Обновить HANDOFF.md (что сделано/проверено).

---

## 11. Грабли и правила (накопленные уроки)

1. **Гидратация и контент.** Контент грузится до `bootstrapApplication` (`main.ts` →
   `setPreloadedContent`), иначе первый рендер расходится с prerender-HTML, Angular пропускает
   компоненты и ломает DOM (порядок меню/ссылок). Любые данные, влияющие на первый рендер,
   должны быть доступны до гидратации.
2. **`@if` внутри `@for`.** Условные ветки внутри цикла ломают перестановку DOM при обновлении
   списка (элементы вставляются не на своё место). Вместо двух веток — один элемент с условными
   привязками (`[routerLink]`/`[attr.href]`/`[attr.target]`), фильтрация — геттером.
3. **`track` в `@for`** — только уникальные ключи (дубли дают NG0955).
4. **`[selected]` на `<option>`** для select с `@for` (а не `[value]` на select) — иначе
   выбранное значение не отображается.
5. **Zoneless.** После асинхронных операций — `cdr.markForCheck()`; для HTTP есть
   `app-tick.interceptor`.
6. **iframe:** `bypassSecurityTrustResourceUrl` (иначе NG0904).
7. **JSON-LD в prerender:** только через инжектированный `DOCUMENT`.
8. **Prerender требует API:** перед `npm run build` поднять PHP-сервер.
9. **Dev-сервер (HMR)** периодически отдаёт старую сборку/виснет — помогает полный перезапуск.
10. **PowerShell искажает кириллицу** — проверки файлов/БД делать PHP- или Node-скриптами.
11. **MySQL съедает одиночный `\`** в строковых литералах (NO_BACKSLASH_ESCAPES или удвоение).
12. **SQL-файлы:** при прогоне скриптом убирать строки-комментарии (`--`) и делить по `;\n`;
   `str_replace('--','')` оставляет текст комментария и ломает запрос.
13. **Письма — только через очередь** (иначе теряются при сбое SMTP).
14. **Идентичность сохраняется:** не удалять и не пересоздавать объекты ради смены свойства;
   удаление — отдельное действие с подтверждением и бэкапом.

---

## 12. Порядок сборки с нуля (если понадобится)

| Этап | Содержание | Критерий приёмки |
|---|---|---|
| 0 | Окружение: PHP 8.5, MySQL, Node (только сборка); `api/bootstrap.php`, БД, `.env` | API отвечает, БД создана |
| 1 | Каркас Angular: layout, токены, роутинг, шапка/футер, cookie-баннер | Сайт открывается, mobile-first |
| 2 | Заявки: `leads`, `lead.php`, формы + UTM, очередь писем, админка лидов | Заявка → БД → письмо в очереди |
| 3 | Контент: `pages`, `site_content`, канвас-редактор, шапка/футер/бренд/контакты, медиатека | Правки в админке = сайт |
| 4 | SEO и деплой: meta, JSON-LD, sitemap/robots, prerender, `.htaccess` | 27 маршрутов, робот видит контент |
| 5 | Каталог: `services`/`service_categories`/`card_templates`/`service_media`, админка, `/services`, `/products`, карточки, заявки | CRUD + публичные страницы + заявка |
| 6 | Запись: `bookings`, расписание, слоты, подтверждение, отмена, оплата, перенос | Все сценарии записи проходят |
| 7 | Заказы/корзина/доставка, отзывы, промо (по AUDIT.md) | По отдельному ТЗ |

Каждый этап заканчивается сборкой, тестами (API + CDP) и обновлением HANDOFF.

---

## 13. Текущее состояние (2026-09-18)

**Готово:** ядро (страницы/контент/медиа/формы/пользователи/роли/почта/SEO/prerender),
модуль «Каталог» (услуги и товары, админка, публичные страницы, фильтры/сортировки),
исправлена сортировка ссылок (шапка/футер/подвал), аудит и план (`AUDIT.md`),
ядро модуля «Запись» (БД + API + сценарии — все проходят).

**В работе:** UI записи (календарь на карточке услуги, страница отмены `/booking/:id?token=`),
админ-раздел «Записи» (список + расписание).

**Бэклог:** корзина/заказы с доставкой и самовывозом, отзывы/рейтинг, промокоды,
онлайн-оплата, генерация sitemap из БД, страница «Модули» (реестр), журнал действий.

**Тестовые данные:** 6 услуг с записью (`db/seed_services_booking.sql`), 3 тестовые брони
на ближайший понедельник. Старые 11 услуг удалены — восстанавливаются из `db/seed_services.sql`.

---

## 14. Готовый промт для пересборки (копировать целиком)

> Собери проект «Витрина ИТ-услуг» с нуля по спецификации PROJECT-SPEC.md.
> Стек: Angular 22 (standalone, zoneless, mobile-first, prerender/SSG + hydration) + PHP 8.5
> (экшен-роутеры, PDO/MySQL, сессии + CSRF) + MariaDB. Хостинг без Node: фронт — статика,
> PHP — API и админка. Почта — только через очередь `email_queue`.
> Порядок: (0) окружение и БД; (1) каркас Angular + layout; (2) заявки + очередь писем + админка
> лидов; (3) контент (pages/site_content + канвас-редактор + шапка/футер/бренд/контакты + медиа);
> (4) SEO + prerender + .htaccess; (5) каталог услуг/товаров с группами, шаблонами карточек,
> медиа-галереями, фильтрами/сортировкой/пагинацией; (6) запись на услуги (слоты, буферы,
> подтверждение, отмена клиентом по токену, оплата, перенос); (7) заказы/отзывы по бэклогу.
> Контракт модуля: флаг `modules.<id>.enabled` в app_settings, `api/<id>.php`, таблицы `<id>_*`,
> один админ-раздел и пункт меню, публичные маршруты с 404 при выключении, письма через очередь.
> Обязательно соблюдай раздел «Грабли и правила»: предзагрузка контента до bootstrap;
> никаких `@if` внутри `@for`; `[selected]` на option; `markForCheck` в zoneless; JSON-LD через
> DOCUMENT; prerender требует запущенного API; SQL-скрипты без построчного разбора комментариев;
> кириллица — только через PHP/Node-проверки; каждый этап — сборка + сценарные тесты API +
> CDP-тесты UI + обновление HANDOFF.md.
