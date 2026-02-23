"""
Database Seeding Script
Imports nutritional data from CSV file into the foods table.

This script:
    1. Reads nutrizione_pulito.csv (192 foods)
    2. Parses nutritional values
    3. Inserts foods into database
    4. Handles duplicates (skip or update)

Usage:
    # From backend directory
    python -m app.db.seed

    # Or from Docker container
    docker-compose exec backend python -m app.db.seed

CSV Format:
    - Column 1: TIER (ignored)
    - Column 2: Alimento (food name)
    - Column 3: Categoria (category)
    - Columns 4+: Nutrients in grams per 100g
"""

import csv
import sys
from pathlib import Path
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal, engine
from app.models.base import BaseModel
from app.models.food import Food


# CSV file location (inside the app data folder)
CSV_PATH = Path(__file__).parent.parent.parent / "data" / "nutrizione_pulito.csv"


def parse_decimal(value: str) -> Optional[Decimal]:
    """
    Parse string to Decimal, handling empty/invalid values.

    Args:
        value: String value from CSV

    Returns:
        Decimal or None if empty/invalid

    Examples:
        parse_decimal("6.4") → Decimal("6.4")
        parse_decimal("") → None
        parse_decimal("N/A") → None
    """
    if not value or value.strip() == "":
        return None

    try:
        # Remove any whitespace and convert to Decimal
        return Decimal(value.strip())
    except (InvalidOperation, ValueError):
        # Return None for non-numeric values
        return None


def seed_foods(db: Session, csv_path: Path, skip_duplicates: bool = True) -> dict:
    """
    Import foods from CSV into database.

    Args:
        db: Database session
        csv_path: Path to CSV file
        skip_duplicates: If True, skip existing foods; if False, update them

    Returns:
        dict with statistics:
            - total: Total foods in CSV
            - inserted: Number of foods inserted
            - updated: Number of foods updated
            - skipped: Number of foods skipped
            - errors: Number of errors

    Raises:
        FileNotFoundError: If CSV file doesn't exist
        ValueError: If CSV format is invalid

    CSV Column Mapping:
        Column Index → Database Field
        1  → name (Alimento)
        2  → category (Categoria)
        3  → proteins_g (Proteine (g))
        5  → fats_g (Grassi (g))
        7  → carbs_g (Carboidrati (g))
        9  → fibers_g (Fibre (g))
        11 → omega3_ala_g (Omega-3 (ALA) (g))
        13 → omega6_g (Omega-6 (g))
        15 → calcium_g (Calcio (g))
        17 → iron_g (Ferro (g))
        19 → magnesium_g (Magnesio (g))
        21 → potassium_g (Potassio (g))
        23 → zinc_g (Zinco (g))
        25 → vitamin_a_g (Vitamina A (g))
        27 → vitamin_c_g (Vitamina C (g))
        29 → vitamin_d_g (Vitamina D (g))
        31 → vitamin_e_g (Vitamina E (g))
        33 → vitamin_k_g (Vitamina K (g))
        35 → vitamin_b6_g (Vitamina B6 (g))
        37 → folate_b9_g (Folati (B9) (g))
        39 → vitamin_b12_g (Vitamina B12 (g))
    """
    # Verify CSV file exists
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    print(f"Reading CSV from: {csv_path}")

    # Statistics
    stats = {
        "total": 0,
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": []
    }

    # Read CSV file
    with open(csv_path, "r", encoding="utf-8") as csvfile:
        reader = csv.reader(csvfile)

        # Skip header row
        header = next(reader)
        print(f"CSV columns: {len(header)}")

        # Process each row
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (1=header)
            stats["total"] += 1

            try:
                # Extract basic info (columns 1-2)
                if len(row) < 40:
                    msg = f"Riga {row_num}: colonne insufficienti ({len(row)} invece di 40)"
                    print(f"Row {row_num}: Insufficient columns ({len(row)}), skipping")
                    stats["errors"] += 1
                    stats["error_details"].append(msg)
                    continue

                name = row[1].strip()
                category = row[2].strip() if row[2] else None

                if not name:
                    msg = f"Riga {row_num}: nome alimento vuoto"
                    print(f"Row {row_num}: Empty name, skipping")
                    stats["errors"] += 1
                    stats["error_details"].append(msg)
                    continue

                # Extract nutrients (using column indexes from CSV)
                # Note: Column numbers are based on the CSV structure shown in the prompt
                food_data = {
                    "name": name,
                    "category": category,
                    # Macronutrients (columns 3, 5, 7, 9)
                    "proteins_g": parse_decimal(row[3]),  # Proteine (g)
                    "fats_g": parse_decimal(row[5]),      # Grassi (g)
                    "carbs_g": parse_decimal(row[7]),     # Carboidrati (g)
                    "fibers_g": parse_decimal(row[9]),    # Fibre (g)
                    # Essential fatty acids (columns 11, 13)
                    "omega3_ala_g": parse_decimal(row[11]),  # Omega-3 (ALA) (g)
                    "omega6_g": parse_decimal(row[13]),      # Omega-6 (g)
                    # Minerals (columns 15, 17, 19, 21, 23)
                    "calcium_g": parse_decimal(row[15]),     # Calcio (g)
                    "iron_g": parse_decimal(row[17]),        # Ferro (g)
                    "magnesium_g": parse_decimal(row[19]),   # Magnesio (g)
                    "potassium_g": parse_decimal(row[21]),   # Potassio (g)
                    "zinc_g": parse_decimal(row[23]),        # Zinco (g)
                    # Vitamins (columns 25, 27, 29, 31, 33, 35, 37, 39)
                    "vitamin_a_g": parse_decimal(row[25]),   # Vitamina A (g)
                    "vitamin_c_g": parse_decimal(row[27]),   # Vitamina C (g)
                    "vitamin_d_g": parse_decimal(row[29]),   # Vitamina D (g)
                    "vitamin_e_g": parse_decimal(row[31]),   # Vitamina E (g)
                    "vitamin_k_g": parse_decimal(row[33]),   # Vitamina K (g)
                    "vitamin_b6_g": parse_decimal(row[35]),  # Vitamina B6 (g)
                    "folate_b9_g": parse_decimal(row[37]),   # Folati (B9) (g)
                    "vitamin_b12_g": parse_decimal(row[39])  # Vitamina B12 (g)
                }

                # Check if food already exists
                existing_food = db.query(Food).filter(Food.name == name).first()

                if existing_food:
                    if skip_duplicates:
                        print(f"Row {row_num}: '{name}' already exists, skipping")
                        stats["skipped"] += 1
                        continue
                    else:
                        # Update existing food
                        for key, value in food_data.items():
                            if key != "name":  # Don't update name
                                setattr(existing_food, key, value)
                        db.commit()
                        print(f"Row {row_num}: '{name}' updated")
                        stats["updated"] += 1
                else:
                    # Insert new food
                    new_food = Food(**food_data)
                    db.add(new_food)
                    db.commit()
                    print(f"Row {row_num}: '{name}' inserted")
                    stats["inserted"] += 1

            except IntegrityError as e:
                db.rollback()
                msg = f"Riga {row_num} ('{name}'): errore integrita' DB - {e}"
                print(f"Row {row_num}: Database integrity error: {e}")
                stats["errors"] += 1
                stats["error_details"].append(msg)
            except Exception as e:
                db.rollback()
                msg = f"Riga {row_num}: errore imprevisto - {e}"
                print(f"Row {row_num}: Unexpected error: {e}")
                stats["errors"] += 1
                stats["error_details"].append(msg)

    return stats


