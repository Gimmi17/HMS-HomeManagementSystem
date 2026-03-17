# MEAL_STOCK_NOTES.md

## Endpoint Routes Create

### Meal Stock
| Method | Path | Descrizione |
|--------|------|-------------|
| `GET`  | `/api/v1/meals/{meal_id}/recipe-stock-preview?house_id=<uuid>&portion_multiplier=1.0` | Anteprima senza modificare la dispensa |
| `POST` | `/api/v1/meals/{meal_id}/consume-recipe-stock` | Decrementa la dispensa (FEFO) |

### Product Search
| Method | Path | Descrizione |
|--------|------|-------------|
| `GET`  | `/api/v1/products/search?house_id=<uuid>&q=<testo>&limit=20` | Cerca prodotti nel catalogo |

---

## File Coinvolti

| Modifica | File |
|----------|------|
| **Nuovo** | `app/api/v1/meal_stock.py` |
| **Modificato** | `app/api/v1/products.py` (aggiunto GET /products/search) |
| **Modificato** | `app/models/dispensa.py` (aggiunta colonna `product_catalog_id`) |
| **Modificato** | `app/schemas/recipe.py` (aggiunti `product_id`, `product_name` a `RecipeIngredient`) |
| **Modificato** | `app/services/nutrition.py` (supporto `product_id` in `calculate_primary_macros`) |
| **Modificato** | `app/services/dispensa_service.py` (risolve `product_catalog_id` in `create_item`) |
| **Modificato** | `app/api/v1/router.py` (registrati `meal_stock_router`) |

### Modelli usati in meal_stock.py
- `app/models/meal.py` → `class Meal`
- `app/models/recipe.py` → `class Recipe`
- `app/models/dispensa.py` → `class DispensaItem`

---

## Chiamate API dal Frontend

### Preview stock (dry-run)
```
GET /api/v1/meals/{meal_id}/recipe-stock-preview
  ?house_id=<uuid>
  &portion_multiplier=1.5   # opzionale, default 1.0

Risposta 200:
{
  "consumed": [
    {
      "product_id": "uuid",
      "product_name": "Pasta Barilla",
      "quantity": 320.0,
      "unit": "g",
      "available_in_pantry": 500.0,
      "will_be_available": 180.0,
      "warning": null
    }
  ],
  "warnings": []
}
```

### Consuma stock
```
POST /api/v1/meals/{meal_id}/consume-recipe-stock
Content-Type: application/json
{
  "house_id": "uuid",
  "portion_multiplier": 1.0
}

Risposta 200: stessa struttura di preview
```

### Cerca prodotti nel catalogo
```
GET /api/v1/products/search?house_id=<uuid>&q=pasta&limit=20

Risposta 200:
[
  {
    "id": "uuid",
    "name": "Pasta Barilla Spaghetti",
    "brand": "Barilla",
    "barcode": "8076800105228",
    "unit": "500g",
    "energy_kcal": 351.0,
    "proteins_g": 13.0,
    "carbs_g": 70.0,
    "fats_g": 1.5
  }
]
```

---

## product_catalog_id nel DB

### Stato
- Colonna **già presente** in `dispensa_items` (ALTER TABLE no-op con IF NOT EXISTS).
- Indice `idx_dispensa_product_catalog` creato.

### Come viene popolata
1. **Da barcode** — `DispensaService.create_item()` cerca `ProductBarcode.barcode == data.barcode`, se trovato imposta `product_catalog_id = pb.product_id`.
2. **Da shopping list** — `send_from_shopping_list` chiama `create_item` per ogni item, quindi la risoluzione è automatica se il barcode è valorizzato.
3. **Item manuali senza barcode** — `product_catalog_id` rimane `NULL`.

### Backfill items esistenti (opzionale)
```sql
UPDATE dispensa_items di
SET product_catalog_id = pb.product_id
FROM product_barcodes pb
WHERE di.barcode = pb.barcode
  AND di.product_catalog_id IS NULL;
```

---

## Logica FEFO in consume-recipe-stock
Gli item dispensa vengono consumati in ordine di scadenza più prossima (`expiry_date ASC NULLS LAST`):
- Se `remaining >= item.quantity` → `item.is_consumed = True`
- Altrimenti → `item.quantity -= remaining`

Se il totale disponibile è inferiore al fabbisogno, viene aggiunto un warning ma l'operazione prosegue comunque (consuma il disponibile).

---

## Integrazione con Nutrition (A4)
`calculate_primary_macros` ora gestisce entrambi i percorsi:
- `product_id` presente → dati da `ProductCatalog` (usa `energy_kcal` diretto se disponibile)
- `food_id` presente → dati da `Food` (comportamento originale)
- Nessuno dei due → ingrediente saltato
