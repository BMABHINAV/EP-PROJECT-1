"""
Gas readings endpoints.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.core.database import get_db
from app.db.models.models import GasReading, Responder

router = APIRouter()


@router.get("/{badge_id}/latest", summary="Latest gas readings for a responder")
async def get_latest_gas(badge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Responder).where(Responder.badge_id == badge_id))
    responder = result.scalar_one_or_none()
    if not responder:
        return {"error": "Responder not found"}

    g_res = await db.execute(
        select(GasReading)
        .where(GasReading.responder_id == responder.id)
        .order_by(GasReading.time.desc())
        .limit(1)
    )
    gas = g_res.scalar_one_or_none()
    if not gas:
        return {"message": "No gas data yet"}

    return {
        "badge_id":           badge_id,
        "time":               gas.time.isoformat(),
        "co_ppm":             gas.co_ppm,
        "no2_ppm":            gas.no2_ppm,
        "nh3_ppm":            gas.nh3_ppm,
        "o2_percent":         gas.o2_percent,
        "ambient_temp_c":     gas.ambient_temp_c,
        "humidity_pct":       gas.humidity_pct,
        "gas_exposure_index": gas.gas_exposure_index,
    }
