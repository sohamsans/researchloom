import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

def _get_database_url() -> str:
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    
    # If running as frozen executable (PyInstaller)
    if getattr(sys, "frozen", False):
        base_dir = Path(sys.executable).parent
        db_path = base_dir / "autolit.db"
        return f"sqlite+aiosqlite:///{db_path.as_posix()}"
    
    # In development mode, check backend/ or parent directory
    curr_file = Path(__file__).resolve()
    backend_dir = curr_file.parents[2]
    backend_db = backend_dir / "autolit.db"
    return f"sqlite+aiosqlite:///{backend_db.as_posix()}"

DATABASE_URL = _get_database_url()

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

from sqlalchemy import text

async def init_db():
    """Create all database tables on application startup and auto-migrate missing columns."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def migrate_sqlite_columns(sync_conn):
            try:
                # Check users table
                res = sync_conn.execute(text("PRAGMA table_info(users)"))
                user_cols = [row[1] for row in res.fetchall()]
                if user_cols:
                    if "save_chat_history" not in user_cols:
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN save_chat_history BOOLEAN DEFAULT 1"))
                    if "contribute_public_cache" not in user_cols:
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN contribute_public_cache BOOLEAN DEFAULT 1"))
                    if "username" not in user_cols:
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN username TEXT NULL"))
                    if "is_verified" not in user_cols:
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0"))
                    if "verification_code" not in user_cols:
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN verification_code TEXT NULL"))
                    if "code_expires_at" not in user_cols:
                        sync_conn.execute(text("ALTER TABLE users ADD COLUMN code_expires_at DATETIME NULL"))

                # Ensure manuscripts table exists for existing databases
                sync_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS manuscripts (
                        id VARCHAR(36) PRIMARY KEY,
                        user_id VARCHAR(36) NULL,
                        title VARCHAR(255) DEFAULT 'Untitled Manuscript',
                        mode VARCHAR(20) DEFAULT 'rich',
                        content TEXT DEFAULT '',
                        latex_source TEXT DEFAULT '',
                        associated_topic VARCHAR(255) NULL,
                        citations_json TEXT NULL,
                        word_count INTEGER DEFAULT 0,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))

                # Ensure flow_canvases table exists for existing databases
                sync_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS flow_canvases (
                        id VARCHAR(36) PRIMARY KEY,
                        user_id VARCHAR(36) NULL,
                        title VARCHAR(255) DEFAULT 'Untitled Flow Map',
                        topic VARCHAR(255) DEFAULT 'General Research',
                        nodes_json TEXT DEFAULT '[]',
                        edges_json TEXT DEFAULT '[]',
                        viewport_json TEXT DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                """))

                # Ensure matrix_column_definitions exists
                sync_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS matrix_column_definitions (
                        id VARCHAR(36) PRIMARY KEY,
                        workspace_id VARCHAR(64) DEFAULT 'default_workspace',
                        column_name VARCHAR(255) NOT NULL,
                        prompt TEXT NOT NULL,
                        data_type VARCHAR(50) DEFAULT 'string',
                        created_at DATETIME
                    )
                """))

                # Ensure matrix_cells exists
                sync_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS matrix_cells (
                        id VARCHAR(36) PRIMARY KEY,
                        workspace_id VARCHAR(64) DEFAULT 'default_workspace',
                        paper_id VARCHAR(128) NOT NULL,
                        column_id VARCHAR(36) NOT NULL,
                        value TEXT NOT NULL,
                        status VARCHAR(20) DEFAULT 'reported',
                        confidence VARCHAR(20) DEFAULT 'high',
                        source_sentence TEXT NULL,
                        source_page INTEGER NULL,
                        bounding_box_json TEXT NULL,
                        is_human_edited BOOLEAN DEFAULT 0,
                        updated_at DATETIME
                    )
                """))

                # Ensure screening_audit_log exists for PRISMA tracking
                sync_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS screening_audit_log (
                        id VARCHAR(36) PRIMARY KEY,
                        workspace_id VARCHAR(64) DEFAULT 'default_workspace',
                        paper_id VARCHAR(128) NOT NULL,
                        paper_title VARCHAR(500) NOT NULL,
                        paper_doi VARCHAR(255) NULL,
                        action VARCHAR(20) NOT NULL,
                        exclusion_reason VARCHAR(100) NULL,
                        stage VARCHAR(30) DEFAULT 'screening',
                        reviewer_id VARCHAR(100) DEFAULT 'primary_reviewer',
                        notes TEXT NULL,
                        created_at DATETIME
                    )
                """))
            except Exception as e:
                print(f"[DB Auto-Migration Warning] {e}")

        await conn.run_sync(migrate_sqlite_columns)

async def get_db():
    """Dependency for yielding an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
