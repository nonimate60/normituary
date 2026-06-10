#!/usr/bin/env bash
# ====================================================================
# normituary — proxy setup for the VPS (Ubuntu 24, DigitalOcean)
# Usage:
#   scp normies-proxy.conf setup-proxy.sh root@142.93.51.73:/root/
#   ssh root@142.93.51.73 'bash /root/setup-proxy.sh'
# Idempotent: safe to run again after editing the conf.
# ====================================================================
set -euo pipefail

CONF_SRC="/root/normies-proxy.conf"
CONF_DST="/etc/nginx/sites-available/normies-proxy.conf"
CACHE_DIR="/var/cache/nginx/normies"
PORT=8080

echo "==> [1/6] installing nginx (if missing)"
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y nginx
fi

echo "==> [2/6] cache directory"
mkdir -p "$CACHE_DIR"
chown -R www-data:www-data "$CACHE_DIR"

echo "==> [3/6] installing site config"
[ -f "$CONF_SRC" ] || { echo "ERROR: $CONF_SRC not found (scp it first)"; exit 1; }
cp "$CONF_SRC" "$CONF_DST"
ln -sf "$CONF_DST" /etc/nginx/sites-enabled/normies-proxy.conf

echo "==> [4/6] validating and reloading nginx"
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> [5/6] firewall (ufw, if active)"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow ${PORT}/tcp || true
fi

echo "==> [6/6] smoke tests"
sleep 1
echo "--- health:"
curl -s "http://127.0.0.1:${PORT}/proxy-health"
echo "--- stats (1st hit = MISS):"
curl -s -o /dev/null -w "HTTP %{http_code} | X-Cache-Status: %{header_x-cache-status}\n" \
  "http://127.0.0.1:${PORT}/history/stats" || true
echo "--- stats (2nd hit = HIT):"
curl -s -o /dev/null -w "HTTP %{http_code} | X-Cache-Status: %{header_x-cache-status}\n" \
  "http://127.0.0.1:${PORT}/history/stats" || true
echo "--- burned image (cached forever after 1st hit):"
curl -s -o /dev/null -w "HTTP %{http_code} | X-Cache-Status: %{header_x-cache-status}\n" \
  "http://127.0.0.1:${PORT}/history/burned/100/image.svg" || true

echo ""
echo "DONE. Proxy live at:  http://142.93.51.73:${PORT}"
echo "Try from outside:     curl http://142.93.51.73:${PORT}/history/stats"
echo ""
echo "NEXT (for HTTPS, needed when the site itself runs on https):"
echo "  1. point a subdomain (e.g. normies.yourdomain.com) at 142.93.51.73"
echo "  2. edit ${CONF_DST}: listen 80; server_name normies.yourdomain.com;"
echo "  3. apt install certbot python3-certbot-nginx && certbot --nginx -d normies.yourdomain.com"
