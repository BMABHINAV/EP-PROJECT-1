"""
Alert evaluation service.
Applies rule-based checks + RRI threshold logic.
"""

import logging
from datetime import datetime
from app.core.config import settings
from app.db.models.models import Alert

logger = logging.getLogger(__name__)


async def evaluate_and_raise_alerts(db, responder, data_type: str, data: dict):
    """
    Evaluate incoming sensor data against thresholds and raise alerts.
    
    Rule-Based Alert Logic:
    ─────────────────────────────────────────────────
    VITALS:
      1. SpO2 < 94%                  → WARNING  → spo2_drop
      2. Heart Rate > 160 bpm        → WARNING  → high_hr
      3. Body Temp > 38.5°C          → WARNING  → high_body_temp

    GAS:
      4. CO > 50 ppm                 → CRITICAL → co_poisoning
      5. NO2 > 5 ppm                 → WARNING  → no2_exposure
      6. O2 < 19.5%                  → CRITICAL → low_oxygen
      7. NH3 > 300 ppm               → CRITICAL → nh3_exposure

    COMBINED:
      8. CO > 30 AND SpO2 decreasing → CRITICAL → co_poisoning_combo
      9. High RRI + high duration    → WARNING  → fatigue_risk
    ─────────────────────────────────────────────────
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

    # Persist all triggered alerts
    for alert_data in alerts_to_create:
        alert = Alert(
            responder_id = responder.id,
            alert_type   = alert_data["alert_type"],
            severity     = alert_data["severity"],
            message      = alert_data["message"],
            rri_at_alert = alert_data.get("rri"),
            time         = datetime.utcnow(),
        )
        db.add(alert)
        logger.warning(f"[ALERT] {alert_data['severity'].upper()} — {responder.badge_id}: {alert_data['message']}")

    if alerts_to_create:
        await db.commit()
        from app.api.websocket import ws_manager
        for alert in alerts_to_create:
            # We don't have the exact UUID here easily unless we retrieve it,
            # but we can push the payload to the UI which will refresh.
            await ws_manager.broadcast("alert_triggered", {
                "id": str(datetime.utcnow().timestamp()), # Temp ID for UI before refresh
                "badge_id": responder.badge_id,
                "alert_type": alert["alert_type"],
                "severity": alert["severity"],
                "message": alert["message"],
                "rri_at_alert": alert.get("rri"),
                "time": datetime.utcnow().isoformat()
            })


async def compute_rri_server_side(vitals: dict, gas: dict, motion: dict, duration_min: float) -> float:
    """
    Server-side RRI computation (fallback when edge inference not available).
    
    Simple weighted scoring rule until TinyML model is deployed.
    """
    score = 0.0

    # SpO2 contribution (critical weight)
    spo2 = vitals.get("spo2", 98)
    if spo2 < 90:
        score += 0.40
    elif spo2 < 94:
        score += 0.25
    elif spo2 < 96:
        score += 0.10

    # Heart rate contribution
    hr = vitals.get("heart_rate", 70)
    if hr > 180:
        score += 0.20
    elif hr > 160:
        score += 0.12
    elif hr > 140:
        score += 0.06

    # Gas exposure index
    gei = gas.get("gas_exposure_index", 0.0)
    score += gei * 0.25

    # O2 depletion
    o2 = gas.get("o2_percent", 20.9)
    if o2 < 16:
        score += 0.20
    elif o2 < 19.5:
        score += 0.10

    # Mission duration (hours)
    duration_h = duration_min / 60.0
    if duration_h > 4:
        score += 0.15
    elif duration_h > 2:
        score += 0.08

    # Body temp
    temp = vitals.get("body_temp_c", 37)
    if temp > 39.5:
        score += 0.10
    elif temp > 38.5:
        score += 0.05

    return min(score, 1.0)
