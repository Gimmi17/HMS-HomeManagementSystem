"""
Admin API Endpoints
Administrative endpoints for database management.
One-shot import functionality for database migration.
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
import enum
import re
import logging
import json

from pathlib import Path

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/admin")


# Default values for NOT NULL columns missing from old backups.
# Maps table_name -> {column_name: default_sql_value}
COLUMN_DEFAULTS = {
    "users": {
        "has_recovery_setup": "FALSE",
        "recovery_pin_hash": "NULL",
        "role": "'basic'",
        "preferences": "'{}'",
    },
    "categories": {
        "house_id": "NULL",
    },
    "stores": {
        "house_id": "NULL",
    },
    "foods": {
        "house_id": "NULL",
    },
    "product_catalog": {
        "house_id": "NULL",
        "cancelled": "FALSE",  # Soft delete flag (v2 - gestione-anagrafiche)
        "category_id": "NULL",  # Local category (v2 - gestione-anagrafiche)
    },
    "dispensa_items": {
        "source_item_id": "NULL",  # Link to shopping list item (v2 - dispensa sync)
    },
}


def patch_insert_defaults(stmt: str, db_inspector) -> str:
    """
    Patch INSERT statements to add missing NOT NULL columns with defaults.

    If the INSERT targets a table in COLUMN_DEFAULTS and is missing columns
    that are NOT NULL, inject the column + default value.
    """
    # Match: INSERT INTO "table" (cols) VALUES (vals) ...
    match = re.match(
        r'^INSERT\s+INTO\s+"(\w+)"\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)\s*(ON\s+CONFLICT.*)?;?\s*$',
        stmt,
        re.IGNORECASE | re.DOTALL
    )
    if not match:
        return stmt

    table_name = match.group(1)
    if table_name not in COLUMN_DEFAULTS:
        return stmt

    existing_cols_raw = match.group(2)
    values_raw = match.group(3)
    on_conflict = match.group(4) or ""

    existing_cols = [c.strip().strip('"') for c in existing_cols_raw.split(',')]

    added_cols = []
    added_vals = []
    for col, default_val in COLUMN_DEFAULTS[table_name].items():
        if col not in existing_cols:
            # Verify the column actually exists in the DB table
            try:
                db_columns = {c['name'] for c in db_inspector.get_columns(table_name)}
                if col in db_columns:
                    added_cols.append(col)
                    added_vals.append(default_val)
            except Exception:
                pass

    if not added_cols:
        return stmt

    new_cols = existing_cols_raw + ', ' + ', '.join(f'"{c}"' for c in added_cols)
    new_vals = values_raw + ', ' + ', '.join(added_vals)
    suffix = f" {on_conflict}" if on_conflict else ""

    return f'INSERT INTO "{table_name}" ({new_cols}) VALUES ({new_vals}){suffix};'


# Table dependency order for import - tables with no deps first
TABLE_IMPORT_ORDER = [
    'users',
    'houses',
    'user_houses',
    'house_invites',
    'categories',
    'stores',
    'foods',
    'recipes',
    'meals',
    'shopping_lists',
    'shopping_list_items',
    'product_catalog',
    'product_category_tags',              # v2: normalized categories (no deps on catalog)
    'product_category_associations',      # v2: many-to-many (depends on catalog + tags)
    'product_nutrition',
    'barcode_lookup_sources',             # v3: configurable barcode sources
    'dispensa_items',
    'weights',
    'health_records',
    'error_logs',
]


def get_table_from_insert(stmt: str) -> str:
    """Extract table name from INSERT statement."""
    match = re.match(r'^\s*INSERT\s+INTO\s+"?(\w+)"?\s*', stmt, re.IGNORECASE)
    if match:
        return match.group(1)
    return ""


def normalize_enum_values(stmt: str) -> str:
    """
    Normalize enum values in INSERT statements.
    PostgreSQL enums use uppercase values (ADMIN, BASIC, ACTIVE, etc.)
    This function ensures consistency.
    """
    # No normalization needed - PostgreSQL enums are uppercase
    # and the export already uses uppercase values
    return stmt


def sort_statements_by_dependency(statements: list[str]) -> list[str]:
    """Sort INSERT statements by table dependency order."""
    # Separate INSERT statements from others
    inserts = []
    others = []

    for stmt in statements:
        if stmt.strip().upper().startswith('INSERT'):
            inserts.append(stmt)
        else:
            others.append(stmt)

    # Sort inserts by table order
    def get_order(stmt):
        table = get_table_from_insert(stmt)
        try:
            return TABLE_IMPORT_ORDER.index(table)
        except ValueError:
            return len(TABLE_IMPORT_ORDER)  # Unknown tables at the end

    inserts.sort(key=get_order)

    # Return other statements first (like SET, CREATE), then sorted inserts
    return others + inserts


def parse_sql_statements(sql_content: str) -> list[str]:
    """
    Parse SQL content into individual statements.
    Handles DO $$ blocks, regular statements, and skips COPY commands.
    """
    statements = []
    current_statement = []
    in_dollar_block = False
    in_copy_block = False

    for line in sql_content.split('\n'):
        stripped = line.strip()

        # Skip empty lines and comments
        if not stripped or stripped.startswith('--'):
            continue

        # Skip COPY blocks and their data
        if stripped.upper().startswith('COPY ') and 'FROM stdin' in stripped:
            in_copy_block = True
            continue

        if in_copy_block:
            if stripped == '\\.':
                in_copy_block = False
            continue

        # Handle DO $$ blocks
        if '$$' in line:
            if in_dollar_block:
                # Ending a $$ block
                current_statement.append(line)
                if stripped.endswith(';'):
                    full_statement = '\n'.join(current_statement).strip()
                    if full_statement:
                        statements.append(full_statement)
                    current_statement = []
                    in_dollar_block = False
            else:
                # Starting a $$ block
                in_dollar_block = True
                current_statement.append(line)
            continue

        if in_dollar_block:
            current_statement.append(line)
            continue

        # Regular statement handling
        current_statement.append(line)

        if stripped.endswith(';'):
            full_statement = '\n'.join(current_statement).strip()
            if full_statement and full_statement != ';':
                statements.append(full_statement)
            current_statement = []

    return statements


@router.post("/import-database")
async def import_database(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import database from SQL dump file.
    This is a one-shot migration tool - use with caution!

    The SQL file should be a pg_dump output with --inserts --no-owner --no-acl flags.
    """
    if not file.filename.endswith('.sql'):
        raise HTTPException(status_code=400, detail="File must be a .sql file")

    try:
        # Read file content
        content = await file.read()
        sql_content = content.decode('utf-8')

        # Parse statements
        statements = parse_sql_statements(sql_content)

        # Sort statements by table dependency order
        statements = sort_statements_by_dependency(statements)

        # Log the first few statements to debug ordering
        print(f"[Import] Total statements: {len(statements)}", flush=True)
        for i, stmt in enumerate(statements[:10]):
            table = get_table_from_insert(stmt)
            print(f"[Import] Statement {i}: table={table}, stmt={stmt[:100]}...", flush=True)

        # Track results
        executed = 0
        skipped = 0
        errors = []

        # Patterns to skip
        skip_patterns = [
            r'^\s*SELECT\s+pg_catalog\.set_config',
            r'^\s*SET\s+',
            r'^\s*CREATE\s+EXTENSION',
            r'^\s*COMMENT\s+ON\s+EXTENSION',
            r'^\\',  # Skip psql commands like \restrict, \copy, etc.
        ]

        # Get DB inspector for column patching
        db_inspector = inspect(db.bind)

        # Disable foreign key checks during import
        try:
            db.execute(text("SET session_replication_role = replica;"))
            db.commit()
        except Exception as e:
            logger.warning(f"Could not disable FK checks: {e}")

        # Execute each statement
        for stmt in statements:
            try:
                # Check if should skip
                should_skip = False
                for pattern in skip_patterns:
                    if re.match(pattern, stmt, re.IGNORECASE):
                        should_skip = True
                        skipped += 1
                        break

                if should_skip:
                    continue

                # Patch INSERT statements with missing NOT NULL columns
                patched_stmt = patch_insert_defaults(stmt, db_inspector)

                # Normalize enum values (ADMIN -> admin, BASIC -> basic, etc.)
                patched_stmt = normalize_enum_values(patched_stmt)

                # Log users inserts for debugging
                if 'INSERT INTO "users"' in patched_stmt:
                    print(f"[Import] Executing users INSERT: {patched_stmt[:200]}...", flush=True)

                db.execute(text(patched_stmt))
                db.commit()  # Commit each statement individually
                executed += 1

                # Log success for critical tables
                table_name = get_table_from_insert(patched_stmt)
                if table_name in ['users', 'houses']:
                    print(f"[Import] Successfully inserted into {table_name}", flush=True)

            except Exception as e:
                db.rollback()  # Rollback failed statement
                error_msg = str(e)

                # Log critical table errors
                table_name = get_table_from_insert(stmt)
                if table_name in ['users', 'houses']:
                    print(f"[Import] FAILED to insert into {table_name}: {error_msg}", flush=True)
                    print(f"[Import] Statement was: {stmt[:300]}...", flush=True)

                # Don't report duplicate/conflict errors - these are expected during re-import
                is_duplicate_error = any(pattern in error_msg.lower() for pattern in [
                    'duplicate key',
                    'already exists',
                    'unique constraint',
                    'violates unique',
                    'on conflict do nothing',
                    'conflicting key',
                ])
                if is_duplicate_error:
                    skipped += 1
                else:
                    # Full error for console debugging
                    errors.append({
                        "statement": stmt,
                        "error": error_msg
                    })

        # Re-enable foreign key checks
        try:
            db.execute(text("SET session_replication_role = DEFAULT;"))
            db.commit()
        except Exception as e:
            logger.warning(f"Could not re-enable FK checks: {e}")

        return {
            "success": True,
            "message": f"Import completed: {executed} statements executed, {skipped} skipped",
            "executed": executed,
            "skipped": skipped,
            "errors": errors[:10] if errors else []
        }

    except Exception as e:
        # Re-enable foreign key checks on error
        try:
            db.execute(text("SET session_replication_role = DEFAULT;"))
            db.commit()
        except:
            pass
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


