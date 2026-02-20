import psycopg2
from fastapi import APIRouter
from config.config import settings

router = APIRouter(
    prefix="/api/db",
    tags=["database"]
)


@router.get("/health")
async def db_health():
    """Test the PostgreSQL database connection."""
    try:
        conn = psycopg2.connect(
            host=settings.db_host,
            user=settings.db_user,
            password=settings.db_password,
            dbname=settings.db_name,
            port=settings.db_port,
            connect_timeout=5
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return {
            "status": "connected",
            "host": settings.db_host,
            "database": settings.db_name,
            "version": version
        }
    except Exception as e:
        return {
            "status": "failed",
            "host": settings.db_host,
            "database": settings.db_name,
            "error": str(e)
        }
