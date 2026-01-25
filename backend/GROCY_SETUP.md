# Grocy Integration Setup Guide

Quick guide to configure and test Grocy API integration.

---

## Configuration

### 1. Get Grocy API Key

In your Grocy instance:

1. Go to **Settings** (gear icon)
2. Navigate to **API Keys**
3. Click **Create new API key**
4. Copy the generated key

### 2. Configure Environment

Edit `.env` file:

```bash
# Grocy instance URL (no trailing slash)
GROCY_URL=http://your-grocy-host:9283

# API key from Grocy settings
GROCY_API_KEY=your-api-key-here
```

**Examples**:
```bash
# Docker Compose (service name)
GROCY_URL=http://grocy:9283

# Local network
GROCY_URL=http://192.168.1.100:9283

# Remote instance with HTTPS
GROCY_URL=https://grocy.yourdomain.com
```

---

## Testing

### Quick Test Script

Run the included test script:

```bash
cd backend
python3 test_grocy_integration.py
```

Expected output (without Grocy):
```
⚠️  GROCY_URL not configured - testing graceful degradation
✅ get_stock() returned empty list (expected)
✅ get_products() returned empty list (expected)
✅ Graceful degradation working correctly!
```

Expected output (with Grocy):
```
Testing Grocy API connection...
1. Testing get_stock()...
   ✅ Success! Found 15 items in stock
2. Testing get_products()...
   ✅ Success! Found 42 products
3. Testing get_product(1)...
   ✅ Success! Product: Milk 1L
✅ All tests passed! Grocy integration working correctly.
```

### Manual API Testing

Start the backend server:

```bash
cd backend
uvicorn app.main:app --reload
```

Test endpoints with curl:

```bash
# Get stock
curl http://localhost:8000/api/v1/grocy/stock

# Get products
curl http://localhost:8000/api/v1/grocy/products

# Get specific product
curl http://localhost:8000/api/v1/grocy/products/1
```

### Swagger UI

Open browser: http://localhost:8000/docs

Navigate to **Grocy Integration** section and test endpoints interactively.

---

## Troubleshooting

### Issue: Empty response `[]`

**Cause**: Grocy not configured or not reachable

**Solution**:
1. Check `GROCY_URL` in `.env` is correct
2. Verify Grocy is running: `curl http://grocy-host:9283/api/stock`
3. Check API key is valid

### Issue: HTTP 503 Service Unavailable

**Cause**: Grocy configured but unreachable

**Solutions**:
1. Verify network connectivity
2. Check firewall rules
3. Ensure Grocy port is exposed
4. Test direct access: `curl -H "GROCY-API-KEY: your-key" http://grocy-host:9283/api/stock`

### Issue: HTTP 401 Unauthorized

**Cause**: Invalid API key

**Solution**:
1. Regenerate API key in Grocy settings
2. Update `GROCY_API_KEY` in `.env`
3. Restart backend

### Issue: Timeout after 10 seconds

**Cause**: Grocy responding slowly

**Solutions**:
1. Check Grocy instance performance
2. Increase timeout in `app/integrations/grocy.py`:
   ```python
   async with httpx.AsyncClient(timeout=30.0) as client:
   ```

---

## API Documentation

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/grocy/stock` | GET | List products in stock with quantities |
| `/api/v1/grocy/products` | GET | List all products in database |
| `/api/v1/grocy/products/{id}` | GET | Get specific product details |

### Response Examples

**GET /api/v1/grocy/stock**:
```json
[
    {
        "product_id": 1,
        "product_name": "Milk 1L",
        "quantity": 2.5,
        "unit": "L",
        "best_before_date": "2026-01-20"
    },
    {
        "product_id": 2,
        "product_name": "Pasta",
        "quantity": 1.0,
        "unit": "kg",
        "best_before_date": null
    }
]
```

**GET /api/v1/grocy/products**:
```json
[
    {
        "id": 1,
        "name": "Milk 1L",
        "description": "Fresh whole milk",
        "barcode": "1234567890123",
        "qu_id_stock": 5,
        "location_id": 2
    }
]
```

---

## Docker Compose Setup

Example `docker-compose.yml` configuration:

```yaml
services:
  backend:
    build: ./backend
    environment:
      GROCY_URL: http://grocy:9283
      GROCY_API_KEY: ${GROCY_API_KEY}
    networks:
      - meal-network

  grocy:
    image: linuxserver/grocy:latest
    ports:
      - "9283:80"
    networks:
      - meal-network
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Rome

networks:
  meal-network:
    driver: bridge
```

Then in `.env`:
```bash
GROCY_API_KEY=your-actual-key-here
```

---

## Graceful Degradation

The integration is **optional**. If Grocy is not configured:

- ✅ Application starts normally
- ✅ Endpoints return empty lists `[]`
- ✅ No errors or warnings
- ✅ Other features work normally

This allows:
- Development without Grocy
- Testing without external dependencies
- Deployment flexibility (optional feature)

---

## Security Notes

1. **Never commit** `.env` with real API keys
2. **Use HTTPS** for remote Grocy instances
3. **Restrict API key** scope in Grocy (read-only sufficient)
4. **Firewall rules** should limit Grocy access to backend only

---

## Future Enhancements (Phase 2+)

- Redis caching for stock data
- Product-to-food mapping
- Write operations (consume stock)
- Webhook integration for real-time updates
- MQTT notifications on stock changes

---

For detailed technical documentation, see `GROCY_INTEGRATION.md`.
