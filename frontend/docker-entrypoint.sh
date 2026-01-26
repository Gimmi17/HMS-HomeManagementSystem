#!/bin/sh
set -e

# Check if SSL certificates exist
if [ -f "/etc/nginx/ssl/fullchain.pem" ] && [ -f "/etc/nginx/ssl/privkey.pem" ]; then
    echo "SSL certificates found, using HTTPS configuration"
    cp /etc/nginx/nginx-ssl.conf /etc/nginx/conf.d/default.conf
else
    echo "SSL certificates not found, using HTTP-only configuration"
    cp /etc/nginx/nginx-http-only.conf /etc/nginx/conf.d/default.conf
fi

# Start nginx
exec nginx -g "daemon off;"
