"""
RRI service — server-side Rescue Risk Index computation.
Used as fallback when edge TFLite inference result is unavailable.
"""


def compute_rri_from_data(vitals: dict, gas: dict, duration_min: float = 0) -> float:
    """
    Rule-based RRI approximation (server side).
    Mirrors the TinyML model logic running on ESP32.
    """
    score = 0.0

    spo2 = vitals.get("spo2", 98)
    if spo2 < 90:   score += 0.25
    elif spo2 < 94: score += 0.15
    elif spo2 < 96: score += 0.05

    hr = vitals.get("heart_rate", 70)
    if hr > 180:   score += 0.15
    elif hr > 160: score += 0.10
    elif hr > 140: score += 0.05

    hrv = vitals.get("hrv_ms", 45)
    if hrv < 10:   score += 0.10
    elif hrv < 20: score += 0.06
    elif hrv < 30: score += 0.02

    gei = gas.get("gas_exposure_index", 0)
    score += gei * 0.25

    o2 = gas.get("o2_percent", 20.9)
    if o2 < 16:    score += 0.10
    elif o2 < 19.5: score += 0.05

    temp = vitals.get("body_temp_c", 37)
    if temp > 40:    score += 0.05
    elif temp > 38.5: score += 0.03

    dur_h = duration_min / 60.0
    if dur_h > 4:   score += 0.10
    elif dur_h > 2: score += 0.06
    elif dur_h > 1: score += 0.03

    return min(score, 1.0)
