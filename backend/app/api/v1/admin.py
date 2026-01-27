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
from uuid import UUID
import re
import logging
import json

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/admin")


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

                db.execute(text(stmt))
                db.commit()  # Commit each statement individually
                executed += 1

            except Exception as e:
                db.rollback()  # Rollback failed statement
                error_msg = str(e)

                # Don't report duplicate key errors
                if 'duplicate key' in error_msg.lower() or 'already exists' in error_msg.lower():
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
