"""
Rescue Risk Index (RRI) Model Training Pipeline
================================================
Trains a multi-output classifier for:
  - RRI regression (0-1)
  - Fatigue classification (binary)
  - Risk level classification (4-class)

Architecture:
  - Feature engineering from 8 raw inputs
  - Model: Random Forest + XGBoost ensemble → TensorFlow → TFLite
  - Export: .tflite + C byte array for ESP32 deployment

Inputs (normalized):
  1. Heart Rate (bpm)
  2. SpO2 (%)
  3. HRV RMSSD (ms)
  4. Respiration Rate (breaths/min)
  5. Body Temperature (°C)
  6. Gas Exposure Index (0-1)
  7. Motion Intensity (0-1)
  8. Mission Duration (normalized hours)

Output:
  - RRI: 0-1 continuous
  - Risk Level: [0=normal, 1=caution, 2=warning, 3=critical]
"""

import os
import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, r2_score, classification_report
import joblib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rri_trainer")

BASE_DIR   = Path(__file__).parent.parent
DATA_DIR   = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models" / "saved"
TFLITE_DIR = BASE_DIR / "models" / "tflite"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
TFLITE_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Synthetic Dataset Generation
# (Replace with real data from sensor_simulator/database export)
# ─────────────────────────────────────────────────────────────────────────────

