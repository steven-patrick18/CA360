#!/usr/bin/env bash
#
# CA360 — point a domain at this server and switch to HTTPS.
# Run AFTER install.sh, once your DNS A record points at this server's IP.
#
# Usage:
#     sudo bash setup-domain.sh ca360.your-firm.in
#

set -euo pipefail

DOMAIN="${1:-}"
[ "$EUID" = 0 ] || { echo "Run with sudo"; exit 1; }
[ -n "$DOMAIN" ] || { echo "Usage: sudo bash setup-domain.sh <domain>"; exit 1; }

echo "==> Installing certbot…"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx

echo "==> Updating Nginx site to use ${DOMAIN}…"
sed -i -E "s|server_name .*;|server_name ${DOMAIN};|" /etc/nginx/sites-available/ca360
nginx -t
systemctl reload nginx

echo "==> Requesting Let's Encrypt certificate…"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect

echo "==> Updating backend FRONTEND_URL to https://${DOMAIN}…"
ENV_FILE=/home/ca360/ca360/backend/.env
[ -f "$ENV_FILE" ] || ENV_FILE="$(find / -path '*/backend/.env' 2>/dev/null | head -1)"
if [ -f "$ENV_FILE" ]; then
  sed -i -E "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|" "$ENV_FILE"
  systemctl restart ca360-api
fi

echo
echo "Done. Open https://${DOMAIN} in a browser."
echo "Auto-renewal is handled by certbot's systemd timer; verify with:"
echo "    systemctl status certbot.timer"
