#!/bin/bash
# Script to generate self-signed SSL certificates for local development

SSL_DIR="./ssl"
DAYS_VALID=365

# Create ssl directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate self-signed certificate
openssl req -x509 -nodes -days $DAYS_VALID -newkey rsa:2048 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/C=IT/ST=Italy/L=Local/O=MealPlanner/CN=meal-planner.local" \
  -addext "subjectAltName=DNS:localhost,DNS:meal-planner.local,IP:127.0.0.1,IP:192.168.1.52,IP:192.168.1.1,IP:192.168.1.100,IP:192.168.0.1,IP:192.168.0.100,IP:10.0.0.1,IP:10.0.0.100"

echo "SSL certificates generated in $SSL_DIR/"
echo "- fullchain.pem (certificate)"
echo "- privkey.pem (private key)"
echo ""
echo "Note: You may need to add more IP addresses to the subjectAltName if your local IP is different."
echo "Edit this script and add your IP to the list, then run again."
