#!/usr/bin/env bash
# Runs on the VPS as `deploy`: switches /var/www/vibely/current to a release, restarts PM2,
# health-checks it and rolls back automatically if the new release doesn't come up.
#   /var/www/vibely/releases/<id>/activate.sh <id>
set -euo pipefail
APP=/var/www/vibely
NEW="$APP/releases/${1:?usage: activate.sh <release-id>}"
KEEP=5
test -f "$NEW/server.js" || { echo "No server.js in $NEW"; exit 1; }
test -f "$APP/shared/.env.production" || { echo "Missing $APP/shared/.env.production"; exit 1; }

PREV=$(readlink -f "$APP/current" 2>/dev/null || true)
switch_to() {
  ln -sfn "$1" "$APP/current.tmp" && mv -T "$APP/current.tmp" "$APP/current"
  # Recreate the process if it was started from another path (e.g. the old in-place layout).
  if pm2 jlist | grep -q "\"pm_exec_path\":\"$APP/current/server.js\""; then
    pm2 restart vibely --update-env >/dev/null
  else
    pm2 delete vibely >/dev/null 2>&1 || true
    pm2 start "$APP/current/ecosystem.config.cjs" >/dev/null
  fi
}
healthy() {
  for _ in $(seq 1 20); do
    curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

switch_to "$NEW"
if healthy; then
  pm2 save >/dev/null
  echo "Live: $(basename "$NEW")"
else
  echo "Health check failed for $(basename "$NEW")"
  pm2 logs vibely --lines 30 --nostream || true
  if [ -n "$PREV" ] && [ -f "$PREV/server.js" ]; then
    echo "Rolling back to $(basename "$PREV")"
    switch_to "$PREV" && healthy && pm2 save >/dev/null
  fi
  exit 1
fi

# Keep the newest $KEEP releases (never the live one).
ls -1dt "$APP"/releases/*/ | tail -n +$((KEEP + 1)) | while read -r dir; do
  [ "$(readlink -f "$dir")" = "$(readlink -f "$APP/current")" ] || rm -rf "$dir"
done
