#!/bin/bash

# ====== CONFIG ======
DOMAIN=$1
PORT=$2

if [ -z "$DOMAIN" ] || [ -z "$PORT" ]; then
  echo "Usage: bash setup_reverse_proxy.sh <domain> <port>"
  exit 1
fi

echo "🚀 Setting up Nginx reverse proxy for $DOMAIN on port $PORT"

# ====== UPDATE & INSTALL NGINX ======
# Ensure nginx is installed (skip if already present to save time)
if ! command -v nginx &> /dev/null; then
    sudo apt update -y
    sudo apt install -y nginx
fi

# ====== CREATE NGINX CONFIG FILE ======
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root /var/www/aiassistant-frontend;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }
}
EOF

# ====== ENABLE SITE ======
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
# Test config before reloading to prevent crashing Nginx
sudo nginx -t && sudo systemctl reload nginx

# ====== INSTALL CERTBOT ======
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
fi

# ====== APPLY SSL ======
# Check if certificate already exists to avoid rate limits
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect
else
    echo "⚠️ SSL certificate for $DOMAIN already exists. Skipping Certbot."
fi

echo "✅ Nginx reverse proxy + SSL setup completed for https://$DOMAIN"
