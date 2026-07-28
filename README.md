# 🚨 Integrated Wearable Device for Rescue Personnel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: ESP32](https://img.shields.io/badge/Platform-ESP32-blue.svg)](https://www.espressif.com/)
[![ML: TensorFlow Lite](https://img.shields.io/badge/ML-TensorFlow%20Lite-orange.svg)](https://tensorflow.org/lite)
[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI-green.svg)](https://fastapi.tiangolo.com/)

> **Real-Time Monitoring of Vital Parameters, Gas Exposure, and Fatigue Prediction for Rescue Personnel in Hazardous Environments**

---

## 📌 Project Summary

This system is a modular, AI-powered wearable platform designed for **firefighters, NDRF personnel, and emergency responders** operating in hazardous environments. It fuses physiological and environmental data to compute a real-time **Rescue Risk Index (RRI)** using TinyML on the edge.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LAYER 1: WEARABLE                    │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ HELMET MOD  │  │ CHEST MOD   │  │  WRIST MODULE  │  │
│  │ ESP32-C3    │  │ ESP32-S3    │  │  ESP32-C3      │  │
│  │ CO/NO2/NH3  │  │ MAX30102    │  │  MAX30102      │  │
│  │ O2/BME280   │  │ MPU6050     │  │  OLED          │  │
│  │ RGB LED     │  │ DS18B20     │  │  Vibration     │  │
│  │ Buzzer      │  │ SX1276 LoRa │  │  BLE           │  │
│  └──────┬──────┘  └──────┬──────┘  └───────┬────────┘  │
│         │    I2C/BLE     │      BLE         │           │
│         └────────────────┴──────────────────┘           │
└─────────────────────────────────────────────────────────┘
                            │ BLE
┌───────────────────────────▼─────────────────────────────┐
│              LAYER 2: PERSONAL GATEWAY                   │
│                  Android Smartphone                      │
│         BLE ← → App ← → WiFi/4G/5G → Cloud             │
└───────────────────────────┬─────────────────────────────┘
                            │ LoRa (backup)
┌───────────────────────────▼─────────────────────────────┐
│               LAYER 3: FIELD GATEWAY                     │
│          LoRa Gateway + Raspberry Pi                     │
└───────────────────────────┬─────────────────────────────┘
                            │ Internet
┌───────────────────────────▼─────────────────────────────┐
│                   LAYER 4: CLOUD                         │
│   FastAPI Backend ← MQTT → TimescaleDB → React Dashboard│
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
Responder-System/
├── backend/           # FastAPI REST + MQTT + WebSocket server
├── mobile/            # Android Kotlin app (BLE + offline sync)
├── dashboard/         # React web dashboard (real-time charts + maps)
├── database/          # PostgreSQL/TimescaleDB schema + migrations
├── gateway/           # Raspberry Pi LoRa gateway scripts
├── sensor_simulator/  # Python MQTT sensor data simulator
├── esp32/             # PlatformIO ESP32 firmware (3 modules)
├── ml/                # ML training pipeline + model export
├── firmware/          # Compiled TFLite models (.tflite + C arrays)
├── hardware/          # Schematics, BOM, PCB layout guides
└── docs/              # Architecture docs, UML, research notes, API spec
```

---

## 🚀 Quick Start (Simulation Mode)

### Prerequisites
- Python 3.10+
- Docker & Docker Compose
- Node.js 18+
- Android Studio (for mobile)

### 1. Start Infrastructure
```bash
cd Responder-System
docker-compose up -d
```

### 2. Run Sensor Simulator
```bash
cd sensor_simulator
pip install -r requirements.txt
python main.py
```

### 3. Start Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Start Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### 5. Train ML Model (optional)
```bash
cd ml
pip install -r requirements.txt
python training/train_rri_model.py
```

---

## 🧠 Rescue Risk Index (RRI)

The RRI is a normalized score (0–1) computed by a TinyML model fusing 8 input features:

| Feature | Source | Weight |
|---------|--------|--------|
| Heart Rate | MAX30102 | High |
| SpO2 | MAX30102 | Critical |
| HRV | Derived | High |
| Respiration Rate | Belt/IR | High |
| Body Temperature | DS18B20 | Medium |
| Gas Exposure Index | CO/NO2/NH3/O2 | Critical |
| Motion Intensity | MPU6050 | Medium |
| Mission Duration | System Clock | High |

| RRI Range | Status | Action |
|-----------|--------|--------|
| 0.0 – 0.3 | 🟢 Normal | Monitor |
| 0.3 – 0.6 | 🟡 Caution | Warn responder |
| 0.6 – 0.8 | 🟠 Warning | Alert supervisor |
| 0.8 – 1.0 | 🔴 Critical | Evacuate immediately |

---

## 📡 Communication Stack

| Link | Protocol | Fallback |
|------|----------|----------|
| Helmet ↔ Chest | I2C / BLE | — |
| Chest ↔ Wrist | BLE | — |
| Chest ↔ Smartphone | BLE | — |
| Smartphone ↔ Cloud | WiFi / 4G / 5G | LoRa |
| Chest ↔ Field Gateway | LoRa (SX1276) | — |
| Field Gateway ↔ Cloud | MQTT over Internet | — |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Firmware | C/C++ · PlatformIO · Arduino Framework |
| Edge AI | TensorFlow Lite Micro (TinyML) |
| Backend | FastAPI · Python · MQTT (Paho) |
| Database | PostgreSQL · TimescaleDB · Redis |
| Dashboard | React · Recharts · Leaflet |
| Mobile | Android · Kotlin · BLE |
| Gateway | Python · Raspberry Pi OS |
| Simulator | Python · Paho-MQTT · NumPy |
| DevOps | Docker · Docker Compose |

---

## 👥 Module Responsibilities

| Module | Controller | Role |
|--------|-----------|------|
| Helmet | ESP32-C3 | Gas sensing + environmental alerts |
| Chest | ESP32-S3 | Vitals + LoRa + TinyML RRI computation |
| Wrist | ESP32-C3 | SpO2 display + vibration alerts |

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

## 🔬 Research Context

This project targets publication in:
- IEEE Sensors Journal
- Elsevier Computers in Biology and Medicine
- MDPI Sensors

**Keywords:** TinyML, Edge AI, Wearable Health Monitoring, Rescue Robotics, Fatigue Prediction, Gas Exposure, IoT, LoRa, ESP32
