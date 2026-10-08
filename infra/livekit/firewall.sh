#!/usr/bin/env bash
# Firewall of the media droplet (docs/calls.md). Run once as root after provisioning.
# Mirror the same rules in a DigitalOcean Cloud Firewall attached to the droplet.
set -euo pipefail

ufw default deny incoming
ufw default allow outgoing

ufw allow 22/tcp comment 'SSH (better: restrict to your IP)'
ufw allow 80/tcp comment 'ACME HTTP-01 (Lets Encrypt) for Caddy'
ufw allow 443/tcp comment 'HTTPS/WSS rtc.vibelydate.com + TURN/TLS turn.vibelydate.com (Caddy SNI)'
ufw allow 443/udp comment 'TURN/UDP (LiveKit built-in TURN)'
ufw allow 7881/tcp comment 'WebRTC ICE over TCP'
ufw allow 50000:60000/udp comment 'WebRTC media (RTP/RTCP)'

# Never expose: 7880 (LiveKit API, behind Caddy), 5349 (TURN/TLS behind Caddy), 6379 (Redis),
# 9090 (egress health). They listen on 127.0.0.1 only; deny explicitly anyway.
for port in 7880 5349 6379 9090; do ufw deny "$port"; done

ufw --force enable
ufw status verbose
