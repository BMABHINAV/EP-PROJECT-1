"""
API v1 Router — aggregates all endpoint modules.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import responders, vitals, gas, predictions, alerts, missions, dashboard

router = APIRouter()

router.include_router(responders.router,  prefix="/responders",  tags=["Responders"])
router.include_router(missions.router,    prefix="/missions",    tags=["Missions"])
router.include_router(vitals.router,      prefix="/vitals",      tags=["Vitals"])
router.include_router(gas.router,         prefix="/gas",         tags=["Gas Readings"])
router.include_router(predictions.router, prefix="/predictions", tags=["RRI Predictions"])
router.include_router(alerts.router,      prefix="/alerts",      tags=["Alerts"])
router.include_router(dashboard.router,   prefix="/dashboard",   tags=["Dashboard"])
