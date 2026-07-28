"""
Application configuration — local development (no Docker).
Uses SQLite for zero-install database.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────
    APP_NAME: str = "Responder System"
    DEBUG: bool = True
    SECRET_KEY: str = "dev_secret_change_in_production"

    # ── Database ─────────────────────────────────────────────────────
    # SQLite for local dev — zero install required
    DATABASE_URL: str = "sqlite+aiosqlite:///./responder_dev.db"
    # Switch to PostgreSQL when ready:
    # DATABASE_URL: str = "postgresql+asyncpg://responder:responder_secret@localhost:5432/responder_db"

    # ── MQTT ─────────────────────────────────────────────────────────
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""
    MQTT_CLIENT_ID: str = "responder-backend-01"
    MQTT_KEEPALIVE: int = 60
    MQTT_TOPIC_PREFIX: str = "responder"

    # ── Redis (optional — disabled for local dev) ─────────────────────
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_ENABLED: bool = False   # Set True when Redis is installed

    # ── CORS ─────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # ── Alert thresholds ──────────────────────────────────────────────
    CO_DANGER_PPM: float = 50.0
    NO2_DANGER_PPM: float = 5.0
    NH3_DANGER_PPM: float = 300.0
    O2_LOW_PCT: float = 19.5
    SPO2_LOW_PCT: float = 94.0
    HR_HIGH_BPM: float = 160.0
    BODY_TEMP_HIGH_C: float = 38.5
    RRI_CAUTION: float = 0.3
    RRI_WARNING: float = 0.6
    RRI_CRITICAL: float = 0.8

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
