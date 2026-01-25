# Database Seeding

This directory contains database initialization and seeding scripts.

## Seed Script

The `seed.py` script imports nutritional data from CSV into the foods table.

### Usage

#### Local Development
```bash
# From backend directory
cd /Users/gimmidefranceschi/HomeLab/food/meal-planner/backend
python -m app.db.seed
```

#### Docker Container
```bash
# From project root
docker-compose exec backend python -m app.db.seed
```

### CSV File

The script reads from: `/Users/gimmidefranceschi/HomeLab/food/nutrizione_pulito.csv`

**Expected format:**
- Column 1: TIER (ignored)
- Column 2: Alimento (food name)
- Column 3: Categoria (category)
- Columns 4+: Nutritional values (see column mapping in seed.py)

**Total foods:** 192 items with complete nutritional data

### What it does

1. Reads nutrizione_pulito.csv
2. Parses nutritional values (macros, minerals, vitamins)
3. Inserts foods into database
4. Skips duplicates by default (based on food name)
5. Reports statistics (inserted, skipped, errors)

### Options

- **Skip duplicates (default):** Existing foods are skipped
- **Update mode:** Set `skip_duplicates=False` in code to update existing foods

### Database Tables Created

- `foods` - Nutritional database (192 foods)

All food values are stored **per 100g** for accurate calculations when adding ingredients to recipes.

### Troubleshooting

**Error: CSV file not found**
- Check that nutrizione_pulito.csv exists at the specified path
- Verify the path in seed.py matches your environment

**Error: Database connection failed**
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env file
- Verify database credentials

**Error: Duplicate key violation**
- This means a food with the same name already exists
- Run with update mode to overwrite existing data
- Or manually delete duplicate foods from database

### After Seeding

Check imported foods:
```bash
# PostgreSQL query
SELECT COUNT(*) FROM foods;
SELECT category, COUNT(*) FROM foods GROUP BY category;
```

Expected categories:
- Carne
- Cereali
- Frutta
- Latticini
- Legumi
- Pesce
- Verdura
