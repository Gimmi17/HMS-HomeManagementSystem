# Branch: gestione-anagrafiche

## Panoramica

Questo branch implementa il sistema di **Gestione Anagrafiche** per HMS (Home Management System), permettendo agli amministratori di gestire centralmente i dati master dell'applicazione: utenti, case, alimenti e prodotti del catalogo.

---

## Funzionalità Implementate

### 1. Sistema Anagrafiche (Master Data Management)

#### 1.1 Struttura Navigazione
- Nuova sezione "Anagrafiche" nel menu drawer laterale
- Pagina hub `/anagrafiche` con navigazione alle sottosezioni
- Accesso riservato agli amministratori (role-based)

#### 1.2 Gestione Utenti (`/anagrafiche/users`)
- Lista utenti con ricerca
- Creazione nuovo utente (email, password, nome, ruolo)
- Modifica utente esistente
- Eliminazione utente
- Visualizzazione stato recovery setup

#### 1.3 Gestione Case (`/anagrafiche/houses`)
- Lista case con ricerca
- Creazione nuova casa (nome, descrizione, location, owner)
- Modifica casa esistente
- Eliminazione casa
- Visualizzazione conteggio membri

#### 1.4 Gestione Alimenti (`/anagrafiche/foods`)
- Lista alimenti con ricerca e filtro per categoria
- Paginazione server-side
- Visualizzazione macronutrienti (proteine, grassi, carboidrati, fibre)
- Creazione/modifica alimento con tutti i dati nutrizionali:
  - Macronutrienti
  - Acidi grassi essenziali (Omega-3, Omega-6)
  - Minerali (calcio, ferro, magnesio, potassio, zinco)
  - Vitamine (A, C, D, E, K, B6, B9, B12)

#### 1.5 Gestione Prodotti/Catalogo (`/anagrafiche/products`)
- Lista prodotti con ricerca
- Filtro per categoria (ProductCategoryTag)
- Filtro per certificazione (Tutti/Certificati/Non certificati)
- Visualizzazione dettagli in modal con scroll verticale
- Dati nutrizionali completi per 100g:
  - Energia (kcal)
  - Proteine, Carboidrati, Zuccheri
  - Grassi, Grassi saturi
  - Fibre, Sale
  - Nutriscore, Ecoscore, Nova Group
- Soft delete (annullamento) invece di eliminazione fisica
- Distinzione visiva prodotti non certificati (bordo ambra, badge)

---

### 2. Sistema Categorie Prodotti (ProductCategoryTag)

#### 2.1 Modello Dati
Nuova tabella `product_category_tags` per normalizzare le categorie OpenFoodFacts:
- `id`: UUID primary key
- `tag_id`: identificatore univoco da OpenFoodFacts (es. "en:beverages")
- `name`: nome human-readable (es. "Beverages")
- `lang`: lingua del tag (es. "en", "it")
- `parent_id`: riferimento a categoria padre (per gerarchia futura)

#### 2.2 Relazione Many-to-Many
Tabella associativa `product_category_associations`:
- Collega `ProductCatalog` a `ProductCategoryTag`
- Un prodotto può avere multiple categorie
- Una categoria può essere associata a più prodotti

#### 2.3 Parsing Automatico
Durante l'enrichment da OpenFoodFacts:
- Estrae `categories_tags` (lista di tag ID strutturati)
- Fallback su `categories` (stringa comma-separated)
- Crea automaticamente nuovi tag se non esistenti
- Collega i tag al prodotto

#### 2.4 API Categorie
- `GET /anagrafiche/product-categories`: lista categorie con conteggio prodotti
- Filtri: search, lang, min_products
- Paginazione: limit, offset

---

### 3. Gestione Prodotti Non Certificati

#### 3.1 Definizione
Prodotti "non certificati" sono quelli:
- Scansionati durante il controllo carico
- Non trovati nel database OpenFoodFacts
- Salvati con `source = "not_found"`

#### 3.2 Visualizzazione
- Distinzione visiva nella lista prodotti:
  - Bordo e sfondo color ambra
  - Badge "Non certificato"
- Nel dettaglio modal:
  - Banner di avviso giallo
  - Messaggio esplicativo
