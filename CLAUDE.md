# Project: Vibely (vibelydate.com)

## Infrastructure & Environment
- **Domain**: https://vibelydate.com (and www.vibelydate.com)
- **VPS**: DigitalOcean Ubuntu 24.04 LTS (Singapore Region, IP: 68.183.177.183)
- **Web Server**: Nginx (Reverse Proxy with Certbot SSL enabled)
- **Process Manager**: PM2
- **Tech Stack**: Next.js (App Router), Supabase (Auth, Database, Storage), Tailwind CSS
- **Deployment Strategy**: Automated via GitHub Actions on push to `main` branch (details: `docs/deploy.md`).

## Deployment
- Pipeline: checks (typecheck, lint, `npm run test:sql`, `npm run test:unit`) → `npm run build` in CI
  (`output: 'standalone'`) → release uploaded to the VPS → `activate.sh` switches the `current`
  symlink, restarts PM2, health-checks `/api/health` and rolls back automatically on failure.
  The VPS never builds.
- App Directory on VPS: `/var/www/vibely` (user `deploy`, not root)
  - `current` → live release, `releases/<timestamp>-<sha>/` (last 5 kept)
  - `shared/.env.production` → server-only secrets (never inside a release, never in git)
- PM2 Service Name: `vibely` (config: `ecosystem.config.cjs`, runs `current/server.js` on 127.0.0.1:3000)
- Manual rollback: `ln -sfn /var/www/vibely/releases/<id> /var/www/vibely/current && pm2 restart vibely`
- Build-time public values come from GitHub Actions **variables** (`NEXT_PUBLIC_*`);
  SSH access from **secrets** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`.
- Database changes: add a migration in `supabase/migrations/`, cover it in `tests/sql/behavior.test.mjs`,
  apply with `supabase db push`.

## Safety rules for production data
- Never run tests or scripts that create, modify or delete accounts against the production Supabase
  project unless they verify first that every account they touch was created by that same run.
- Fake test accounts are tagged `app_metadata.seed = 'fake'`: `npm run fake:seed` / `npm run fake:delete`.

## Safety recording & data retention (project protocol)
- **Everything that happens in Vibely is recorded and stored for safety**: chat messages, random chat,
  photos/voice/video messages, feed content, and **all audio and video calls** (recorded server-side).
- **Retention: up to 90 days**, then deleted automatically (scheduled purge of DB rows and storage
  objects). Exception: material attached to an open report or moderation case is kept until the case
  is resolved.
- **Users must always be told**, in en/ms/ru: in the Terms and Privacy Policy, in the sign-up consent,
  before enabling calls in a chat, and with a visible "This call is recorded" indicator during a call.
  Never record silently. Legal texts need review by a Malaysian lawyer (PDPA) before launch.
- **Access**: recordings and media live in private storage only (signed URLs, short TTL). Only
  moderators may open them, only while handling a report, and every access is logged in
  `public.moderation_actions`.
- **Exception, verification selfies in Telegram** (decided by the owner, 2026-10-09): when
  `TELEGRAM_SEND_SELFIES=true`, a selfie and up to 3 profile photos are uploaded (never as links)
  to the private moderators group with `protect_content`, deleted from the chat right after the
  decision or within 46 h at the latest, and every send/delete is logged. Only linked moderators
  (`admins.telegram_user_id`) can act. Disclosed in the Privacy Policy (sections 3 and 7).
- **Moderator roles**: viewer < moderator < admin < owner (`admins.role`). Every moderation RPC
  checks the role in the database (`assert_admin_role`) and logs to `moderation_actions`, including
  read access (selfies, phone numbers, transcripts, media). Moderators ban for at most 7 days;
  permanent bans and unbans need admin.
- **Storage plan**: Supabase free tier (1 GB) for now; the plan will be upgraded at launch. Keep media
  compact (duration limits, compression) until then.

## Guidelines for Claude Code
- Keep code mobile-first (PWA targeting Malaysian market).
- Use Supabase SSR client for Next.js.
- Ensure all production environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are properly referenced.
