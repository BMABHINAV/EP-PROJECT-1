"""
Responder System — FastAPI Backend (updated for local dev without Docker)
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import engine, Base, init_db
from app.api.v1 import router as api_v1_router
from app.api.websocket import ws_router

import sys
import asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)

# Deferred MQTT import so app starts even when broker is offline
mqtt_manager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    global mqtt_manager

    # 1. Create SQLite tables on first run
    logger.info("🗄️  Initializing database...")
    await init_db()
    logger.info("✅ Database ready")

    # 2. Seed sample data if DB is empty
    await seed_initial_data()

    # 3. Connect MQTT broker (non-fatal if not running yet)
    try:
        from app.mqtt.client import mqtt_manager as _mgr
        mqtt_manager = _mgr
        await mqtt_manager.connect()
        logger.info("📡 MQTT broker connected")
    except Exception as e:
        logger.warning(f"⚠️  MQTT broker not available: {e} — running without MQTT")

    yield

    if mqtt_manager:
        await mqtt_manager.disconnect()
    logger.info("💤 Backend shutdown complete")


async def seed_initial_data():
    """Insert sample responders if DB is empty."""
    from app.core.database import AsyncSessionLocal
    from app.db.models.models import Responder, Mission
    from sqlalchemy import select, func

    async with AsyncSessionLocal() as db:
        count = await db.scalar(select(func.count()).select_from(Responder))
        if count and count > 0:
            return  # already seeded

        responders = [
            Responder(badge_id="NDRF-001", name="Arjun Singh",  role="firefighter", team="Alpha", blood_group="O+",  age=32, weight_kg=78.0, height_cm=178.0),
            Responder(badge_id="NDRF-002", name="Priya Sharma", role="paramedic",   team="Alpha", blood_group="A+",  age=28, weight_kg=62.0, height_cm=165.0),
            Responder(badge_id="NDRF-003", name="Ravi Kumar",   role="firefighter", team="Bravo", blood_group="B+",  age=35, weight_kg=82.0, height_cm=180.0),
            Responder(badge_id="NDRF-004", name="Anita Patel",  role="ndrf",        team="Bravo", blood_group="AB-", age=29, weight_kg=68.0, height_cm=170.0),
            Responder(badge_id="NDRF-005", name="Suresh Menon", role="firefighter", team="Alpha", blood_group="O-",  age=40, weight_kg=85.0, height_cm=182.0),
        ]
        db.add_all(responders)

        mission = Mission(
            mission_code="OPS-2026-001",
            name="Industrial Fire Response - Sector 7",
            location="Bhilai Steel Plant, Chhattisgarh",
            latitude=21.2096, longitude=81.4285,
            hazard_level=4, status="active",
        )
        db.add(mission)
        await db.commit()
        logger.info("✅ Seeded 5 responders + 1 mission")


def create_application() -> FastAPI:
    app = FastAPI(
        title="Responder System API",
        description="Real-time API for the Integrated Wearable Monitoring System",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    app.include_router(api_v1_router, prefix="/api/v1")
    app.include_router(ws_router, prefix="/ws")

    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "ok",
            "service": "responder-backend",
            "version": "1.0.0",
            "database": "sqlite (local dev)",
        }

    return app


app = create_application()