- Display intelligente:
  - Se ha nome: mostra nome + barcode sotto
  - Se senza nome: mostra barcode come titolo (font monospace)

#### 3.3 Filtro Certificazione
Dropdown con tre opzioni:
- **Tutti**: mostra tutti i prodotti
- **Certificati**: solo prodotti da OpenFoodFacts (`source != "not_found"`)
- **Non certificati**: solo prodotti non trovati (`source == "not_found"`)

---

### 4. Nome Prodotti Non Certificati da Utente

#### 4.1 Problema
Quando un prodotto non viene trovato in OpenFoodFacts, viene creato un record con solo il barcode, senza nome. Nel catalogo appariva "Senza nome".

#### 4.2 Soluzione Implementata
Il nome fornito dall'utente durante il controllo carico viene salvato nel ProductCatalog:

**Flow:**
1. Utente scansiona barcode durante verifica
2. Prodotto non trovato in OFF → utente inserisce nome manualmente
3. Nome salvato in `ShoppingListItem.grocy_product_name`
4. Nome propagato a `ProductCatalog.name` se entry è "not_found"

**Punti di integrazione:**
- `verify_item_with_quantity`: aggiorna ProductCatalog esistente
- `add_extra_item`: aggiorna ProductCatalog esistente
- `enrich_product_async`: usa nome da ShoppingListItem quando crea entry "not_found"
- `enrich_product_async`: aggiorna entry esistenti "not_found" senza nome

#### 4.3 Recupero Nomi da Scontrini (Batch)

Funzionalità per recuperare i nomi dei prodotti non certificati cercando negli "scontrini" (shopping list items) storici.

**Bottone "Recupera Nomi"** (arancione) nella pagina Catalogo Prodotti:
1. Cerca tutti i prodotti `source='not_found'` senza nome
2. Per ogni prodotto, cerca gli scontrini con lo stesso EAN (`scanned_barcode`)
3. Raccoglie le descrizioni distinte (`grocy_product_name` o `name`)
4. Prodotti con 1 sola descrizione → aggiornamento automatico
5. Prodotti con descrizioni multiple → modal per scegliere

**API Endpoints:**
- `GET /anagrafiche/products/unnamed-with-descriptions` - Lista prodotti senza nome con descrizioni disponibili
- `PUT /anagrafiche/products/{id}/set-name` - Imposta il nome di un prodotto

**Modal di selezione:**
- Mostra barcode del prodotto
- Lista delle descrizioni trovate come bottoni cliccabili
- Opzioni: seleziona, salta, annulla tutto
- Contatore progresso (es. "2 di 5")

---

### 5. Soft Delete Prodotti

#### 5.1 Modello
Nuovo campo in `ProductCatalog`:
```python
cancelled = Column(Boolean, default=False, nullable=False, index=True)
```

#### 5.2 Comportamento
- I prodotti "annullati" non appaiono nella lista
- Query filtra automaticamente: `ProductCatalog.cancelled == False`
- DELETE endpoint imposta `cancelled = True` invece di eliminare

---

## File Creati

### Backend
| File | Descrizione |
|------|-------------|
| `backend/app/api/v1/anagrafiche.py` | API endpoints per tutte le anagrafiche |
| `backend/app/api/v1/product_nutrition.py` | API per dati nutrizionali dettagliati |
| `backend/app/models/product_category_tag.py` | Modello ProductCategoryTag + associazione |
| `backend/app/models/product_nutrition.py` | Modello ProductNutrition |
| `backend/app/services/product_nutrition_service.py` | Service per fetch/save nutrition data |

### Frontend
| File | Descrizione |
|------|-------------|
| `frontend/src/pages/Anagrafiche.tsx` | Hub navigazione anagrafiche |
| `frontend/src/pages/AnagraficheUsers.tsx` | Gestione utenti |
| `frontend/src/pages/AnagraficheHouses.tsx` | Gestione case |
| `frontend/src/pages/AnagraficheFoods.tsx` | Gestione alimenti |
| `frontend/src/pages/AnagraficheProducts.tsx` | Gestione prodotti/catalogo |
| `frontend/src/services/anagrafiche.ts` | Service API per anagrafiche |

---

## File Modificati

### Backend

