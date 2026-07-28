# Architecture Document
# Integrated Wearable Device for Rescue Personnel
## System Architecture & Technical Decisions

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WEARABLE LAYER                               │
│                                                                     │
│  ┌──────────────┐    I2C     ┌──────────────────┐    BLE           │
│  │ HELMET MOD   │◄──────────►│   CHEST MODULE   │◄──────────────► │
│  │ ESP32-C3     │            │   ESP32-S3       │    WRIST MOD     │
│  │              │            │                  │    ESP32-C3      │
│  │ MQ-7 (CO)    │            │ MAX30102 HR/SpO2 │                  │
│  │ MiCS (NO2)   │            │ DS18B20 Temp     │    MAX30102      │
│  │ MQ-135 (NH3) │            │ MPU6050 IMU      │    SSD1306 OLED  │
│  │ O2 Sensor    │            │ AD8232 ECG       │    Vibration     │
│  │ BME280       │            │ SX1276 LoRa      │    BLE           │
│  │ LED+Buzzer   │            │ FRAM+Flash       │                  │
│  └──────────────┘            │ TFLite RRI       │                  │
│                              │ LED+Buzzer       │                  │
│                              └────────┬─────────┘                  │
└───────────────────────────────────────┼─────────────────────────────┘
                          BLE │         │ LoRa
                              │         │
              ┌───────────────▼──┐    ┌─▼──────────────────────┐
              │  ANDROID APP     │    │   FIELD GATEWAY        │
              │  (Personal GW)   │    │   RPi4 + SX1276        │
              │                  │    │                        │
              │  BLE Scanner     │    │  LoRa RX               │
              │  Local Dashboard │    │  MQTT Uplink           │
              │  Offline Storage │    │  GPS Positioning       │
              │  Alert Push      │    │  Edge Caching          │
              └────────┬─────────┘    └──────────┬─────────────┘
                WiFi/  │  4G/5G                  │  Internet
                       │                         │
              ┌─────────▼─────────────────────────▼─────────────┐
              │                    CLOUD                         │
              │                                                  │
              │  MQTT Broker (Mosquitto)                         │
              │  FastAPI Backend                                 │
              │  PostgreSQL + TimescaleDB                        │
              │  Redis (caching, pub/sub)                        │
              │  React Dashboard (WebSocket)                     │
              │  Firebase (Android push notifications)           │
              └──────────────────────────────────────────────────┘
```

---

## 2. Key Architectural Decisions

### 2.1 Why ESP32-S3 for Chest Module?
**Decision:** Use ESP32-S3 (not ESP32 or ESP32-C3) for the chest module.

**Reasons:**
- 512KB SRAM + 8MB PSRAM — enough for TFLite tensor arena
- Xtensa LX7 dual-core at 240MHz — sufficient for real-time ML inference
- Built-in BLE 5.0 — no external BLE module needed
- SPI/I2C/UART all available — can communicate with all sensor types
- Vector extensions for faster floating-point ops

**Alternative considered:** STM32 H7 — more powerful but more expensive, harder to program, no BLE.

### 2.2 Why TFLite Micro (not ONNX/other)?
**Decision:** Use TensorFlow Lite Micro for edge AI inference.

**Reasons:**
- Native support for ESP32 via Arduino library
- int8 quantization reduces model to ~20-50KB
- No dynamic memory allocation — all tensors pre-allocated
- Inference time: ~3-8ms on ESP32-S3
- Active community + official Espressif support

**Alternative considered:** Edge Impulse — great tooling but less control over model architecture.

### 2.3 Why LoRa for backup communication?
**Decision:** Use SX1276 LoRa at 433 MHz as resilient backup.

**Reasons:**
- Range: 1-5km urban, 10-15km LoS
- Penetrates buildings and rubble better than WiFi
- Low power: ~100mA TX, ~11mA RX
- Works without infrastructure (no tower needed)
- Spreading factor 9-12 for maximum range vs. throughput tradeoff

**Limitation:** Low data rate (~5 kbps), so compact JSON payloads only.

### 2.4 Why TimescaleDB over plain PostgreSQL?
**Decision:** Use TimescaleDB extension.

**Reasons:**
- Automatic time-series partitioning (hypertables)
- Built-in downsampling (continuous aggregates)
- 90%+ compression on time-series data
- Compatible with standard SQL and SQLAlchemy
- Fast time-range queries for dashboard charts

### 2.5 Why FastAPI over Django?
**Decision:** FastAPI for backend.

**Reasons:**
- Native async support (crucial for WebSocket + MQTT concurrent handling)
- Automatic OpenAPI docs
- Pydantic validation = schema-first development
- ~3x faster than Django for async workloads
- Lightweight — easy to deploy

---

## 3. Data Flow Diagram

```
Sensor (physical) 
    │
    ▼
