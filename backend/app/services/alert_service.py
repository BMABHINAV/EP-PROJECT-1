"""
Alert evaluation service.
Applies rule-based checks + RRI threshold logic with intelligent debouncing.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from app.core.config import settings
from app.db.models.models import Alert

logger = logging.getLogger(__name__)


async def evaluate_and_raise_alerts(db, responder, data_type: str, data: dict):
    """
    Evaluate incoming sensor data against thresholds and raise alerts.
    Includes a 60-second cooldown per alert_type per responder to prevent alert flooding.
    """
    alerts_to_create = []

    if data_type == "vitals":
        spo2 = data.get("spo2", 100)
        hr   = data.get("heart_rate", 70)
        temp = data.get("body_temp_c", 37)

        if spo2 < settings.SPO2_LOW_PCT:
            alerts_to_create.append({
                "alert_type": "spo2_drop",
                "severity":   "warning",
                "message":    f"SpO2 critically low: {spo2:.1f}% (threshold: {settings.SPO2_LOW_PCT}%)",
                "rri":        None,
            })

        if hr > settings.HR_HIGH_BPM:
            alerts_to_create.append({
                "alert_type": "high_hr",
                "severity":   "warning",
                "message":    f"Elevated heart rate: {hr:.0f} bpm",
                "rri":        None,
            })

        if temp > settings.BODY_TEMP_HIGH_C:
            alerts_to_create.append({
                "alert_type": "high_body_temp",
                "severity":   "warning",
                "message":    f"High body temperature: {temp:.1f}°C (heat exhaustion risk)",
                "rri":        None,
            })

    elif data_type == "gas":
        co    = data.get("co_ppm", 0)
        no2   = data.get("no2_ppm", 0)
        nh3   = data.get("nh3_ppm", 0)
        o2    = data.get("o2_percent", 20.9)

        if co > settings.CO_DANGER_PPM:
            alerts_to_create.append({
                "alert_type": "co_poisoning",
                "severity":   "critical",
                "message":    f"Dangerous CO level: {co:.1f} ppm — evacuate immediately!",
                "rri":        None,
            })

        if no2 > settings.NO2_DANGER_PPM:
            alerts_to_create.append({
                "alert_type": "no2_exposure",
                "severity":   "warning",
                "message":    f"NO2 exposure: {no2:.2f} ppm above safe limit ({settings.NO2_DANGER_PPM} ppm)",
                "rri":        None,
            })

        if o2 < settings.O2_LOW_PCT:
            alerts_to_create.append({
                "alert_type": "low_oxygen",
                "severity":   "critical",
                "message":    f"Oxygen depleted: {o2:.1f}% — IDLH conditions!",
                "rri":        None,
            })

        if nh3 > settings.NH3_DANGER_PPM:
            alerts_to_create.append({
                "alert_type": "nh3_exposure",
                "severity":   "critical",
                "message":    f"Ammonia exposure: {nh3:.0f} ppm — IDLH risk!",
                "rri":        None,
            })

    if not alerts_to_create:
        return

    # Check for duplicate unacknowledged active alert in the last 60 seconds
    cutoff = datetime.utcnow() - timedelta(seconds=60)
    created_alerts = []

    for alert_data in alerts_to_create:
        stmt = select(Alert).where(
            and_(
                Alert.responder_id == responder.id,
                Alert.alert_type == alert_data["alert_type"],
                Alert.acknowledged == False,
                Alert.time >= cutoff
            )
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            continue  # Cooldown active, skip duplicate alert

        alert = Alert(
            responder_id = responder.id,
            alert_type   = alert_data["alert_type"],
            severity     = alert_data["severity"],
            message      = alert_data["message"],
            rri_at_alert = alert_data.get("rri"),
            time         = datetime.utcnow(),
        )
        db.add(alert)
        created_alerts.append((alert, alert_data))

    if created_alerts:
        await db.commit()
        from app.api.websocket import ws_manager
        for alert_obj, alert_data in created_alerts:
            await db.refresh(alert_obj)
            logger.warning(f"[ALERT] {alert_data['severity'].upper()} — {responder.badge_id}: {alert_data['message']}")
            await ws_manager.broadcast("alert_triggered", {
                "id": str(alert_obj.id),
                "badge_id": responder.badge_id,
                "alert_type": alert_data["alert_type"],
                "severity": alert_data["severity"],
                "message": alert_data["message"],
                "rri_at_alert": alert_data.get("rri"),
                "time": alert_obj.time.isoformat()
            })


async def compute_rri_server_side(vitals: dict, gas: dict, motion: dict, duration_min: float) -> float:
    """
    Server-side RRI computation (fallback when edge inference not available).
    """
    rri = 0.05

    hr = vitals.get("heart_rate", 70)
    if hr > 160: rri += 0.35
    elif hr > 130: rri += 0.20
    elif hr > 100: rri += 0.10

    spo2 = vitals.get("spo2", 98)
    if spo2 < 90: rri += 0.40
    elif spo2 < 94: rri += 0.20

    co = gas.get("co_ppm", 0)
    if co > 100: rri += 0.35
    elif co > 50: rri += 0.20
    elif co > 25: rri += 0.10

    if duration_min > 90: rri += 0.20
    elif duration_min > 60: rri += 0.10

    return min(1.0, round(rri, 3))
