#!/usr/bin/env python3
"""
Script one-shot: linka dispensa_items esistenti al product_catalog tramite barcode.
Esegui dal container backend oppure con python3 app/scripts/link_product_catalog.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.session import engine
from sqlalchemy import text

def main():
    with engine.connect() as conn:
        result = conn.execute(text("""
            UPDATE dispensa_items di
            SET product_catalog_id = pb.product_id
            FROM product_barcodes pb
            WHERE di.barcode = pb.barcode
              AND di.product_catalog_id IS NULL
              AND di.barcode IS NOT NULL
              AND di.barcode != ''
        """))
        conn.commit()
        print(f'Updated {result.rowcount} dispensa_items with product_catalog_id')

if __name__ == '__main__':
    main()
