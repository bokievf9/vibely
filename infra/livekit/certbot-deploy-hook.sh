#!/bin/sh
# /etc/letsencrypt/renewal-hooks/deploy/vibely-livekit.sh
# After certbot renews rtc.vibelydate.com: copy the cert for LiveKit's TURN/TLS and restart it.
set -e
SRC=/etc/letsencrypt/live/rtc.vibelydate.com
DST=/opt/vibely-media/certs
install -d -m 750 "$DST"
install -m 644 "$SRC/fullchain.pem" "$DST/fullchain.pem"
install -m 640 "$SRC/privkey.pem" "$DST/privkey.pem"
docker compose -f /opt/vibely-media/docker-compose.yml restart livekit >/dev/null 2>&1 || true
