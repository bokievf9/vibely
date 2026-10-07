# Project: Vibely (vibelydate.com)

## Infrastructure & Environment
- **Domain**: https://vibelydate.com (and www.vibelydate.com)
- **VPS**: DigitalOcean Ubuntu 24.04 LTS (Singapore Region, IP: 68.183.177.183)
- **Web Server**: Nginx (Reverse Proxy with Certbot SSL enabled)
- **Process Manager**: PM2
- **Tech Stack**: Next.js (App Router), Supabase (Auth, Database, Storage), Tailwind CSS
- **Deployment Strategy**: Automated via GitHub Actions on push to `main` branch.

## Deployment Commands
- App Directory on VPS: `/var/www/vibely`
- Build Command: `npm run build`
- PM2 Service Name: `vibely`
- PM2 Restart Command: `pm2 restart vibely`

## Guidelines for Claude Code
- Keep code mobile-first (PWA targeting Malaysian market).
- Use Supabase SSR client for Next.js.
- Ensure all production environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are properly referenced.
