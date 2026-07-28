"""
SQLAlchemy ORM models — SQLite + PostgreSQL compatible.
Removed TimescaleDB-specific types; uses standard DateTime and JSON.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Boolean, Integer,
    ForeignKey, Text, DateTime
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.orm import relationship
from app.core.database import Base
import json


# ─────────────────────────────────────────────────────────────────────
# UUID compatibility shim (SQLite stores UUID as CHAR(36))
# ─────────────────────────────────────────────────────────────────────

class GUID(TypeDecorator):
    """Platform-independent GUID type. Uses PostgreSQL's UUID type,
    uses CHAR(36) on other databases (SQLite)."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID())
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if not isinstance(value, uuid.UUID):
            return str(uuid.UUID(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(value)
        return value


# ─────────────────────────────────────────────────────────────────────
# JSON compatibility shim (SQLite stores JSON as Text)
# ─────────────────────────────────────────────────────────────────────

class JSONType(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return value


def _uuid():
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────

class Responder(Base):
    __tablename__ = "responders"

    id              = Column(GUID(), primary_key=True, default=_uuid)
    badge_id        = Column(String(50), unique=True, nullable=False, index=True)
    name            = Column(String(100), nullable=False)
    role            = Column(String(50))
    team            = Column(String(50))
    blood_group     = Column(String(5))
    age             = Column(Integer)
    weight_kg       = Column(Float)
    height_cm       = Column(Float)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    vitals          = relationship("Vital",      back_populates="responder", lazy="select")
    gas_readings    = relationship("GasReading", back_populates="responder", lazy="select")
    predictions     = relationship("Prediction", back_populates="responder", lazy="select")
    alerts          = relationship("Alert",      back_populates="responder",
                                  foreign_keys="Alert.responder_id", lazy="select")


class Mission(Base):
    __tablename__ = "missions"

    id           = Column(GUID(), primary_key=True, default=_uuid)
    mission_code = Column(String(50), unique=True, nullable=False)
    name         = Column(String(150))
    location     = Column(String(200))
    latitude     = Column(Float)
    longitude    = Column(Float)
    started_at   = Column(DateTime, default=datetime.utcnow)
    ended_at     = Column(DateTime, nullable=True)
    status       = Column(String(20), default="active")
    hazard_level = Column(Integer, default=1)
    notes        = Column(Text)
    created_at   = Column(DateTime, default=datetime.utcnow)


class Vital(Base):
    __tablename__ = "vitals"

    id               = Column(GUID(), primary_key=True, default=_uuid)
    time             = Column(DateTime, default=datetime.utcnow, index=True)
    responder_id     = Column(GUID(), ForeignKey("responders.id"), nullable=False, index=True)
    mission_id       = Column(GUID(), ForeignKey("missions.id"),   nullable=True)
    heart_rate       = Column(Float)
    hrv_ms           = Column(Float)
    spo2             = Column(Float)
    respiration_rate = Column(Float)
    body_temp_c      = Column(Float)
    data_source      = Column(String(20), default="chest_module")

    responder = relationship("Responder", back_populates="vitals")


class GasReading(Base):
    __tablename__ = "gas_readings"

    id                  = Column(GUID(), primary_key=True, default=_uuid)
    time                = Column(DateTime, default=datetime.utcnow, index=True)
    responder_id        = Column(GUID(), ForeignKey("responders.id"), nullable=False, index=True)
    mission_id          = Column(GUID(), ForeignKey("missions.id"),   nullable=True)
    co_ppm              = Column(Float, default=0.0)
    no2_ppm             = Column(Float, default=0.0)
    nh3_ppm             = Column(Float, default=0.0)
    o2_percent          = Column(Float, default=20.9)
    ambient_temp_c      = Column(Float)
    humidity_pct        = Column(Float)
    gas_exposure_index  = Column(Float)

    responder = relationship("Responder", back_populates="gas_readings")


class Prediction(Base):
    __tablename__ = "predictions"

    id                   = Column(GUID(), primary_key=True, default=_uuid)
    time                 = Column(DateTime, default=datetime.utcnow, index=True)
    responder_id         = Column(GUID(), ForeignKey("responders.id"), nullable=False, index=True)
    mission_id           = Column(GUID(), ForeignKey("missions.id"),   nullable=True)
    rri                  = Column(Float, nullable=False)
    risk_level           = Column(String(15))
    fatigue_probability  = Column(Float)
    collapse_probability = Column(Float)
    model_version        = Column(String(20), default="v1.0")
    inference_time_ms    = Column(Float)
    features_json        = Column(JSONType)

    responder = relationship("Responder", back_populates="predictions")


class Alert(Base):
    __tablename__ = "alerts"

    id              = Column(GUID(), primary_key=True, default=_uuid)
    time            = Column(DateTime, default=datetime.utcnow, index=True)
    responder_id    = Column(GUID(), ForeignKey("responders.id"), nullable=False, index=True)
    mission_id      = Column(GUID(), ForeignKey("missions.id"),   nullable=True)
    alert_type      = Column(String(50), nullable=False)
    severity        = Column(String(15), nullable=False)
    message         = Column(Text, nullable=False)
    rri_at_alert    = Column(Float)
    acknowledged    = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved        = Column(Boolean, default=False)
    resolved_at     = Column(DateTime, nullable=True)

    responder = relationship("Responder", back_populates="alerts",
                             foreign_keys=[responder_id])


class Location(Base):
    __tablename__ = "locations"

    id           = Column(GUID(), primary_key=True, default=_uuid)
    time         = Column(DateTime, default=datetime.utcnow, index=True)
    responder_id = Column(GUID(), ForeignKey("responders.id"), nullable=False, index=True)
    mission_id   = Column(GUID(), ForeignKey("missions.id"),   nullable=True)
    latitude     = Column(Float)
    longitude    = Column(Float)
    altitude_m   = Column(Float)
    accuracy_m   = Column(Float)
    source       = Column(String(20), default="gps")


class BatteryStatus(Base):
    __tablename__ = "battery_status"

    id                   = Column(GUID(), primary_key=True, default=_uuid)
    time                 = Column(DateTime, default=datetime.utcnow, index=True)
    responder_id         = Column(GUID(), ForeignKey("responders.id"), nullable=False)
    module               = Column(String(20))
    voltage_v            = Column(Float)
    percentage           = Column(Float)
    charging             = Column(Boolean, default=False)
    estimated_runtime_min = Column(Float)
