-- ============================================================
-- MIGRATION SCRIPT: gestione-anagrafiche (v2)
-- ============================================================
--
-- Questo script prepara il database per la nuova versione.
-- Eseguire PRIMA di fare il merge del branch o DOPO l'import dei dati.
--
-- ISTRUZIONI:
-- 1. Esporta i dati dalla vecchia versione (Impostazioni > Esporta Database)
-- 2. Fai il merge del branch gestione-anagrafiche in main
-- 3. Riavvia il container (le nuove tabelle vengono create automaticamente)
-- 4. Importa i dati (Impostazioni > Importa Database)
-- 5. [OPZIONALE] Esegui questo script se ci sono errori
--
-- Lo script e' idempotente: puo' essere eseguito piu' volte senza problemi.
-- ============================================================

-- ============================================================
-- PARTE 1: NUOVE COLONNE SU TABELLE ESISTENTI
-- ============================================================

-- ProductCatalog: soft delete flag
ALTER TABLE product_catalog
ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT FALSE;

-- Crea indice se non esiste
CREATE INDEX IF NOT EXISTS ix_product_catalog_cancelled
ON product_catalog(cancelled);

-- ProductCatalog: local category (assigned by user)
ALTER TABLE product_catalog
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_product_catalog_category_id
ON product_catalog(category_id);

-- Categories: multi-tenancy
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES houses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_categories_house_id
ON categories(house_id);

-- Foods: multi-tenancy
ALTER TABLE foods
ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES houses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_foods_house_id
ON foods(house_id);

-- Stores: multi-tenancy
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES houses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_stores_house_id
ON stores(house_id);

-- DispensaItems: link to shopping list source
ALTER TABLE dispensa_items
ADD COLUMN IF NOT EXISTS source_item_id UUID REFERENCES shopping_list_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_dispensa_items_source_item_id
ON dispensa_items(source_item_id);

-- ============================================================
-- PARTE 2: NUOVE TABELLE (create automaticamente da SQLAlchemy)
-- ============================================================
-- Le seguenti tabelle vengono create automaticamente al primo avvio:
-- - product_category_tags
-- - product_category_associations
-- - product_nutrition
--
-- Se per qualche motivo non esistono, crearle manualmente:

-- Product Category Tags (categorie normalizzate da OpenFoodFacts)
CREATE TABLE IF NOT EXISTS product_category_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    lang VARCHAR(10),
    parent_id UUID REFERENCES product_category_tags(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_product_category_tags_tag_id
ON product_category_tags(tag_id);

CREATE INDEX IF NOT EXISTS ix_product_category_tags_lang
ON product_category_tags(lang);

CREATE INDEX IF NOT EXISTS ix_product_category_tags_parent_id
ON product_category_tags(parent_id);

-- Product Category Associations (many-to-many)
CREATE TABLE IF NOT EXISTS product_category_associations (
    product_id UUID REFERENCES product_catalog(id) ON DELETE CASCADE,
    category_tag_id UUID REFERENCES product_category_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_tag_id)
);

-- Product Nutrition (dati nutrizionali dettagliati)
CREATE TABLE IF NOT EXISTS product_nutrition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE REFERENCES product_catalog(id) ON DELETE CASCADE,

    -- Product info
    product_name VARCHAR(500),
    brands VARCHAR(500),
    quantity VARCHAR(100),
    serving_size VARCHAR(100),
    categories TEXT,
    ingredients_text TEXT,
    allergens TEXT,
    traces TEXT,
    labels TEXT,
    origins TEXT,
    packaging TEXT,

    -- Scores
    nutriscore_grade VARCHAR(1),
    ecoscore_grade VARCHAR(10),
    nova_group INTEGER,
    nutrition_score_fr INTEGER,

    -- Basic nutrients (per 100g)
    energy_kcal FLOAT,
    energy_kj FLOAT,
    fat FLOAT,
    saturated_fat FLOAT,
    carbohydrates FLOAT,
    sugars FLOAT,
    added_sugars FLOAT,
    starch FLOAT,
    fiber FLOAT,
    proteins FLOAT,
    salt FLOAT,
    sodium FLOAT,

    -- Minerals (per 100g)
    calcium FLOAT,
    iron FLOAT,
    magnesium FLOAT,
    manganese FLOAT,
    phosphorus FLOAT,
    potassium FLOAT,
    copper FLOAT,
    selenium FLOAT,
    zinc FLOAT,

    -- Vitamins (per 100g)
    vitamin_a FLOAT,
    vitamin_b1 FLOAT,
    vitamin_b2 FLOAT,
    vitamin_b6 FLOAT,
    vitamin_b9 FLOAT,
    vitamin_b12 FLOAT,
    vitamin_c FLOAT,
    vitamin_d FLOAT,
    vitamin_e FLOAT,
    vitamin_k FLOAT,

    -- Other
    caffeine FLOAT,
    choline FLOAT,
    fruits_vegetables_nuts FLOAT,

    -- Raw data
    raw_nutriments JSON,
    raw_api_response JSON,

    -- Metadata
    source VARCHAR(50) DEFAULT 'openfoodfacts',
    fetched_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_product_nutrition_product_id
ON product_nutrition(product_id);

-- ============================================================
-- PARTE 3: SANAMENTO DATI (post-import)
-- ============================================================

-- Imposta cancelled=FALSE per tutti i prodotti esistenti senza valore
UPDATE product_catalog
SET cancelled = FALSE
WHERE cancelled IS NULL;

-- ============================================================
-- VERIFICA
-- ============================================================
-- Esegui queste query per verificare che la migrazione sia andata a buon fine:

-- SELECT 'product_catalog.cancelled' as campo, COUNT(*) as records FROM product_catalog WHERE cancelled IS NOT NULL;
-- SELECT 'categories.house_id' as campo, COUNT(*) as records FROM categories;
-- SELECT 'foods.house_id' as campo, COUNT(*) as records FROM foods;
-- SELECT 'stores.house_id' as campo, COUNT(*) as records FROM stores;
-- SELECT 'product_category_tags' as tabella, COUNT(*) as records FROM product_category_tags;
-- SELECT 'product_nutrition' as tabella, COUNT(*) as records FROM product_nutrition;

-- ============================================================
-- FINE MIGRATION SCRIPT
-- ============================================================
