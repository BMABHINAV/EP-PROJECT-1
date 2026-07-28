"""
Pydantic schemas for API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class ResponderCreate(BaseModel):
    badge_id:    str = Field(..., example="NDRF-001")
    name:        str = Field(..., example="Arjun Singh")
    role:        str = Field(..., example="firefighter")
    team:        Optional[str] = None
    blood_group: Optional[str] = None
    age:         Optional[int] = None
    weight_kg:   Optional[float] = None
    height_cm:   Optional[float] = None


class ResponderResponse(BaseModel):
    id:          UUID
    badge_id:    str
    name:        str
    role:        str
    team:        Optional[str]
    blood_group: Optional[str]
    age:         Optional[int]
    is_active:   bool
    created_at:  datetime

    class Config:
        from_attributes = True


class VitalPayload(BaseModel):
    """MQTT vitals payload schema."""
    badge_id:         str
    timestamp:        str
    heart_rate:       float = Field(ge=20, le=250)
    hrv_ms:           Optional[float] = None
    spo2:             float = Field(ge=70, le=100)
    respiration_rate: Optional[float] = None
    body_temp_c:      Optional[float] = None


class GasPayload(BaseModel):
    """MQTT gas readings payload schema."""
    badge_id:           str
    timestamp:          str
    co_ppm:             float = Field(default=0.0, ge=0)
    no2_ppm:            float = Field(default=0.0, ge=0)
    nh3_ppm:            float = Field(default=0.0, ge=0)
    o2_percent:         float = Field(default=20.9, ge=0, le=100)
    ambient_temp_c:     Optional[float] = None
    humidity_pct:       Optional[float] = None
    gas_exposure_index: Optional[float] = Field(default=None, ge=0, le=1)


class PredictionPayload(BaseModel):
    """Edge inference result from ESP32."""
    badge_id:            str
    timestamp:           str
    rri:                 float = Field(ge=0, le=1)
    fatigue_probability: Optional[float] = None
    inference_time_ms:   Optional[float] = None
    features:            Optional[dict] = None
