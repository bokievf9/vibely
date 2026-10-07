# Деплой на VPS (vibelydate.com)

Схема: push в `main` → GitHub Actions (typecheck + lint) → SSH на VPS → `git reset` на `origin/main`
→ `npm ci` → `npm run build` → `pm2 restart vibely`.

## Один раз на сервере

```bash
# Node 22 LTS (Next 16 требует >= 20.9)
node -v
cd /var/www/vibely && git remote -v        # должен смотреть на GitHub-репозиторий

# Переменные окружения: только здесь, не в git. Нужны и при сборке (NEXT_PUBLIC_* вшиваются в бандл).
cat > /var/www/vibely/.env.production <<'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SECRET_KEY=<service_role / secret key>
NEXT_PUBLIC_SITE_URL=https://vibelydate.com
ENV
chmod 600 /var/www/vibely/.env.production

pm2 start ecosystem.config.cjs && pm2 save && pm2 startup   # если процесс vibely ещё не создан
```

Сборка Next 16 на дроплете с 1 ГБ RAM может упасть по памяти: workflow ограничивает heap до 1.5 ГБ,
на маленьком дроплете добавьте swap (`fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile`).

## GitHub → Settings → Secrets and variables → Actions

| Secret | Значение |
|---|---|
| `VPS_HOST` | `68.183.177.183` |
| `VPS_USER` | пользователь деплоя (лучше не root) |
| `VPS_SSH_KEY` | приватный ключ, чей публичный ключ в `~/.ssh/authorized_keys` этого пользователя |

## Nginx

Приложение слушает `127.0.0.1:3000`. Минимальный `location`:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

`www.vibelydate.com` лучше редиректить на `vibelydate.com` (301) в отдельном `server` блоке,
чтобы cookies сессии были на одном домене. Realtime идёт напрямую в Supabase, Nginx его не проксирует.

## Supabase Dashboard для прода

- Authentication → URL Configuration: Site URL `https://vibelydate.com`, Redirect URLs `https://vibelydate.com/**`.
- Authentication → Sign In / Providers → Phone: включить, SMS-провайдер Twilio. Email-регистрацию выключить.
- Authentication → Hooks → Before User Created → `public.hook_before_user_created` (только Малайзия).
- Realtime → Settings: выключить «Allow public access» (используются только private-каналы).
