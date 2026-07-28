"""
ML-based RRI Service — uses the trained TensorFlow model for real inference.
Falls back to rule-based scoring if model not available.
"""
import os
import time
import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger("ml_rri")

BASE_DIR   = Path(__file__).parent.parent.parent.parent  # → Responder-System/
MODEL_PATH = BASE_DIR / "ml" / "models" / "saved" / "rri_model_final.keras"

# Feature normalization ranges (must match training)
FEATURE_RANGES = {
    "heart_rate":         (40,  220),
    "spo2":               (70,  100),
    "hrv_ms":             (0,   120),
    "respiration_rate":   (8,   50),
    "body_temp_c":        (35,  42),
    "gas_exposure_index": (0,   1),
    "motion_intensity":   (0,   1),
    "duration_hours":     (0,   12),
}
FEATURE_COLS = list(FEATURE_RANGES.keys())

RISK_LEVEL_MAP = {0: "normal", 1: "caution", 2: "warning", 3: "critical"}

_model = None
_model_loaded = False


def _load_model():
    global _model, _model_loaded
    if _model_loaded:
        return _model
    try:
        import tensorflow as tf
        if MODEL_PATH.exists():
            _model = tf.keras.models.load_model(str(MODEL_PATH))
            logger.info(f"✅ ML model loaded from {MODEL_PATH}")
        else:
            logger.warning(f"⚠ Model not found at {MODEL_PATH} — using rule-based fallback")
        _model_loaded = True
    except Exception as e:
        logger.error(f"❌ Failed to load ML model: {e}")
        _model_loaded = True  # mark as attempted so we don't retry every call
    return _model


def _normalize(features: dict) -> np.ndarray:
    """Normalize raw feature dict to [0,1] using physiological ranges."""
    row = []
    for col in FEATURE_COLS:
        val = features.get(col, 0.0)
        lo, hi = FEATURE_RANGES[col]
        normed = (float(val) - lo) / (hi - lo)
        row.append(float(np.clip(normed, 0.0, 1.0)))
    return np.array([row], dtype=np.float32)


def predict_rri(vitals: dict, gas: dict, duration_min: float = 0.0) -> dict:
    """
    Run RRI prediction using the trained neural network.
    
    Returns:
        dict with keys: rri (float 0-1), risk_level (str), 
                        fatigue_probability (float), inference_time_ms (float),
                        model_used (str)
    """
    # Build feature vector
    gei = gas.get("gas_exposure_index", 0.0)
    if gei == 0.0:
        # Compute GEI from raw gas values if not provided
        co  = gas.get("co_ppm",  0.0)
        no2 = gas.get("no2_ppm", 0.0)
        nh3 = gas.get("nh3_ppm", 0.0)
        o2  = gas.get("o2_percent", 20.9)
        gei = min(
            (co / 50.0) * 0.4 + (no2 / 5.0) * 0.3 + (nh3 / 300.0) * 0.1 + max(0, (20.9 - o2) / 5.0) * 0.2,
            1.0
        )

    features = {
        "heart_rate":         vitals.get("heart_rate",       75.0),
        "spo2":               vitals.get("spo2",             98.0),
        "hrv_ms":             vitals.get("hrv_ms",           45.0),
        "respiration_rate":   vitals.get("respiration_rate", 16.0),
        "body_temp_c":        vitals.get("body_temp_c",      37.0),
        "gas_exposure_index": gei,
        "motion_intensity":   vitals.get("motion_intensity", 0.3),
        "duration_hours":     duration_min / 60.0,
    }

    model = _load_model()
    t0 = time.perf_counter()

    if model is not None:
        try:
            X = _normalize(features)
            preds = model.predict(X, verbose=0)
            rri   = float(preds["rri_output"][0][0])
            risk_probs   = preds["risk_output"][0]
            risk_class   = int(np.argmax(risk_probs))
            risk_level   = RISK_LEVEL_MAP.get(risk_class, "normal")
            fatigue_prob = float(risk_probs[2] + risk_probs[3])  # warning + critical prob
            elapsed_ms   = (time.perf_counter() - t0) * 1000

            return {
                "rri":                 float(np.clip(rri, 0.0, 1.0)),
                "risk_level":          risk_level,
                "fatigue_probability": float(np.clip(fatigue_prob, 0.0, 1.0)),
                "inference_time_ms":   round(elapsed_ms, 2),
                "model_used":          "neural_network",
            }
        except Exception as e:
            logger.error(f"Model inference error: {e}")

    # ── Rule-based fallback ───────────────────────────────────────────
    from app.services.rri_service import compute_rri_from_data
    rri = compute_rri_from_data(vitals, gas, duration_min)
    risk_level = (
        "critical" if rri >= 0.8 else
        "warning"  if rri >= 0.6 else
        "caution"  if rri >= 0.3 else
        "normal"
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000
    return {
        "rri":                 rri,
        "risk_level":          risk_level,
        "fatigue_probability": min(rri * 1.2, 1.0),
        "inference_time_ms":   round(elapsed_ms, 2),
        "model_used":          "rule_based",
    }