| File | Modifiche |
|------|-----------|
| `backend/app/api/v1/router.py` | Aggiunto router anagrafiche |
| `backend/app/api/v1/shopping_lists.py` | Propagazione nome a ProductCatalog |
| `backend/app/api/v1/admin.py` | COLUMN_DEFAULTS per import, nuove tabelle |
| `backend/app/api/v1/categories.py` | Aggiunto filtro house_id |
| `backend/app/api/v1/foods.py` | Aggiunto filtro house_id, paginazione |
| `backend/app/api/v1/stores.py` | Aggiunto filtro house_id |
| `backend/app/models/__init__.py` | Export nuovi modelli |
| `backend/app/models/product_catalog.py` | Aggiunto cancelled, category_tags |
| `backend/app/models/category.py` | Aggiunto house_id |
| `backend/app/models/food.py` | Aggiunto house_id |
| `backend/app/models/store.py` | Aggiunto house_id |
| `backend/app/integrations/openfoodfacts.py` | Aggiunto categories_tags |
| `backend/app/services/product_enrichment.py` | Parsing categorie, nome utente |
| `backend/app/schemas/category.py` | Aggiunto house_id |
| `backend/app/schemas/food.py` | Aggiunto house_id |
| `backend/app/schemas/store.py` | Aggiunto house_id |

### Frontend

| File | Modifiche |
|------|-----------|
| `frontend/src/App.tsx` | Route anagrafiche |
| `frontend/src/components/Layout/DrawerMenu.tsx` | Link anagrafiche nel menu |
| `frontend/src/pages/index.ts` | Export nuove pagine |
| `frontend/src/services/categories.ts` | Parametro house_id |
| `frontend/src/services/foods.ts` | Parametro house_id, paginazione |
| `frontend/src/services/stores.ts` | Parametro house_id |
| `frontend/src/types/index.ts` | Nuovi tipi per anagrafiche |
| `frontend/src/pages/Categories.tsx` | Uso house_id |
| `frontend/src/pages/Stores.tsx` | Uso house_id |
| `frontend/src/pages/Settings.tsx` | Fix import |
| `frontend/src/pages/Pantry.tsx` | Vista aggregata giacenze |
| `frontend/src/pages/LoadVerification.tsx` | Input nome prodotto |
| `frontend/src/pages/ShoppingListDetail.tsx` | Fix servizi |
| `frontend/src/pages/ShoppingListForm.tsx` | Fix servizi |
| Componenti IngredientSearch | Fix servizi foods |

---

## API Endpoints Aggiunti

### Anagrafiche Users
```
GET    /api/v1/anagrafiche/users
POST   /api/v1/anagrafiche/users
PUT    /api/v1/anagrafiche/users/{user_id}
DELETE /api/v1/anagrafiche/users/{user_id}
```

### Anagrafiche Houses
```
GET    /api/v1/anagrafiche/houses
POST   /api/v1/anagrafiche/houses
PUT    /api/v1/anagrafiche/houses/{house_id}
DELETE /api/v1/anagrafiche/houses/{house_id}
```

### Anagrafiche Foods
```
GET    /api/v1/anagrafiche/foods
GET    /api/v1/anagrafiche/foods/{food_id}
POST   /api/v1/anagrafiche/foods
PUT    /api/v1/anagrafiche/foods/{food_id}
DELETE /api/v1/anagrafiche/foods/{food_id}
```

### Anagrafiche Products
```
GET    /api/v1/anagrafiche/products
POST   /api/v1/anagrafiche/products
PUT    /api/v1/anagrafiche/products/{product_id}
DELETE /api/v1/anagrafiche/products/{product_id}  (soft delete)
GET    /api/v1/anagrafiche/products/unnamed-with-descriptions
PUT    /api/v1/anagrafiche/products/{product_id}/set-name
```

### Product Categories
```
GET    /api/v1/anagrafiche/product-categories
GET    /api/v1/anagrafiche/product-categories/{category_id}
```

### Migration Utilities
```
GET    /api/v1/anagrafiche/migration/orphan-stats
POST   /api/v1/anagrafiche/migration/link-to-house/{house_id}
```

---

## Schema Database

### Nuove Tabelle

