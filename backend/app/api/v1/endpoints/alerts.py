"""
Alerts endpoints — list, acknowledge, resolve.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.db.models.models import Alert

router = APIRouter()


@router.get("/", summary="List alerts (unacknowledged by default)")
async def list_alerts(
    acknowledged: Optional[bool] = False,
    severity: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(Alert)
    if acknowledged is not None:
        query = query.where(Alert.acknowledged == acknowledged)
    if severity:
        query = query.where(Alert.severity == severity)
    query = query.order_by(Alert.time.desc()).limit(limit)
    result = await db.execute(query)
    alerts = result.scalars().all()
    return [
        {
            "id":           str(a.id),
            "time":         a.time.isoformat(),
            "alert_type":   a.alert_type,
            "severity":     a.severity,
            "message":      a.message,
            "rri_at_alert": a.rri_at_alert,
            "acknowledged": a.acknowledged,
            "resolved":     a.resolved,
        }
        for a in alerts
    ]


@router.patch("/{alert_id}/acknowledge", summary="Acknowledge an alert")
async def acknowledge_alert(alert_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    await db.commit()
    return {"status": "acknowledged", "alert_id": str(alert_id)}


@router.patch("/{alert_id}/resolve", summary="Resolve an alert")
async def resolve_alert(alert_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "resolved", "alert_id": str(alert_id)}
