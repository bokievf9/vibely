# Деплой (vibelydate.com)

Push в `main` → GitHub Actions: проверки (typecheck, lint, SQL- и unit-тесты) → сборка в CI
(`output: 'standalone'`) → релиз загружается на VPS в `/var/www/vibely/releases/<время>-<sha>` →
`activate.sh` атомарно переключает симлинк `current`, перезапускает PM2 и проверяет
`/api/health`. Если релиз не поднялся — автоматический откат на предыдущий. Хранятся 5 последних релизов.

## Раскладка на сервере (пользователь `deploy`)

```
/var/www/vibely/
├── current -> releases/<id>          # живой релиз
├── releases/<id>/                    # server.js, .next/static, public, ecosystem.config.cjs, activate.sh
└── shared/.env.production            # серверные секреты (chmod 600), не попадают в релизы
```

`shared/.env.production`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`; опционально `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MODERATORS_CHAT_ID`,
`CRON_SECRET` (≥ 32 символов, `openssl rand -hex 32`; без него `POST /api/cron/retention` отвечает 503
и 90-дневная очистка медиа и селфи не работает).
Telegram-бот модерации (опционально, см. раздел ниже): `TELEGRAM_WEBHOOK_SECRET`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_SEND_SELFIES`, `TELEGRAM_TOPIC_SELFIES`, `TELEGRAM_TOPIC_REPORTS`,
`TELEGRAM_TOPIC_ALERTS`.
Звонки (опционально, см. `docs/calls.md`): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`CALLS_PURGE_SECRET`, `RECORDINGS_S3_*`.

Ручной откат: `ln -sfn /var/www/vibely/releases/<id> /var/www/vibely/current && pm2 restart vibely`.

## GitHub → Settings → Secrets and variables → Actions

| Secret | Значение |
|---|---|
| `VPS_HOST` | `68.183.177.183` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | приватный ключ `/home/deploy/.ssh/gha_deploy` |
| `VPS_KNOWN_HOSTS` | вывод `ssh-keyscan 68.183.177.183` |
| `CRON_SECRET` | то же значение, что в `shared/.env.production` (`.github/workflows/retention.yml`, ежедневно; `.github/workflows/telegram.yml`, ежечасно и в 09:00 MYT; `.github/workflows/events.yml`, каждые 5 минут: напоминания о вечерах свиданий вслепую, `POST /api/cron/events-push`) |

Variables (публичные значения, вшиваются в бандл при сборке): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`; опционально `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_ANALYTICS_SRC`, `NEXT_PUBLIC_ANALYTICS_SITE_ID`.

## Сервер

- SSH только по ключу (`/etc/ssh/sshd_config.d/00-vibely-hardening.conf`), fail2ban для sshd.
- Node 22 (NodeSource), PM2 под `deploy` с автозапуском (`pm2-deploy.service`) и `pm2-logrotate`.
- Nginx: `www` и `http` → `https://vibelydate.com`; лимит POST на `/{lang}/login|verify-otp`
  20/мин с IP (`/etc/nginx/conf.d/vibely-limits.conf`); прокси на `127.0.0.1:3000`.
- Swap 2 ГБ.

## Supabase Dashboard

- Auth → Hooks → Before User Created → `public.hook_before_user_created` (только Малайзия).
- Realtime → private only (включено).
- Капча: сначала задеплоить с `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, потом включить Turnstile в
  Auth → Bot and Abuse Protection (иначе отправка SMS сломается).
- Вход по @username + паролю (`20261009000180_password_login.sql`): отдельного переключателя нет,
  пароль для телефона входит в провайдер Phone (Auth → Sign In / Providers → Phone: включён).
  Auth → Providers → Email (общие настройки паролей): **Secure password change** = on,
  **Minimum password length** = 10, **Password requirements** = пусто (правила проверяет
  приложение); **Leaked password protection** = on (только на Pro-плане, после апгрейда).
  Капча Turnstile проверяется Supabase и на входе по паролю. Nginx должен передавать
  `proxy_set_header X-Real-IP $remote_addr;` (лимит 20 неудачных попыток с IP за 15 минут).

## Telegram-бот модерации (`src/features/telegram`)

Двусторонний бот: уведомления о селфи, жалобах и тревогах в группу модераторов, кнопки
(одобрить/отклонить селфи, отклонить жалобу, скрыть, бан) и команды `/stats`, `/queue`, `/user`,
`/ban`, `/unban`, `/help`. Действовать могут только модераторы, привязавшие Telegram в
`/admin/telegram`; каждое действие пишется в `moderation_actions` от их имени.

Переменные в `shared/.env.production` (значения не коммитить):

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен от @BotFather |
| `TELEGRAM_MODERATORS_CHAT_ID` | id закрытой супергруппы модераторов (`-100…`) |
| `TELEGRAM_WEBHOOK_SECRET` | 32 до 256 символов `A-Za-z0-9_-` (`openssl rand -hex 32`); без него вебхук отвечает 503 |
| `TELEGRAM_BOT_USERNAME` | имя бота без `@` (опционально: команды для других ботов игнорируются) |
| `TELEGRAM_SEND_SELFIES` | `true`: селфи и до 3 фото профиля загружаются в группу (по умолчанию выкл., тогда только текст) |
| `TELEGRAM_TOPIC_SELFIES`, `TELEGRAM_TOPIC_REPORTS`, `TELEGRAM_TOPIC_ALERTS` | опционально: `message_thread_id` тем форума |

Настройка:

1. @BotFather: `/newbot`; `/setprivacy` → **Enable** (бот видит в группе только команды);
   `/setjoingroups` → Disable после добавления в группу.
2. Создать **закрытую** супергруппу только для модераторов, добавить бота и сделать его
   администратором с правом **удалять сообщения** (нужно, чтобы убирать фото селфи и коды `/link`).
   Узнать id группы (например, через `getUpdates` до установки вебхука) и записать в
   `TELEGRAM_MODERATORS_CHAT_ID`. Опционально включить темы и записать их id.
3. Заполнить переменные, `pm2 restart vibely`.
4. На сервере: `node /var/www/vibely/current/scripts/telegram/set-webhook.mjs /var/www/vibely/shared/.env.production`
   (или локально с копией env-файла). Скрипт ставит вебхук `https://vibelydate.com/api/telegram/webhook`
   с `secret_token` и `allowed_updates`, задаёт список команд и не печатает секреты.
5. Каждый модератор: `/admin/telegram` → «Получить код» → отправить боту **в личку** `/link КОД`
   (код живёт 10 минут, хранится только хеш). Отвязать там же.

Расписание (`.github/workflows/telegram.yml`, секрет `CRON_SECRET`): ежечасно
`POST /api/cron/telegram-sweep` (удаляет фото селфи из чата после решения или через 46 ч:
Telegram даёт ботам удалять сообщения только моложе 48 ч; чистит журнал отказов старше 90 дней)
и в 09:00 по Куала-Лумпуру `POST /api/cron/telegram-digest` (сводка за сутки).
