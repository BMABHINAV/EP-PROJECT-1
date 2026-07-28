"""
Predictions / RRI endpoints.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.core.database import get_db
from app.db.models.models import Prediction, Responder

router = APIRouter()


@router.get("/{badge_id}/latest", summary="Latest RRI prediction for a responder")
async def get_latest_prediction(badge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Responder).where(Responder.badge_id == badge_id))
    responder = result.scalar_one_or_none()
    if not responder:
        return {"error": "Responder not found"}

    p_res = await db.execute(
        select(Prediction)
        .where(Prediction.responder_id == responder.id)
        .order_by(Prediction.time.desc())
        .limit(1)
    )
    pred = p_res.scalar_one_or_none()
    if not pred:
        return {"message": "No predictions yet"}

    return {
        "badge_id":            badge_id,
        "time":                pred.time.isoformat(),
        "rri":                 pred.rri,
        "risk_level":          pred.risk_level,
        "fatigue_probability": pred.fatigue_probability,
        "inference_time_ms":   pred.inference_time_ms,
    }


@router.get("/{badge_id}/history", summary="RRI trend over time")
async def get_rri_history(
    badge_id: str,
    minutes: int = Query(default=60, ge=1, le=1440),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Responder).where(Responder.badge_id == badge_id))
    responder = result.scalar_one_or_none()
    if not responder:
        return {"error": "Responder not found"}

    since = datetime.utcnow() - timedelta(minutes=minutes)
    p_res = await db.execute(
        select(Prediction)
        .where(Prediction.responder_id == responder.id, Prediction.time >= since)
        .order_by(Prediction.time.asc())
        .limit(300)
    )
    preds = p_res.scalars().all()

    return {
        "badge_id": badge_id,
        "count":    len(preds),
        "data": [
            {
                "time":       p.time.isoformat(),
                "rri":        p.rri,
                "risk_level": p.risk_level,
            }
            for p in preds
        ]
    }
