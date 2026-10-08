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
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MODERATORS_CHAT_ID`.
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