```sql
-- Categorie prodotti normalizzate
CREATE TABLE product_category_tags (
    id UUID PRIMARY KEY,
    tag_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    lang VARCHAR(10),
    parent_id UUID REFERENCES product_category_tags(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Associazione prodotti-categorie
CREATE TABLE product_category_associations (
    product_id UUID REFERENCES product_catalog(id),
    category_tag_id UUID REFERENCES product_category_tags(id),
    PRIMARY KEY (product_id, category_tag_id)
);

-- Dati nutrizionali dettagliati (opzionale)
CREATE TABLE product_nutrition (
    id UUID PRIMARY KEY,
    product_id UUID REFERENCES product_catalog(id),
    -- ... campi nutrizionali dettagliati
);
```

### Modifiche Tabelle Esistenti

```sql
-- product_catalog
ALTER TABLE product_catalog ADD COLUMN cancelled BOOLEAN DEFAULT FALSE;

-- categories, foods, stores
ALTER TABLE categories ADD COLUMN house_id UUID REFERENCES houses(id);
ALTER TABLE foods ADD COLUMN house_id UUID REFERENCES houses(id);
ALTER TABLE stores ADD COLUMN house_id UUID REFERENCES houses(id);
```

---

## Note Tecniche

### Perché Soft Delete per i Prodotti
- I prodotti potrebbero essere referenziati da shopping list items storici
- Permette eventuale ripristino
- Mantiene integrità referenziale

### Perché Categorie Normalizzate
- OpenFoodFacts usa un sistema di tag gerarchico
- Normalizzazione permette filtri efficienti
- Prepara per futura navigazione gerarchica delle categorie

### Multi-tenancy (house_id)
- Categories, Foods, Stores sono ora legati a una casa specifica
- Permette dati personalizzati per ogni nucleo familiare
- Orphan data (senza house_id) può essere migrato con endpoint dedicato

---

---

## Procedura di Migrazione

### Prerequisiti
- Accesso admin all'applicazione
- Backup dei dati esistenti

### Passi

#### 1. Esporta i dati (vecchia versione)
```
Impostazioni > Database > Esporta Database
```
Salva il file `.sql` generato.

#### 2. Merge del branch
```bash
git checkout main
git merge gestione-anagrafiche
```

#### 3. Riavvia il container
```bash
docker-compose down
docker-compose up -d --build
```
Le nuove tabelle vengono create automaticamente da `create_all()`.

#### 4. Importa i dati
```
Impostazioni > Database > Importa Database
```
Carica il file `.sql` salvato al passo 1.

Il sistema gestisce automaticamente:
- **Colonne mancanti**: vengono aggiunte con valori di default
- **Nuove tabelle**: i dati esistenti vengono importati, le nuove tabelle restano vuote
- **Conflitti**: `ON CONFLICT DO NOTHING` evita duplicati

#### 5. (Opzionale) Esegui script SQL
Se ci sono errori, esegui manualmente:
```
Impostazioni > Database > Console SQL
```
Copia/incolla il contenuto di `docs/MIGRATION_v2_gestione-anagrafiche.sql`.

### Valori di Default per Campi Mancanti

| Tabella | Campo | Default |
|---------|-------|---------|
| `product_catalog` | `cancelled` | `FALSE` |
| `product_catalog` | `house_id` | `NULL` |
| `categories` | `house_id` | `NULL` |
| `foods` | `house_id` | `NULL` |
| `stores` | `house_id` | `NULL` |
| `dispensa_items` | `source_item_id` | `NULL` |

### Verifica Post-Migrazione

Esegui nella Console SQL:
```sql
SELECT 'product_catalog' as tabella, COUNT(*) as records FROM product_catalog;
SELECT 'product_category_tags' as tabella, COUNT(*) as records FROM product_category_tags;
SELECT 'product_nutrition' as tabella, COUNT(*) as records FROM product_nutrition;
```

---

## TODO / Futuri Sviluppi

- [ ] Gerarchia categorie prodotti (parent_id)
- [ ] Navigazione breadcrumb categorie
- [ ] Import/Export dati anagrafiche
- [ ] Audit log modifiche
- [ ] Bulk operations (eliminazione multipla)
- [ ] Merge prodotti duplicati