ESP32 ADC / I2C / UART
    │
    ▼
Signal Processing (ESP32 firmware)
  • Kalman filter for noise reduction
  • Peak detection for HRV
  • Moving average for stability
    │
    ▼
Feature Extraction
  • Heart Rate (bpm)
  • HRV RMSSD (ms)
  • SpO2 (%)
  • Respiration Rate (bpm)
  • Body Temperature (°C)
  • Gas Exposure Index (0-1)
  • Motion Intensity (0-1)
  • Mission Duration (normalized)
    │
    ▼
TFLite Micro Inference (ESP32-S3)
  • Normalize features to [0,1]
  • Run int8 quantized model
  • Output: RRI (0-1), Risk Level (0-3)
  • Inference time: ~3-8ms
    │
    ├──► Local Alert (LED, Buzzer, Vibration)
    │
    ├──► BLE Notify → Android App
    │
    └──► LoRa TX (compact JSON) → Gateway → Cloud
              │
              ▼
        MQTT Broker
              │
        ┌─────┴─────┐
        ▼           ▼
    FastAPI       TimescaleDB
    Consumer      Time-series storage
        │              │
        ▼              ▼
    Alert Engine   WebSocket Push
    Rule checks    → React Dashboard
    Generate Alerts→ Commander view
```

---

## 4. TinyML Pipeline

```
RAW DATA COLLECTION
(Sensor Simulator → DB)
        │
        ▼
FEATURE ENGINEERING
(Python: Pandas, NumPy)
        │
        ▼
MODEL TRAINING
(TensorFlow: Dual-head NN)
  • RRI regression head (sigmoid)
  • Risk classification head (softmax x4)
        │
        ▼
EVALUATION
(MAE, R², classification report)
        │
        ▼
TFLITE CONVERSION
(int8 quantization)
        │
        ▼
C ARRAY EXPORT
(rri_model.cc, rri_model.h)
        │
        ▼
FLASH TO ESP32-S3
(PlatformIO upload)
        │
        ▼
EDGE INFERENCE
(TFLite Micro, ~5ms/inference)
```

---

## 5. Communication Protocol Decision Tree

```
Is BLE available AND responder in range of smartphone?
  YES → Use BLE (2s interval, low latency)
  NO  →
    Is LoRa gateway in range?
      YES → Use LoRa (10s interval, compact payload)
      NO  →
        Store to FRAM/Flash (offline mode)
        When connectivity restored → sync to cloud
```

---

## 6. Alert Priority Matrix

| Condition | Threshold | Severity | Action |
|-----------|-----------|----------|--------|
| CO > 50 ppm | PEL | CRITICAL | LED Red + Buzzer + Cloud |
| O2 < 16% | IDLH | CRITICAL | LED Red + Buzzer + Cloud |
| SpO2 < 90% | Clinical | CRITICAL | LED Red + Buzzer + Cloud |
| RRI > 0.8 | Model | CRITICAL | All alerts |
| CO > 25 ppm | Half-PEL | WARNING | LED Orange + Cloud |
| SpO2 < 94% | Warning | WARNING | LED Orange + Cloud |
| HR > 160 | Physiological | WARNING | Cloud only |
| RRI 0.6-0.8 | Model | WARNING | LED Orange + Cloud |
| CO > 10 ppm | Elevated | CAUTION | LED Yellow |
| RRI 0.3-0.6 | Model | CAUTION | LED Yellow |

---

## 7. Power Budget

| Module | Active Power | Sleep Power | Battery Life |
|--------|-------------|-------------|--------------|
| Chest (3000mAh) | ~250mA (LoRa TX bursts) | ~15mA | ~8-10 hours |
| Helmet (2000mAh) | ~180mA (heater + MCU) | ~10mA | ~6-8 hours |
| Wrist (400mAh) | ~60mA | ~5mA | ~4-5 hours |

**Power Optimization Strategies:**
- LoRa: Duty cycle TX (10s intervals) vs. continuous
- MQ sensors: Pre-warm only when CO/NH3 not baseline
- BLE: 2s notify interval (not continuous)
- MCU: Deep sleep between sensor reads
- MAX30102: Power-down between measurements