def generate_synthetic_dataset(n_samples: int = 50000) -> pd.DataFrame:
    """
    Generate physiologically realistic synthetic dataset.
    
    Distribution:
      - 50% Normal scenarios (light activity, clean air)
      - 25% Caution scenarios (moderate fatigue OR minor gas exposure)
      - 15% Warning scenarios (high fatigue AND moderate gas)
      - 10% Critical scenarios (gas poisoning, SpO2 drop, collapse risk)
    """
    logger.info(f"Generating {n_samples} synthetic samples...")
    np.random.seed(42)

    rows = []
    for i in range(n_samples):
        # Select scenario
        p = np.random.random()
        if p < 0.50:
            scenario = "normal"
        elif p < 0.75:
            scenario = "caution"
        elif p < 0.90:
            scenario = "warning"
        else:
            scenario = "critical"

        # ── NORMAL ────────────────────────────────────────
        if scenario == "normal":
            hr    = np.random.normal(80,  10)
            spo2  = np.random.normal(98,  0.5)
            hrv   = np.random.normal(45,  8)
            rr    = np.random.normal(16,  2)
            temp  = np.random.normal(37,  0.3)
            gei   = np.random.uniform(0,  0.15)
            motion = np.random.uniform(0.1, 0.5)
            dur   = np.random.uniform(0,  2)    # hours
            rri_label = np.random.uniform(0.0, 0.28)

        # ── CAUTION ───────────────────────────────────────
        elif scenario == "caution":
            hr    = np.random.normal(110, 15)
            spo2  = np.random.normal(96,  1.0)
            hrv   = np.random.normal(28,  5)
            rr    = np.random.normal(20,  3)
            temp  = np.random.normal(37.8, 0.4)
            gei   = np.random.uniform(0.1, 0.35)
            motion = np.random.uniform(0.3, 0.7)
            dur   = np.random.uniform(1,  4)
            rri_label = np.random.uniform(0.30, 0.58)

        # ── WARNING ───────────────────────────────────────
        elif scenario == "warning":
            hr    = np.random.normal(140, 15)
            spo2  = np.random.normal(93,  1.5)
            hrv   = np.random.normal(15,  4)
            rr    = np.random.normal(25,  3)
            temp  = np.random.normal(38.5, 0.5)
            gei   = np.random.uniform(0.3, 0.6)
            motion = np.random.uniform(0.5, 0.9)
            dur   = np.random.uniform(2,  6)
            rri_label = np.random.uniform(0.60, 0.78)

        # ── CRITICAL ──────────────────────────────────────
        else:
            hr    = np.random.normal(170, 20)
            spo2  = np.random.normal(88,  3)
            hrv   = np.random.normal(8,   3)
            rr    = np.random.normal(30,  5)
            temp  = np.random.normal(39.5, 0.8)
            gei   = np.random.uniform(0.5, 1.0)
            motion = np.random.uniform(0.7, 1.0)
            dur   = np.random.uniform(3,  8)
            rri_label = np.random.uniform(0.80, 1.0)

        # Clip to physiological ranges
        hr    = np.clip(hr,   40,  220)
        spo2  = np.clip(spo2, 70,  100)
        hrv   = np.clip(hrv,  0,   120)
        rr    = np.clip(rr,   8,   50)
        temp  = np.clip(temp, 35,  42)
        gei   = np.clip(gei,  0,   1)
        motion = np.clip(motion, 0, 1)
        dur   = np.clip(dur,  0,   12)
        rri_label = np.clip(rri_label, 0, 1)

        # Risk level label
        if rri_label < 0.3:
            risk_level = 0  # normal
        elif rri_label < 0.6:
            risk_level = 1  # caution
        elif rri_label < 0.8:
            risk_level = 2  # warning
        else:
            risk_level = 3  # critical

        rows.append({
            "heart_rate":       hr,
            "spo2":             spo2,
            "hrv_ms":           hrv,
            "respiration_rate": rr,
            "body_temp_c":      temp,
            "gas_exposure_index": gei,
            "motion_intensity": motion,
            "duration_hours":   dur,
            "rri":              rri_label,
            "risk_level":       risk_level,
            "scenario":         scenario,
        })

    df = pd.DataFrame(rows)
    logger.info(f"Dataset shape: {df.shape}")
    logger.info(f"Risk distribution:\n{df['risk_level'].value_counts().sort_index()}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Feature Engineering
# ─────────────────────────────────────────────────────────────────────────────

FEATURE_COLS = [
    "heart_rate", "spo2", "hrv_ms", "respiration_rate",
    "body_temp_c", "gas_exposure_index", "motion_intensity", "duration_hours"
]

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


def normalize_features(df: pd.DataFrame) -> tuple[np.ndarray, MinMaxScaler]:
    """Normalize features to [0, 1] using physiological min/max ranges."""
    scaler = MinMaxScaler()
    # Set known feature range limits
    mins = [FEATURE_RANGES[col][0] for col in FEATURE_COLS]
    maxs = [FEATURE_RANGES[col][1] for col in FEATURE_COLS]
    scaler.fit(np.array([mins, maxs]))

    X = scaler.transform(df[FEATURE_COLS].values)
    return X, scaler


# ─────────────────────────────────────────────────────────────────────────────
# Step 3: TensorFlow Model (optimized for TFLite conversion)
# ─────────────────────────────────────────────────────────────────────────────

def build_rri_model(input_dim: int = 8) -> keras.Model:
    """
    Dual-head neural network:
      - Head 1: RRI regression (Dense → linear output)
      - Head 2: Risk classification (Dense → softmax 4-class)
    
    Architecture designed for TFLite Micro deployment on ESP32-S3 (8MB PSRAM).
    Model size target: <50KB quantized.
    """
    inputs = keras.Input(shape=(input_dim,), name="sensor_features")

    # Shared feature extractor
    x = layers.Dense(32, activation="relu", name="shared_1")(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(64, activation="relu", name="shared_2")(x)
    x = layers.Dropout(0.2)(x)
    x = layers.Dense(32, activation="relu", name="shared_3")(x)

    # RRI regression head
    rri_head = layers.Dense(16, activation="relu", name="rri_dense")(x)
    rri_output = layers.Dense(1, activation="sigmoid", name="rri_output")(rri_head)

    # Risk classification head
    risk_head = layers.Dense(16, activation="relu", name="risk_dense")(x)
    risk_output = layers.Dense(4, activation="softmax", name="risk_output")(risk_head)

    model = keras.Model(inputs=inputs, outputs={"rri_output": rri_output, "risk_output": risk_output})

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss={
            "rri_output":  "mse",
            "risk_output": "sparse_categorical_crossentropy",
        },
        loss_weights={"rri_output": 1.0, "risk_output": 0.5},
        metrics={
            "rri_output":  ["mae"],
            "risk_output": ["accuracy"],
        }
    )
    return model


# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Train Model
# ─────────────────────────────────────────────────────────────────────────────

def train_model(df: pd.DataFrame, scaler: MinMaxScaler, X: np.ndarray) -> keras.Model:
    y_rri  = df["rri"].values.astype(np.float32)
    y_risk = df["risk_level"].values.astype(np.int32)

    X_train, X_test, yr_train, yr_test, yk_train, yk_test = train_test_split(
        X, y_rri, y_risk, test_size=0.2, random_state=42, stratify=y_risk
    )

    model = build_rri_model(input_dim=X.shape[1])
    model.summary()

    callbacks = [
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5),
        keras.callbacks.ModelCheckpoint(
            str(MODELS_DIR / "rri_model_best.keras"),
            monitor="val_loss", save_best_only=True
        ),
    ]

    history = model.fit(
        X_train,
        {"rri_output": yr_train, "risk_output": yk_train},
        validation_data=(X_test, {"rri_output": yr_test, "risk_output": yk_test}),
        epochs=100,
        batch_size=256,
        callbacks=callbacks,
        verbose=1,
    )

    # Evaluate
    logger.info("\n📊 Evaluation on test set:")
    preds = model.predict(X_test, verbose=0)
    rri_pred = preds["rri_output"].flatten()
    risk_pred = np.argmax(preds["risk_output"], axis=1)

    mae = mean_absolute_error(yr_test, rri_pred)
    r2  = r2_score(yr_test, rri_pred)
    logger.info(f"RRI MAE: {mae:.4f}, R²: {r2:.4f}")
    logger.info(f"\nRisk Classification Report:\n{classification_report(yk_test, risk_pred, target_names=['Normal','Caution','Warning','Critical'])}")

    return model


