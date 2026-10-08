#!/usr/bin/env bash
# Extra firewall rules for calls on the web droplet (docs/calls.md). Run once as root.
# The existing rules for the web app (OpenSSH, "Nginx Full" = 80/443 tcp) stay untouched.
set -euo pipefail

ufw allow 443/udp comment 'TURN/UDP (LiveKit built-in TURN)'
ufw allow 5349/tcp comment 'TURN/TLS (LiveKit)'
ufw allow 7881/tcp comment 'WebRTC ICE over TCP'
ufw allow 50000:60000/udp comment 'WebRTC media (RTP/RTCP)'

# Never expose: 7880 (LiveKit API, behind Nginx), 6379 (Redis), 9090 (egress health).
# They listen on 127.0.0.1 only; deny explicitly anyway.
for port in 7880 6379 9090; do ufw deny "$port"; done

ufw status verbose
