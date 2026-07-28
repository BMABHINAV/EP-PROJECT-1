"""
Dashboard aggregate endpoints — summary stats for the commander view.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.core.database import get_db
from app.db.models.models import Responder, Vital, GasReading, Prediction, Alert

router = APIRouter()


@router.get("/summary", summary="Real-time dashboard summary for command center")
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    """
    Returns aggregated stats for the command-center dashboard:
    - Total active responders
    - Current alert counts by severity
    - Average RRI across team
    - Responders in critical/warning state
    """
    now = datetime.utcnow()
    window_5min = now - timedelta(minutes=5)

    # Active responders
    res = await db.execute(select(func.count()).where(Responder.is_active == True))
    total_responders = res.scalar()

    # Unacknowledged alerts
    res = await db.execute(
        select(Alert.severity, func.count())
        .where(Alert.acknowledged == False)
        .group_by(Alert.severity)
    )
    alert_counts = {row[0]: row[1] for row in res.fetchall()}

    # Latest predictions per responder (last 5 min)
    res = await db.execute(
        select(Prediction.risk_level, func.count())
        .where(Prediction.time >= window_5min)
        .group_by(Prediction.risk_level)
    )
    risk_distribution = {row[0]: row[1] for row in res.fetchall()}

    # Average RRI
    res = await db.execute(
        select(func.avg(Prediction.rri))
        .where(Prediction.time >= window_5min)
    )
    avg_rri = res.scalar() or 0.0

    return {
        "timestamp": now.isoformat(),
        "total_active_responders": total_responders,
        "alert_counts": {
            "critical": alert_counts.get("critical", 0),
            "warning":  alert_counts.get("warning", 0),
            "info":     alert_counts.get("info", 0),
        },
        "risk_distribution": risk_distribution,
        "average_rri": round(float(avg_rri), 3),
    }


@router.get("/responder-cards", summary="Live status card data for all responders")
async def responder_cards(db: AsyncSession = Depends(get_db)):
    """Returns latest vital+RRI snapshot for each active responder."""
    window = datetime.utcnow() - timedelta(minutes=10)

    responders_res = await db.execute(
        select(Responder).where(Responder.is_active == True)
    )
    responders = responders_res.scalars().all()

    cards = []
    for r in responders:
        # Latest vitals
        v_res = await db.execute(
            select(Vital)
            .where(and_(Vital.responder_id == r.id, Vital.time >= window))
            .order_by(Vital.time.desc())
            .limit(1)
        )
        latest_vital = v_res.scalar_one_or_none()

        # Latest RRI
        p_res = await db.execute(
            select(Prediction)
            .where(and_(Prediction.responder_id == r.id, Prediction.time >= window))
            .order_by(Prediction.time.desc())
            .limit(1)
        )
        latest_pred = p_res.scalar_one_or_none()

        cards.append({
            "responder_id": str(r.id),
            "badge_id":     r.badge_id,
            "name":         r.name,
            "role":         r.role,
            "team":         r.team,
            "vitals": {
                "heart_rate":       latest_vital.heart_rate       if latest_vital else None,
                "spo2":             latest_vital.spo2             if latest_vital else None,
                "body_temp_c":      latest_vital.body_temp_c      if latest_vital else None,
                "respiration_rate": latest_vital.respiration_rate if latest_vital else None,
            } if latest_vital else {},
            "rri":        latest_pred.rri        if latest_pred else None,
            "risk_level": latest_pred.risk_level if latest_pred else "unknown",
            "last_seen":  latest_vital.time.isoformat() if latest_vital else None,
        })

    return {"responder_cards": cards}
