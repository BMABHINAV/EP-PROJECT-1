"""
Async SQLAlchemy engine — supports both SQLite (local dev) and PostgreSQL (production).
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event

from app.core.config import settings


class Base(DeclarativeBase):
    pass


# Determine engine args based on DB type
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine_kwargs = {
    "echo": settings.DEBUG,
}
if not _is_sqlite:
    # PostgreSQL connection pooling
    engine_kwargs["pool_size"]    = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_pre_ping"]= True

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

# Enable WAL mode for SQLite (better concurrent read/write)
if _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields an async DB session."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables (SQLite: runs at startup; PostgreSQL: use Alembic migrations)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
