"""
Missions endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.db.models.models import Mission

router = APIRouter()


@router.get("/", summary="List all missions")
async def list_missions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).order_by(Mission.started_at.desc()))
    missions = result.scalars().all()
    return [
        {
            "id":           str(m.id),
            "mission_code": m.mission_code,
            "name":         m.name,
            "location":     m.location,
            "latitude":     m.latitude,
            "longitude":    m.longitude,
            "status":       m.status,
            "hazard_level": m.hazard_level,
            "started_at":   m.started_at.isoformat() if m.started_at else None,
        }
        for m in missions
    ]


@router.get("/active", summary="Get active mission")
async def get_active_mission(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mission).where(Mission.status == "active").limit(1)
    )
    mission = result.scalar_one_or_none()
    if not mission:
        return {"message": "No active mission"}
    return {
        "id":           str(mission.id),
        "mission_code": mission.mission_code,
        "name":         mission.name,
        "location":     mission.location,
        "latitude":     mission.latitude,
        "longitude":    mission.longitude,
        "status":       mission.status,
        "hazard_level": mission.hazard_level,
    }
