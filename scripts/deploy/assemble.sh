#!/usr/bin/env bash
# Turns a finished `npm run build` into a self-contained release directory (Next.js standalone).
#   scripts/deploy/assemble.sh <out-dir>
set -euo pipefail
OUT="${1:?usage: assemble.sh <out-dir>}"
test -f .next/standalone/server.js || { echo "Run npm run build first (output: 'standalone')"; exit 1; }
rm -rf "$OUT" && mkdir -p "$OUT/.next"
cp -R .next/standalone/. "$OUT/"
cp -R .next/static "$OUT/.next/static"
# The standalone output may already contain public/ (files traced by the build, e.g. the OG
# image reads public/landing/og-discover-<locale>.png). `cp -R public "$OUT/public"` would then nest it
# as public/public and every static file (icons, sw.js, landing media) would 404. Merge instead.
mkdir -p "$OUT/public" && cp -R public/. "$OUT/public/"
test -f "$OUT/public/sw.js" && test ! -e "$OUT/public/public" || { echo "public/ was not assembled correctly"; exit 1; }
cp ecosystem.config.cjs scripts/deploy/activate.sh "$OUT/"
# Ops helper run on the server (docs/deploy.md, Telegram bot); dependency-free.
mkdir -p "$OUT/scripts/telegram" && cp scripts/telegram/set-webhook.mjs "$OUT/scripts/telegram/"
git rev-parse HEAD > "$OUT/REVISION" 2>/dev/null || true
# Env files never ship inside a release; the server reads shared/.env.production.
find "$OUT" -maxdepth 1 -name '.env*' -delete
echo "Release assembled in $OUT ($(du -sh "$OUT" | cut -f1))"
