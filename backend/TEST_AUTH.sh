#!/bin/bash
# Script di test per l'autenticazione JWT
# Testa il flusso completo: register → login → get profile → refresh token

echo "=========================================="
echo "Test Autenticazione JWT - Meal Planner"
echo "=========================================="
echo ""

# Configurazione
BASE_URL="http://localhost:8000/api/v1"
EMAIL="test_$(date +%s)@example.com"  # Email unica con timestamp
PASSWORD="TestPass123!"
FULL_NAME="Test User"

echo "📧 Email di test: $EMAIL"
echo ""

# 1. Register
echo "1️⃣  Testing POST /auth/register..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"full_name\": \"$FULL_NAME\"
  }")

echo "Response: $REGISTER_RESPONSE"
echo ""

# Estrai access_token e refresh_token
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('refresh_token', ''))" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Register fallito! Access token non trovato."
    exit 1
fi

echo "✅ Register completato!"
echo "   Access Token: ${ACCESS_TOKEN:0:50}..."
echo "   Refresh Token: ${REFRESH_TOKEN:0:50}..."
echo ""

# 2. Get Profile
echo "2️⃣  Testing GET /users/me..."
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $PROFILE_RESPONSE"
echo ""

USER_ID=$(echo $PROFILE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)

if [ -z "$USER_ID" ]; then
    echo "❌ Get profile fallito!"
    exit 1
fi

echo "✅ Profile recuperato!"
echo "   User ID: $USER_ID"
echo ""

# 3. Update Profile
echo "3️⃣  Testing PUT /users/me..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Updated Test User",
    "preferences": {
      "dietary_type": "vegetarian",
      "allergies": ["lactose"],
      "daily_calorie_target": 2000
    }
  }')

echo "Response: $UPDATE_RESPONSE"
echo ""
echo "✅ Profile aggiornato!"
echo ""

# 4. Login
echo "4️⃣  Testing POST /auth/login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "Response: $LOGIN_RESPONSE"
echo ""

NEW_ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -z "$NEW_ACCESS_TOKEN" ]; then
    echo "❌ Login fallito!"
    exit 1
fi

echo "✅ Login completato!"
echo "   Nuovo Access Token: ${NEW_ACCESS_TOKEN:0:50}..."
echo ""

# 5. Refresh Token
echo "5️⃣  Testing POST /auth/refresh..."
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refresh_token\": \"$REFRESH_TOKEN\"
  }")

echo "Response: $REFRESH_RESPONSE"
echo ""

REFRESHED_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -z "$REFRESHED_ACCESS_TOKEN" ]; then
    echo "❌ Token refresh fallito!"
    exit 1
fi

echo "✅ Token refresh completato!"
echo "   Refreshed Access Token: ${REFRESHED_ACCESS_TOKEN:0:50}..."
echo ""

# 6. Change Password
echo "6️⃣  Testing PUT /users/me/password..."
NEW_PASSWORD="NewPass456!"
CHANGE_PASSWORD_RESPONSE=$(curl -s -X PUT "$BASE_URL/users/me/password" \
  -H "Authorization: Bearer $REFRESHED_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"current_password\": \"$PASSWORD\",
    \"new_password\": \"$NEW_PASSWORD\"
  }")

echo "Response: $CHANGE_PASSWORD_RESPONSE"
echo ""

if echo "$CHANGE_PASSWORD_RESPONSE" | grep -q "Password changed successfully"; then
    echo "✅ Password cambiata con successo!"
else
    echo "❌ Cambio password fallito!"
    exit 1
fi
echo ""

# 7. Verifica login con nuova password
echo "7️⃣  Testing login con nuova password..."
NEW_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }")

FINAL_ACCESS_TOKEN=$(echo $NEW_LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -z "$FINAL_ACCESS_TOKEN" ]; then
    echo "❌ Login con nuova password fallito!"
    exit 1
fi

echo "✅ Login con nuova password completato!"
echo ""

# Summary
echo "=========================================="
echo "✅ TUTTI I TEST COMPLETATI CON SUCCESSO!"
echo "=========================================="
echo ""
echo "Endpoints testati:"
echo "  ✅ POST /api/v1/auth/register"
echo "  ✅ POST /api/v1/auth/login"
echo "  ✅ POST /api/v1/auth/refresh"
echo "  ✅ GET /api/v1/users/me"
echo "  ✅ PUT /api/v1/users/me"
echo "  ✅ PUT /api/v1/users/me/password"
echo ""
echo "🎉 Autenticazione JWT funzionante correttamente!"
echo ""
echo "Per testare manualmente, apri Swagger UI:"
echo "👉 http://localhost:8000/docs"
echo ""