def format_value(value) -> str:
    """Format a Python value for SQL INSERT statement."""
    if value is None:
        return 'NULL'
    elif isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, (datetime, date)):
        return f"'{value.isoformat()}'"
    elif isinstance(value, UUID):
        return f"'{str(value)}'"
    elif isinstance(value, dict):
        # JSON fields
        return f"'{json.dumps(value, ensure_ascii=False).replace(chr(39), chr(39)+chr(39))}'"
    else:
        # String - escape single quotes
        escaped = str(value).replace("'", "''")
        return f"'{escaped}'"


@router.post("/sql-console")
async def sql_console(
    query: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Execute SQL queries directly on the database.
    Supports SELECT, INSERT, UPDATE, DELETE, ALTER, CREATE, DROP.
    Use with caution!
    """
    sql_query = query.get("query", "").strip()

    if not sql_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        result = db.execute(text(sql_query))

        # Determine query type
        query_upper = sql_query.upper().lstrip()

        if query_upper.startswith("SELECT"):
            # Return rows for SELECT queries
            rows = result.fetchall()
            columns = list(result.keys()) if rows else []

            # Convert rows to list of dicts, handling special types
            data = []
            for row in rows:
                row_dict = {}
                for i, col in enumerate(columns):
                    value = row[i]
                    # Convert special types to strings
                    if isinstance(value, (datetime, date)):
                        value = value.isoformat()
                    elif isinstance(value, UUID):
                        value = str(value)
                    elif isinstance(value, dict):
                        pass  # JSON is fine
                    row_dict[col] = value
                data.append(row_dict)

            return {
                "success": True,
                "type": "select",
                "columns": columns,
                "rows": data,
                "row_count": len(data)
            }
        else:
            # For INSERT, UPDATE, DELETE, ALTER, CREATE, DROP
            db.commit()
            affected = result.rowcount if result.rowcount >= 0 else 0

            return {
                "success": True,
                "type": "execute",
                "message": f"Query executed successfully",
                "affected_rows": affected
            }

    except Exception as e:
        db.rollback()
        return {
            "success": False,
            "type": "error",
            "message": str(e)
        }


@router.get("/export-database")
async def export_database(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export database to SQL dump file.
    Generates INSERT statements for all tables, compatible with the import endpoint.
    """
    try:
        inspector = inspect(db.bind)
        table_names = inspector.get_table_names()

        # Order tables by dependencies (foreign keys)
        # Tables without foreign keys first, then tables that depend on them
        ordered_tables = [
            'users',
            'houses',
            'user_houses',
            'house_invites',
            'categories',
            'stores',
            'foods',
            'recipes',
            'meals',
            'shopping_lists',
            'shopping_list_items',
            'product_catalog',
            'product_category_tags',              # v2: normalized categories
            'product_category_associations',      # v2: many-to-many
            'product_nutrition',
            'barcode_lookup_sources',             # v3: configurable barcode sources
            'dispensa_items',
            'weights',
            'health_records',
            'error_logs',
        ]

        # Add any tables not in the ordered list
        for table in table_names:
            if table not in ordered_tables and not table.startswith('alembic'):
                ordered_tables.append(table)

        # Filter to only existing tables
        ordered_tables = [t for t in ordered_tables if t in table_names]

        sql_lines = []
        sql_lines.append(f"-- Database Export")
        sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
        sql_lines.append(f"-- Tables: {len(ordered_tables)}")
        sql_lines.append("")

        total_rows = 0

        for table_name in ordered_tables:
            # Get columns
            columns = inspector.get_columns(table_name)
            column_names = [col['name'] for col in columns]

            # Get all rows
            result = db.execute(text(f'SELECT * FROM "{table_name}"'))
            rows = result.fetchall()

            if rows:
                sql_lines.append(f"-- Table: {table_name} ({len(rows)} rows)")

                for row in rows:
                    values = []
                    for i, col_name in enumerate(column_names):
                        values.append(format_value(row[i]))

                    columns_str = ', '.join(f'"{c}"' for c in column_names)
                    values_str = ', '.join(values)

                    sql_lines.append(
                        f'INSERT INTO "{table_name}" ({columns_str}) VALUES ({values_str}) '
                        f'ON CONFLICT DO NOTHING;'
                    )

                sql_lines.append("")
                total_rows += len(rows)

        sql_lines.append(f"-- Export complete: {total_rows} total rows")

        sql_content = '\n'.join(sql_lines)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"meal_planner_backup_{timestamp}.sql"

        return Response(
            content=sql_content,
            media_type="application/sql",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# --- JSON Backup v2 ---


def serialize_value(value):
    """Convert a single DB value to a JSON-safe Python type."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, bytes):
        import base64
        return base64.b64encode(value).decode('ascii')
    return str(value)


def serialize_row(row, column_names) -> dict:
    """Convert a database row into a JSON-serializable dict."""
    result = {}
    for i, col_name in enumerate(column_names):
        val = serialize_value(row[i])
        if val is not None:
            result[col_name] = val
    return result


@router.get("/export-database-json")
async def export_database_json(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export database to JSON (v2 backup format).
    Schema-independent: stores raw column values as JSON dicts.
    """
    try:
        inspector = inspect(db.bind)
        table_names = inspector.get_table_names()

        # Reuse same FK-based ordering as SQL export
        ordered_tables = [
            'users',
            'houses',
            'house_members',
            'categories',
            'store_chains',
            'stores',
            'products',
            'recipes',
            'recipe_ingredients',
            'meals',
            'shopping_lists',
            'shopping_list_items',
            'pantry_items',
            'weight_entries',
        ]

        for table in table_names:
            if table not in ordered_tables and not table.startswith('alembic'):
                ordered_tables.append(table)

        ordered_tables = [t for t in ordered_tables if t in table_names]

        tables_data = {}
        for table_name in ordered_tables:
            columns = inspector.get_columns(table_name)
            column_names = [col['name'] for col in columns]

            result = db.execute(text(f'SELECT * FROM "{table_name}"'))
            rows = result.fetchall()

            tables_data[table_name] = [
                serialize_row(row, column_names) for row in rows
            ]

        export_obj = {
            "version": 2,
            "exported_at": datetime.now().isoformat(),
            "schema_version": "current",
            "tables": tables_data,
        }

        json_content = json.dumps(export_obj, ensure_ascii=False, indent=2)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"backup_v2_{timestamp}.json"

        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except Exception as e:
        logger.error(f"JSON export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/import-database-json")
async def import_database_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import database from a JSON v2 backup file.
    Only inserts rows that don't already exist (ON CONFLICT DO NOTHING).
    Ignores columns present in the backup but missing in the current schema.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be a .json file")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))

        # Validate format
        version = data.get("version")
        if not version or version < 2:
            raise HTTPException(
                status_code=400,
                detail="Invalid backup file: version must be >= 2"
            )

        tables = data.get("tables", {})
        if not tables:
            raise HTTPException(status_code=400, detail="No tables in backup file")

        inspector = inspect(db.bind)
        existing_tables = set(inspector.get_table_names())

        executed = 0
        skipped = 0
        errors = []

        # Disable FK checks
        try:
            db.execute(text("SET session_replication_role = replica;"))
            db.commit()
        except Exception as e:
            logger.warning(f"Could not disable FK checks: {e}")

        for table_name, rows in tables.items():
            if table_name not in existing_tables:
                skipped += len(rows)
                continue

            # Get current DB columns for this table
            db_columns = {col['name'] for col in inspector.get_columns(table_name)}

            # Get primary key columns for ON CONFLICT
            pk = inspector.get_pk_constraint(table_name)
            pk_columns = pk.get('constrained_columns', []) if pk else []

            for record in rows:
                # Filter to only columns that exist in current DB schema
                filtered = {
                    k: v for k, v in record.items() if k in db_columns
                }
                if not filtered:
                    skipped += 1
                    continue

                col_names = list(filtered.keys())
                col_refs = ', '.join(f'"{c}"' for c in col_names)
                placeholders = ', '.join(f':p_{i}' for i in range(len(col_names)))
                # Convert dict/list to JSON strings for psycopg2
                params = {}
                for i, v in enumerate(filtered.values()):
                    if isinstance(v, (dict, list)):
                        params[f'p_{i}'] = json.dumps(v, ensure_ascii=False)
                    else:
                        params[f'p_{i}'] = v

                # Build conflict clause
                if pk_columns:
                    pk_ref = ', '.join(f'"{c}"' for c in pk_columns)
                    conflict = f" ON CONFLICT ({pk_ref}) DO NOTHING"
                else:
                    conflict = " ON CONFLICT DO NOTHING"

                stmt = f'INSERT INTO "{table_name}" ({col_refs}) VALUES ({placeholders}){conflict}'

                try:
                    result = db.execute(text(stmt), params)
                    db.commit()
                    if result.rowcount > 0:
                        executed += 1
                    else:
                        skipped += 1
                except Exception as e:
                    db.rollback()
                    error_msg = str(e)
                    if 'duplicate key' in error_msg.lower() or 'already exists' in error_msg.lower():
                        skipped += 1
                    else:
                        errors.append({
                            "statement": f"INSERT INTO {table_name} (record keys: {col_names})",
                            "error": error_msg
                        })

        # Re-enable FK checks
        try:
            db.execute(text("SET session_replication_role = DEFAULT;"))
            db.commit()
        except Exception as e:
            logger.warning(f"Could not re-enable FK checks: {e}")

        return {
            "success": True,
            "message": f"Import JSON completato: {executed} righe inserite, {skipped} saltate",
            "executed": executed,
            "skipped": skipped,
            "errors": errors[:10] if errors else []
        }

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        try:
            db.execute(text("SET session_replication_role = DEFAULT;"))
            db.commit()
        except:
            pass
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/seed-nutrition")
def seed_nutrition(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import nutritional database from an uploaded CSV file.
    Expected format: columns Alimento, Categoria, Proteine (g), Grassi (g), etc.
    Skips foods that already exist in the database.
    """
    import tempfile
    from app.db.seed import seed_foods

    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Seleziona un file .csv")

    try:
        # Save uploaded file to a temp path
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        stats = seed_foods(db=db, csv_path=tmp_path, skip_duplicates=True)

        # Cleanup temp file
        tmp_path.unlink(missing_ok=True)

        return {
            "success": True,
            "message": f"Import completato: {stats['inserted']} inseriti, {stats['skipped']} gia' presenti, {stats['errors']} errori",
            "total": stats["total"],
            "inserted": stats["inserted"],
            "updated": stats["updated"],
            "skipped": stats["skipped"],
            "errors": stats["errors"],
            "error_details": stats.get("error_details", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante il seed: {str(e)}")
