# RECIPE_AI_NOTES.md

## Endpoint

```
POST /api/v1/recipes/generate
```

## Auth
Bearer token richiesto (`Authorization: Bearer <token>`).

---

## Request Body

```json
{
  "house_id": "uuid",
  "use_pantry": true,
  "constraints": "senza glutine, leggero",
  "servings": 4
}
```

| Campo        | Tipo    | Default | Descrizione                                    |
|------------- |---------|---------|------------------------------------------------|
| `house_id`   | UUID    | —       | ID della casa (obbligatorio)                   |
| `use_pantry` | bool    | `true`  | Se true, include nomi dispensa nel prompt      |
| `constraints`| string  | `""`    | Vincoli liberi (dieta, allergeni, stile…)      |
| `servings`   | int     | `2`     | Numero di porzioni desiderate                  |

---

## Response (200 OK)

Il body è il JSON generato dal modello, tipicamente:

```json
{
  "name": "Pasta con pollo e verdure",
  "description": "Piatto semplice e bilanciato",
  "preparation_time_min": 30,
  "difficulty": "easy",
  "procedure": "1. Cuoci la pasta...\n2. ...",
  "tags": ["veloce", "proteico"],
  "ingredients": [
    { "food_name": "Pasta", "quantity": 320, "unit": "g" },
    { "food_name": "Petto di pollo", "quantity": 400, "unit": "g" }
  ]
}
```

> Il JSON viene estratto e parsato server-side. Il frontend riceve un dict puro, non wrappato.

---

## Error Codes

| Status | Motivo                                                         |
|--------|----------------------------------------------------------------|
| 403    | Utente non membro della casa                                   |
| 404    | Casa non trovata                                               |
| 503    | LLM non configurato → vai in Impostazioni > LLM               |
| 503    | LLM ha restituito risposta vuota (retry)                       |
| 422    | LLM ha restituito JSON non valido (retry o cambia modello)     |

---

## Note Implementative

### File
- **Endpoint**: `app/api/v1/recipe_ai.py`
- **Router incluso in**: `app/api/v1/router.py` con `prefix="/recipes"`, **prima** del router `recipes.router` per evitare conflitti di path matching.

### LLM
- Usa `LLMPurpose.CHAT` con fallback `GENERAL`.
- Le connessioni vengono caricate da `house.settings["llm_connections"]` al runtime (stesso pattern di `meal_planner.py`).
- Il client viene istanziato tramite `get_llm_manager()` → `get_client_for_purpose()`.

### Prompt
- Sistema: assistente culinario, risponde SOLO JSON.
- Utente: elenco ingredienti dispensa (se `use_pantry=True`), vincoli, porzioni + struttura JSON attesa.
- `max_tokens=1024` per avere procedure complete.

### Parsing
- Il server strappa eventuali fence markdown (` ```json ... ``` `) prima di `json.loads`.
- In caso di `JSONDecodeError` → HTTP 422.

### Dispensa query
- Filtra `DispensaItem` per `house_id` + `is_consumed == False`.
- Restituisce solo il campo `name` (no quantità, per semplicità del prompt).
