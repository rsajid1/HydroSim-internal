import psycopg2
from psycopg2.extras import RealDictCursor

from config.config import settings


def get_connection():
    """Open a new PostgreSQL connection using app settings."""
    return psycopg2.connect(
        host=settings.db_host,
        user=settings.db_user,
        password=settings.db_password,
        dbname=settings.db_name,
        port=settings.db_port,
        connect_timeout=5,
    )


def query_one(sql, params=None):
    """Run a query and return the first row as a dict (or None)."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(sql, params)
            row = cursor.fetchone() if cursor.description else None
        conn.commit()
        return dict(row) if row else None
    finally:
        conn.close()
        
def query_all(sql, params=None):
    """Run a query and return all rows as a list of dicts."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall() if cursor.description else []
        conn.commit()
        return [dict(row) for row in rows]
    finally:
        conn.close()