# ─────────────────────────────────────────────────────────────────────────────
# Step 5: Convert to TFLite (int8 quantized for ESP32)
# ─────────────────────────────────────────────────────────────────────────────

def export_tflite(model: keras.Model, X_sample: np.ndarray):
    """Export quantized TFLite model for ESP32 deployment."""
    logger.info("Converting to TFLite (int8 quantized)...")

    def representative_dataset():
        for i in range(min(1000, len(X_sample))):
            yield [X_sample[i:i+1].astype(np.float32)]

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type  = tf.float32
    converter.inference_output_type = tf.float32

    tflite_model = converter.convert()

    tflite_path = TFLITE_DIR / "rri_model_int8.tflite"
    tflite_path.write_bytes(tflite_model)
    logger.info(f"✅ TFLite model saved: {tflite_path} ({len(tflite_model) / 1024:.1f} KB)")

    # Export C byte array for ESP32 embedding
    export_c_array(tflite_model)

    return tflite_path


def export_c_array(tflite_model: bytes):
    """Generate C header file for direct embedding in ESP32 firmware."""
    c_array_path = TFLITE_DIR / "rri_model.cc"
    header_path  = TFLITE_DIR / "rri_model.h"

    hex_array = ", ".join(f"0x{b:02x}" for b in tflite_model)

    c_content = f"""// Auto-generated TFLite model for ESP32
// Model: RRI Predictor v1.0
// Size: {len(tflite_model)} bytes
// Generated by: ml/training/train_rri_model.py

#include "rri_model.h"

const unsigned char rri_model_data[] = {{
  {hex_array}
}};
const unsigned int rri_model_data_len = {len(tflite_model)};
"""
    h_content = """#ifndef RRI_MODEL_H
#define RRI_MODEL_H

extern const unsigned char rri_model_data[];
extern const unsigned int  rri_model_data_len;

#endif // RRI_MODEL_H
"""
    c_array_path.write_text(c_content)
    header_path.write_text(h_content)
    logger.info(f"✅ C array exported: {c_array_path}")
    logger.info(f"✅ Header exported:  {header_path}")


# ─────────────────────────────────────────────────────────────────────────────
# Step 6: Save Scaler for Firmware Reference
# ─────────────────────────────────────────────────────────────────────────────

def save_artifacts(model: keras.Model, scaler: MinMaxScaler):
    model.save(str(MODELS_DIR / "rri_model_final.keras"))
    joblib.dump(scaler, str(MODELS_DIR / "feature_scaler.pkl"))

    # Save scaler params as JSON for firmware hardcoding
    scaler_params = {
        "feature_names": FEATURE_COLS,
        "feature_min":   [FEATURE_RANGES[c][0] for c in FEATURE_COLS],
        "feature_max":   [FEATURE_RANGES[c][1] for c in FEATURE_COLS],
    }
    with open(str(MODELS_DIR / "scaler_params.json"), "w") as f:
        json.dump(scaler_params, f, indent=2)

    logger.info(f"✅ Model + scaler saved to: {MODELS_DIR}")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("  RRI MODEL TRAINING PIPELINE")
    logger.info("=" * 60)

    # 1. Generate data
    df = generate_synthetic_dataset(n_samples=50000)
    df.to_csv(DATA_DIR / "processed" / "rri_training_data.csv", index=False)

    # 2. Normalize
    X, scaler = normalize_features(df)

    # 3. Train
    model = train_model(df, scaler, X)

    # 4. Save artifacts
    save_artifacts(model, scaler)

    # 5. Export TFLite
    export_tflite(model, X[:1000])

    logger.info("=" * 60)
    logger.info("  TRAINING COMPLETE")
    logger.info("=" * 60)
