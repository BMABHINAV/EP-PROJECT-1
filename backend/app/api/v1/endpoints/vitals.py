"""
Vitals endpoints — time-series queries for a specific responder.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional

from app.core.database import get_db
from app.db.models.models import Vital, Responder

router = APIRouter()


@router.get("/{badge_id}/latest", summary="Get latest vitals for a responder")
async def get_latest_vitals(badge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Responder).where(Responder.badge_id == badge_id)
    )
    responder = result.scalar_one_or_none()
    if not responder:
        return {"error": "Responder not found"}

    v_res = await db.execute(
        select(Vital)
        .where(Vital.responder_id == responder.id)
        .order_by(Vital.time.desc())
        .limit(1)
    )
    vital = v_res.scalar_one_or_none()
    if not vital:
        return {"message": "No vitals data yet"}

    return {
        "badge_id":         badge_id,
        "time":             vital.time.isoformat(),
        "heart_rate":       vital.heart_rate,
        "hrv_ms":           vital.hrv_ms,
        "spo2":             vital.spo2,
        "respiration_rate": vital.respiration_rate,
        "body_temp_c":      vital.body_temp_c,
    }


@router.get("/{badge_id}/history", summary="Get vitals time-series (last N minutes)")
async def get_vitals_history(
    badge_id: str,
    minutes: int = Query(default=30, ge=1, le=1440),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Responder).where(Responder.badge_id == badge_id)
    )
    responder = result.scalar_one_or_none()
    if not responder:
        return {"error": "Responder not found"}

    since = datetime.utcnow() - timedelta(minutes=minutes)
    v_res = await db.execute(
        select(Vital)
        .where(Vital.responder_id == responder.id, Vital.time >= since)
        .order_by(Vital.time.asc())
        .limit(500)
    )
    vitals = v_res.scalars().all()

    return {
        "badge_id": badge_id,
        "count":    len(vitals),
        "data": [
            {
                "time":             v.time.isoformat(),
                "heart_rate":       v.heart_rate,
                "spo2":             v.spo2,
                "body_temp_c":      v.body_temp_c,
                "respiration_rate": v.respiration_rate,
            }
            for v in vitals
        ]
    }
