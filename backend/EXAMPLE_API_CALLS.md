# API Example Calls - Foods & Health

This document provides example API calls for testing the Foods and Health endpoints.

## Prerequisites

```bash
# 1. Start the backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2. Seed the foods database
python -m app.db.seed

# 3. Get test user_id and house_id from database or create via /auth/register
```

---

## Foods API

### Search Foods (Autocomplete)

```bash
# Search for "pollo" (chicken)
curl -X GET "http://localhost:8000/api/v1/foods?search=pollo&limit=10" \
  -H "accept: application/json"
```

**Response:**
```json
{
  "foods": [
    {
      "id": "uuid",
      "name": "Pollo petto",
      "category": "Carne",
      "proteins_g": 23.0,
      "fats_g": 1.2,
      "carbs_g": 0.0,
      "fibers_g": 0.0
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### Search by Category

```bash
# Get all vegetables
curl -X GET "http://localhost:8000/api/v1/foods?category=Verdura&limit=20" \
  -H "accept: application/json"
```

### Get Food Categories

```bash
# Get list of all unique categories
curl -X GET "http://localhost:8000/api/v1/foods/categories" \
  -H "accept: application/json"
```

**Response:**
```json
{
  "categories": [
    "Carne",
    "Cereali",
    "Frutta",
    "Latticini",
    "Legumi",
    "Pesce",
    "Verdura"
  ]
}
```

### Get Food Details

```bash
# Get complete nutritional profile for specific food
curl -X GET "http://localhost:8000/api/v1/foods/{food_id}" \
  -H "accept: application/json"
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Spinaci",
  "category": "Verdura",
  "proteins_g": 2.9,
  "fats_g": 0.4,
  "carbs_g": 3.6,
  "fibers_g": 2.2,
  "omega3_ala_g": 0.000138,
  "omega6_g": 0.000026,
  "calcium_g": 0.099,
  "iron_g": 0.0027,
  "magnesium_g": 0.000079,
  "potassium_g": 0.558,
  "zinc_g": 0.000053,
  "vitamin_a_g": 0.000469,
  "vitamin_c_g": 0.028,
  "vitamin_d_g": 0.0,
  "vitamin_e_g": 0.002,
  "vitamin_k_g": 0.000483,
  "vitamin_b6_g": 0.000195,
  "folate_b9_g": 0.000194,
  "vitamin_b12_g": 0.0,
  "created_at": "2024-01-13T22:00:00Z"
}
```

---

## Health API - Weights

### Create Weight Measurement

```bash
# Record weight
curl -X POST "http://localhost:8000/api/v1/weights?house_id=YOUR_HOUSE_ID&user_id=YOUR_USER_ID" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "weight_kg": 75.5,
    "measured_at": "2024-01-13T08:00:00Z",
    "notes": "Morning weight after workout"
  }'
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "house_id": "uuid",
  "weight_kg": 75.5,
  "measured_at": "2024-01-13T08:00:00Z",
  "notes": "Morning weight after workout",
  "created_at": "2024-01-13T08:05:00Z",
  "updated_at": "2024-01-13T08:05:00Z"
}
```

### List Weight Measurements

```bash
# Get all weights for a user
curl -X GET "http://localhost:8000/api/v1/weights?house_id=YOUR_HOUSE_ID&user_id=YOUR_USER_ID&limit=50" \
  -H "accept: application/json"
