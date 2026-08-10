# 🚨 Responder System - Project Overview & Implementation Status

## 📌 Executive Summary

The **Responder System** is an integrated IoT and Edge-AI wearable platform engineered for firefighters, NDRF personnel, and emergency responders operating in high-risk, hazardous environments. The system continuously collects physiological vitals and environmental hazard data, computes a real-time **Rescue Risk Index (RRI)** via TinyML models running directly on edge devices (ESP32), and streams live telemetry to a central incident command dashboard.

---

## 🏗️ System Architecture & Layer Breakdown

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: WEARABLE EDGE                          │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────┐  │
│  │   HELMET MODULE    │  │    CHEST MODULE    │  │   WRIST MODULE   │  │
│  │     ESP32-C3       │  │     ESP32-S3       │  │     ESP32-C3     │  │
│  │ CO / NO2 / NH3 / O2│  │ MAX30102 / MPU6050 │  │ Display / SpO2   │  │
│  └─────────┬──────────┘  └─────────┬──────────┘  └────────┬─────────┘  │
└────────────┼───────────────────────┼──────────────────────┼────────────┘
             │                       │                      │
             └───────────────────────┴──────────────────────┘
                                     │ BLE / LoRa
┌────────────────────────────────────▼───────────────────────────────────┐
│                      LAYER 2 & 3: GATEWAY STACK                        │
│    Smartphone Mobile App (BLE)  /  Field Gateway (Raspberry Pi LoRa)   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ MQTT / HTTPS
┌────────────────────────────────────▼───────────────────────────────────┐
│                       LAYER 4: CLOUD PLATFORM                          │
│        FastAPI Server  │  TimescaleDB  │  MQTT  │  React Dashboard     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 Rescue Risk Index (RRI) Matrix

The Rescue Risk Index (RRI) is a normalized score (0.0 to 1.0) derived by fusing 8 physiological and environmental parameters:

| Feature | Source | Criticality |
|---|---|---|
| **Heart Rate** | MAX30102 Pulse Oximeter | High |
| **SpO2 Level** | MAX30102 Pulse Oximeter | Critical |
| **HRV (Heart Rate Variability)** | Derived Vitals | High |
| **Respiration Rate** | Chest Sensor / IR | High |
| **Body Temperature** | DS18B20 Sensor | Medium |
| **Gas Exposure Index** | Helmet Module (CO/NO2/NH3/O2) | Critical |
| **Motion / Activity** | MPU6050 Accelerometer/Gyro | Medium |
| **Mission Duration** | System Clock / Active Telemetry | High |

### RRI Alert Levels & Protocol
- 🟢 **0.0 – 0.3 (Normal)**: Safe condition; standard telemetry logging.
- 🟡 **0.3 – 0.6 (Caution)**: Elevating strain; warning sent to responder.
- 🟠 **0.6 – 0.8 (Warning)**: Severe stress/gas exposure; alert escalated to field supervisor.
- 🔴 **0.8 – 1.0 (Critical)**: Imminent threat/collapse risk; immediate evacuation order triggered.

---

## 🛠️ Technology Stack

| Domain | Technologies |
|---|---|
| **Firmware & Edge** | C / C++ · PlatformIO · ESP-IDF / Arduino Framework · TFLite Micro |
| **Backend API & IoT** | Python 3.10+ · FastAPI · MQTT (Paho-MQTT) · WebSockets · SQLite / TimescaleDB |
| **Frontend Dashboard** | React 18 · Vite · Tailwind CSS · Recharts · Leaflet Maps |
| **Machine Learning** | PyTorch / TensorFlow · Scikit-Learn · NumPy · Pandas · TFLite Converter |
| **Mobile App** | React Native / Android Kotlin (`ResQResponder`) |
| **DevOps & Infrastructure** | Docker · Docker Compose · Mosquitto MQTT Broker |

---

## ✅ Implementation Status (What is Implemented)

### 1. ⚙️ Backend Platform (`/backend`)
- **FastAPI REST API Server**: Implemented structured API routers (`v1/endpoints/`) covering:
  - `vitals.py`: Endpoint for pulling responder heart rate, SpO2, temperature, and HRV records.
  - `gas.py`: Endpoint for hazardous gas levels (CO, NO2, NH3, O2).
  - `alerts.py`: Critical threshold & RRI warning generation endpoint.
  - `predictions.py`: AI predictions & fatigue forecasting.
  - `responders.py`: Responder status, assignment, and profile management.
  - `missions.py`: Mission dispatch and responder group tracking.
  - `dashboard.py`: Consolidated summary metrics for real-time overview.
- **Real-Time Data Layer**:
  - WebSocket hub (`websocket.py`) pushing live telemetry updates directly to connected dashboard clients.
  - MQTT Ingestion Service receiving incoming topic metrics from sensors/simulators.
  - Database schema & active local database (`responder_dev.db`).

### 2. 📊 Web Dashboard (`/dashboard`)
- **React 18 + Vite Web Application**:
  - `DashboardPage.jsx`: Real-time status cards, responder health matrix, active alerts feed, and telemetry trends.
  - `LiveMapPage.jsx`: Interactive map tracking responder GPS coordinates in real-time.
  - `AnalyticsPage.jsx`: Historical analytics, trend line graphs for vitals and gas exposure.
  - `AIPredictionsPage.jsx`: Visualizations of TinyML RRI scores, fatigue predictions, and risk vectors.
  - `AlertsPage.jsx`: Dedicated alert filter, classification, and resolution interface.
  - `RespondersPage.jsx` & `MissionPage.jsx`: Unit management and operational mission controls.
  - Custom UI Components & Alert Toasts (`components/ui/AlertToast.jsx`).

### 3. 🤖 Machine Learning Pipeline (`/ml`)
- **RRI Model Training**: Python training pipeline script (`train_rri_model.py`) that handles synthetic data generation, feature scaling, model training, evaluation metrics, and TFLite model serialization for microcontroller deployment.

### 4. 📡 Sensor Simulator (`/sensor_simulator`)
- **Multi-Responder Simulator (`main.py`)**: Python simulation engine generating realistic responder physiological drift, toxic gas spikes, motion events, and publishing directly over MQTT to test end-to-end telemetry pipelines.

### 5. 🔌 Edge Hardware Firmware (`/esp32`)
- **Chest Module Firmware (`esp32/chest_module/src/main.cpp`)**: Complete PlatformIO C++ source for heart rate, SpO2, motion sensing, LoRa packet formatting, and TinyML RRI inference.
- **Helmet Module Firmware (`esp32/helmet_module/src/main.cpp`)**: C++ source for gas sensor sampling (CO, NO2, NH3, O2), environmental telemetry, and local visual/auditory alert handling.

### 6. 📐 Hardware Documentation (`/hardware`)
- **Bill of Materials (`hardware/bom/hardware_bom.md`)**: Comprehensive component list including sensors, microcontrollers, communication ICs, and power management modules.

### 7. 🚀 Containerization & Launch Automation
- `docker-compose.yml`: Multi-container configuration for backend, dashboard, database, MQTT broker, and sensor simulator.
- `START_ALL.bat`: Single-click Windows startup script that launches all microservices and services simultaneously.

---

## ⏳ Pending / Future Work

1. **Wrist Module Firmware**: Finalizing display layout & vibration alert handler code (`esp32/wrist_module/src`).
2. **Mobile BLE Gateway App**: Extending `ResQResponder` React Native app for offline BLE-to-4G packet relaying.
3. **Hardware PCB Schematics**: Exporting final KiCad/Altium PCB Gerber files for wearable enclosures.
