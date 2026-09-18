# Деплой на хостинг (без Node.js)

Сайт собирается в статические файлы (prerender), на сервере нужны только
PHP 8.x и MySQL/MariaDB. Node на хостинге не требуется.

## 1. Что нужно от хостинга

- **Apache** (проще всего: правила лежат в `.htaccess`) или **nginx**;
- **PHP 8.1+** с расширениями `pdo_mysql`, `mbstring`, `openssl` (для SMTP);
- **MySQL/MariaDB** — база под таблицы `leads`, `users`, `site_content`, `pages`, `media`, `forms`, `roles`;
- **HTTPS** (Let's Encrypt) — сайт и админка только по https;
- **SMTP Яндекс.Почты**: логин и пароль приложения (для писем о заявках).

## 2. Структура на хостинге

```
<корень сайта>/
  index.html, index.csr.html      ← из сборки (index.csr.html обязателен)
  about/ contacts/ services/ ...  ← prerender-страницы из сборки
  *.js, *.css, fonts/, favicon.ico, logo.svg
  robots.txt, sitemap.xml
  .htaccess                       ← правила Apache (уже в сборке)
  api/                            ← папка api из репозитория (PHP)
  uploads/                        ← медиатека: создать, дать права на запись
```

`index.csr.html` — каркас приложения для клиентских маршрутов: `/admin/**`,
`/login`, `/profile`, `/pages/**`. Без него админка не откроется.

## 3. Сборка

Prerender берёт контент из базы, поэтому **перед сборкой поднимите локальную
среду** (MariaDB + PHP API):

```bash
npm run dev:start     # MariaDB (3306) + PHP API (8090)
npm run build:static  # → dist/it-services/browser
```

Если API не запущен, страницы из БД (about, contacts, policy…) соберутся
пустыми, а тексты главной не попадут в HTML. Адрес API для сборки при
необходимости переопределяется переменной окружения `PRERENDER_API_BASE`.

Дальше залить **содержимое** `dist/it-services/browser/` в корень сайта
(включая скрытый `.htaccess`), а папку `api/` — в `<корень>/api/`.

## 4. База данных

Создать базу и пользователя, затем выполнить по порядку:

```
db/schema.sql          — таблицы (роли, почта, очередь писем, настройки)
db/seed.sql            — пользователь admin/admin123
db/seed_content.sql    — тексты и настройки сайта
db/seed_pages.sql      — страницы (about, contacts, policy…)
db/migrate_page_content.sql — контент главной, «Услуг» и «Портфолио» (применять после seed_pages.sql)
db/migrate_services.sql — модуль «Услуги»: таблицы каталога, групп, шаблонов карточек, медиа + настройки раздела
db/seed_services.sql   — услуги из старого каталога (11 позиций; применять после migrate_services.sql)
db/migrate_products_section.sql — раздел «Товары»: настройки видимости (products.enabled, products.roles)
db/migrate_category_kind.sql — тип группы каталога (NULL — для всех, service — услуги, product — товары)
```

Если база создавалась ранее, примените недостающие миграции `db/migrate_*.sql`
(roles, page_roles, users_profile, mail_services, email_queue, app_settings, services,
drop_services_page и др.).

Затем заполнить `api/.env` (скопировать из `api/.env.example`):

```
APP_ENV=prod
DB_HOST=localhost
DB_PORT=3306
DB_NAME=<база>
DB_USER=<пользователь>
DB_PASS=<пароль>
MAIL_TO=<куда присылать заявки>
```

`api/.env` закрыт правилами `.htaccess` от чтения извне — проверьте, что файл
недоступен по `https://<домен>/api/.env`.

SMTP-сервис (Яндекс и т.п.) настраивается **в админке**: раздел «Почта» →
«Добавить сервис» (например, Яндекс: `smtp.yandex.ru`, порт 465, SSL,
логин и пароль приложения). Оттуда же — «Отправить тестовое письмо».

### Очередь писем

Письма (заявки и уведомления) сохраняются в таблице `email_queue` до отправки:
при сбое SMTP попытки повторяются с растущей паузой (5/10/15/20 минут, до 5
попыток), после чего письмо видно в админке («Почта» → «Очередь писем») с
кнопкой «Отправить ещё раз».

Обработка очереди — три способа: при заходах в админку, по cron и по ссылке.

**Вариант 1 — crontab** (если у хостинга есть планировщик команд):

```
*/5 * * * * /usr/bin/php /path/to/site/api/cron_email_queue.php >> /path/to/site/api/queue.log 2>&1
```

**Вариант 2 — запуск по ссылке** (если панель хостинга умеет только URL):
в админке «Почта» → «Запуск по расписанию» → «Сгенерировать ссылку», затем
добавить её в планировщик хостинга (или внешний сервис расписаний) каждые 5 минут:

```
https://<домен>/api/cron_email_queue.php?key=<ключ>
```

Ссылка запускает отправку без входа в админку; «Перегенерировать» отключает
старую ссылку, «Отключить» — выключает запуск по ссылке совсем.

Без планировщика письма всё равно уходят при заходах в админку, но с задержкой.

## 5. Веб-сервер

### Apache

`.htaccess` из сборки уже делает всё нужное: отдаёт статику, а неизвестные
адреса (админка, кабинет, страницы из БД) — `index.csr.html`.
Убедитесь, что в конфигурации виртуального хоста разрешены `.htaccess`:

```apache
<Directory /var/www/site>
  AllowOverride All
  Require all granted
</Directory>
```

### nginx

```nginx
server {
  listen 443 ssl;
  server_name <домен>;
  root /var/www/site;
  index index.html;

  # Prerender-страницы и статика
  location / {
    try_files $uri $uri/ $uri/index.html /index.csr.html;
  }

  # PHP: шлюз лидов и API админки
  location ~ ^/api/.+\.php$ {
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
  }

  # Медиатека
  location /uploads/ {
    try_files $uri =404;
  }

  # Не отдавать конфиги
  location ~* \.(env|log|sql|md)$ { deny all; }

  gzip on;
  gzip_types text/html text/css application/javascript application/json image/svg+xml;

  # Статика с хэшем в имени — надолго
  location ~* \.(js|css|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; }
}
```

## 6. Права и безопасность

- `uploads/` — запись для пользователя PHP (обычно `www-data`), без выполнения PHP;
- `api/.env` — только чтение, недоступен из веба;
- каталоги `api/` и `db/` — без листинга (`Options -Indexes` / `autoindex off`);
- HTTPS обязателен: сессии админки и формы идут с паролями;
- после первого входа **смените пароль admin** (Пользователи → admin).

## 7. Проверка после деплоя

1. `https://<домен>/` — главная с текстами (не пустая);
2. `https://<домен>/about`, `/contacts`, `/policy` — контент виден без JS
   (проверить `curl -s https://<домен>/about | grep -o '<h1[^>]*>[^<]*'`);
3. `https://<домен>/admin/login` — форма входа, вход admin → разделы админки;
4. Заявка с формы на `/contacts` → появилась в админке (Лиды), а письмо — на `MAIL_TO`
   (или в «Почта» → «Очередь писем», если SMTP ещё не настроен);
5. `https://<домен>/api/.env` — 403/404;
6. Медиатека: загрузка файла → файл открывается по `/uploads/...`;
7. «Почта» → «Отправить тестовое письмо» — письмо доходит; в «Очереди писем» нет
   записей с ошибкой.

## 8. Обновление сайта

```bash
npm run dev:start
npm run build:static
# залить содержимое dist/it-services/browser/ поверх старых файлов
```

Изменения контента через админку видны сразу (сайт берёт тексты из БД), но
**prerender-HTML обновляется только при пересборке** — после крупных правок
текстов (главная, страницы из БД) имеет смысл пересобрать и перезалить сайт.

## 9. Перед продакшеном (чек-лист)

- [ ] Заменить `https://example.ru` на реальный домен: `src/app/services/seo.service.ts`,
      `src/index.html` (JSON-LD), `public/sitemap.xml`, `public/robots.txt`
- [ ] Проверить телефон/почту/город: раздел «Контакты» в админке и текст страницы «Контакты»
- [ ] Сменить пароль администратора
- [ ] Заполнить `api/.env` (APP_ENV=prod, MAIL_TO)
- [ ] Настроить SMTP-сервис в админке («Почта») и проверить тестовым письмом
- [ ] Настроить обработку очереди: cron-команду или ссылку из «Почты» → «Запуск по расписанию»
- [ ] Подключить Яндекс.Метрику (счётчик + цели по формам и телефону) и Google Search Console
- [ ] Проверить письмо о заявке на реальный адрес
- [ ] Реальные фото и кейсы вместо заглушек