```

**Response:**
```json
{
  "weights": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "house_id": "uuid",
      "weight_kg": 75.5,
      "measured_at": "2024-01-13T08:00:00Z",
      "notes": "Morning weight",
      "created_at": "2024-01-13T08:05:00Z",
      "updated_at": "2024-01-13T08:05:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### List Weights with Date Range

```bash
# Get weights from January 2024
curl -X GET "http://localhost:8000/api/v1/weights?house_id=YOUR_HOUSE_ID&user_id=YOUR_USER_ID&from_date=2024-01-01T00:00:00Z&to_date=2024-01-31T23:59:59Z" \
  -H "accept: application/json"
```

### Update Weight

```bash
# Update weight notes
curl -X PUT "http://localhost:8000/api/v1/weights/{weight_id}?house_id=YOUR_HOUSE_ID" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated: before breakfast"
  }'
```

### Delete Weight

```bash
# Delete weight measurement
curl -X DELETE "http://localhost:8000/api/v1/weights/{weight_id}?house_id=YOUR_HOUSE_ID" \
  -H "accept: application/json"
```

**Response:** 204 No Content

---

## Health API - Health Records

### Create Health Record

```bash
# Log a headache
curl -X POST "http://localhost:8000/api/v1/health?house_id=YOUR_HOUSE_ID&user_id=YOUR_USER_ID" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "headache",
    "description": "Severe headache with light sensitivity, started after lunch",
    "severity": "moderate",
    "recorded_at": "2024-01-13T14:30:00Z"
  }'
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "house_id": "uuid",
  "type": "headache",
  "description": "Severe headache with light sensitivity, started after lunch",
  "severity": "moderate",
  "recorded_at": "2024-01-13T14:30:00Z",
  "created_at": "2024-01-13T14:35:00Z",
  "updated_at": "2024-01-13T14:35:00Z"
}
```

### List Health Records

```bash
# Get all health records for a user
curl -X GET "http://localhost:8000/api/v1/health?house_id=YOUR_HOUSE_ID&user_id=YOUR_USER_ID&limit=50" \
  -H "accept: application/json"
```

### Filter by Type and Severity

```bash
# Get moderate headaches
curl -X GET "http://localhost:8000/api/v1/health?house_id=YOUR_HOUSE_ID&user_id=YOUR_USER_ID&type=headache&severity=moderate" \
  -H "accept: application/json"
```

### Filter by Date Range

```bash
# Get health events from last 30 days
curl -X GET "http://localhost:8000/api/v1/health?house_id=YOUR_HOUSE_ID&from_date=2024-01-01T00:00:00Z&to_date=2024-01-31T23:59:59Z" \
  -H "accept: application/json"
```

### Update Health Record

```bash
# Update severity
curl -X PUT "http://localhost:8000/api/v1/health/{record_id}?house_id=YOUR_HOUSE_ID" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "mild",
    "description": "Headache improved after rest"
  }'
```

### Delete Health Record

```bash
# Delete health record
curl -X DELETE "http://localhost:8000/api/v1/health/{record_id}?house_id=YOUR_HOUSE_ID" \
  -H "accept: application/json"
```

**Response:** 204 No Content

---

## Python Examples

### Search Foods in Python

```python
import requests

# Search for chicken
response = requests.get(
    "http://localhost:8000/api/v1/foods",
    params={
        "search": "pollo",
        "limit": 10
    }
)

foods = response.json()
print(f"Found {foods['total']} foods:")
for food in foods['foods']:
    print(f"  - {food['name']} ({food['category']}): {food['proteins_g']}g protein")
```

### Track Weight in Python

```python
import requests
from datetime import datetime

# Create weight measurement
response = requests.post(
    "http://localhost:8000/api/v1/weights",
    params={
        "house_id": "your-house-uuid",
        "user_id": "your-user-uuid"
    },
    json={
        "weight_kg": 75.5,
        "measured_at": datetime.now().isoformat(),
        "notes": "Morning weight"
    }
)

weight = response.json()
print(f"Weight recorded: {weight['weight_kg']} kg")
```

### Log Health Event in Python

```python
import requests
from datetime import datetime

# Log headache
response = requests.post(
    "http://localhost:8000/api/v1/health",
    params={
        "house_id": "your-house-uuid",
        "user_id": "your-user-uuid"
    },
    json={
        "type": "headache",
        "description": "Severe headache after lunch",
        "severity": "moderate",
        "recorded_at": datetime.now().isoformat()
    }
)

record = response.json()
print(f"Health event logged: {record['type']} ({record['severity']})")
```

---

## JavaScript/TypeScript Examples

### Search Foods in Frontend

```typescript
// TypeScript example for React frontend
async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const response = await fetch(
    `http://localhost:8000/api/v1/foods?search=${encodeURIComponent(query)}&limit=10`
  );
  const data = await response.json();
  return data.foods;
}

// Usage in autocomplete component
const foods = await searchFoods("pollo");
console.log(foods); // Display in dropdown
```

### Create Weight Measurement

```typescript
interface WeightCreate {
  weight_kg: number;
  measured_at: string;
  notes?: string;
}

async function createWeight(
  houseId: string,
  userId: string,
  data: WeightCreate
): Promise<WeightResponse> {
  const response = await fetch(
    `http://localhost:8000/api/v1/weights?house_id=${houseId}&user_id=${userId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }
  );
  return response.json();
}

// Usage
const weight = await createWeight(houseId, userId, {
  weight_kg: 75.5,
  measured_at: new Date().toISOString(),
  notes: "Morning weight"
});
```

### List Weight History

```typescript
async function getWeightHistory(
  houseId: string,
  userId: string,
  limit: number = 30
): Promise<WeightResponse[]> {
  const response = await fetch(
    `http://localhost:8000/api/v1/weights?house_id=${houseId}&user_id=${userId}&limit=${limit}`
  );
  const data = await response.json();
  return data.weights;
}

// Usage for chart
const weights = await getWeightHistory(houseId, userId);
const chartData = weights.map(w => ({
  date: new Date(w.measured_at),
  weight: w.weight_kg
}));
```

---

## Testing with Swagger UI

1. Open browser: `http://localhost:8000/docs`
2. Navigate to "Foods" section
3. Click "Try it out" on any endpoint
4. Fill in parameters
5. Click "Execute"
6. View response

Example test flow:
1. GET /foods/categories → Get list of categories
2. GET /foods?category=Verdura → Get all vegetables
3. GET /foods/{id} → Get detailed nutritional info
4. POST /weights → Record weight
5. GET /weights → View weight history
6. POST /health → Log health event
7. GET /health?type=headache → Filter headaches

---

## Common Query Parameters

### Pagination
- `limit`: Number of results (default: 100, max: 500)
- `offset`: Skip N results (default: 0)

### Date Filters
- `from_date`: ISO 8601 datetime (e.g., "2024-01-01T00:00:00Z")
- `to_date`: ISO 8601 datetime (e.g., "2024-01-31T23:59:59Z")

### Security
- `house_id`: Required for multi-tenant isolation
- `user_id`: Required for POST operations (TODO: infer from JWT)

---

## Error Responses

### 404 Not Found
```json
{
  "detail": "Food with id xxx not found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "severity"],
      "msg": "Severity must be one of: mild, moderate, severe. Got: invalid",
      "type": "value_error"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Next Steps

1. **Authentication**: Add JWT tokens to requests
2. **Frontend Integration**: Use these examples in React components
3. **Analytics**: Add trend analysis endpoints
4. **Notifications**: Alert on significant weight changes or health patterns