def main():
    """
    Main function to run seeding script.

    Usage:
        python -m app.db.seed
    """
    print("=" * 60)
    print("Food Database Seeding Script")
    print("=" * 60)

    # Create database tables if they don't exist
    print("\nCreating database tables...")
    BaseModel.metadata.create_all(bind=engine)
    print("✓ Tables created")

    # Create database session
    db = SessionLocal()

    try:
        # Run seeding
        print(f"\nImporting foods from CSV: {CSV_PATH}")
        print("-" * 60)

        stats = seed_foods(db=db, csv_path=CSV_PATH, skip_duplicates=True)

        # Print summary
        print("-" * 60)
        print("\nSeeding Summary:")
        print(f"  Total rows in CSV:  {stats['total']}")
        print(f"  Foods inserted:     {stats['inserted']}")
        print(f"  Foods updated:      {stats['updated']}")
        print(f"  Foods skipped:      {stats['skipped']}")
        print(f"  Errors:             {stats['errors']}")
        print("=" * 60)

        if stats["errors"] > 0:
            print("\n⚠ WARNING: Some errors occurred during import")
            sys.exit(1)
        else:
            print("\n✓ Seeding completed successfully!")
            sys.exit(0)

    except FileNotFoundError as e:
        print(f"\n✗ ERROR: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()


# Alternative: Seed specific CSV file
# Usage:
#   python -m app.db.seed --csv /path/to/custom.csv
#
# if __name__ == "__main__":
#     import argparse
#     parser = argparse.ArgumentParser(description="Seed foods database from CSV")
#     parser.add_argument("--csv", type=Path, default=CSV_PATH, help="Path to CSV file")
#     parser.add_argument("--update", action="store_true", help="Update existing foods")
#     args = parser.parse_args()
#
#     db = SessionLocal()
#     try:
#         stats = seed_foods(db, args.csv, skip_duplicates=not args.update)
#         print(f"Imported: {stats['inserted']}, Updated: {stats['updated']}, Errors: {stats['errors']}")
#     finally:
#         db.close()
