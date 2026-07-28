# API Reference
## ResQ Backend — REST + WebSocket

Base URL: `http://localhost:8000`

---

## Authentication
Currently open (add JWT in production via `/api/v1/auth/token`).

---

## REST Endpoints

### Responders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/responders/` | List all active responders |
| POST | `/api/v1/responders/` | Register new responder |
| GET | `/api/v1/responders/{id}` | Get responder by UUID |
| GET | `/api/v1/responders/badge/{badge_id}` | Get responder by badge ID |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/summary` | Command center KPIs |
| GET | `/api/v1/dashboard/responder-cards` | Live status cards |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/alerts/` | List alerts (filter: acknowledged, severity) |
| PATCH | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert |
| PATCH | `/api/v1/alerts/{id}/resolve` | Resolve alert |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

---

## WebSocket

### Dashboard WebSocket
`ws://localhost:8000/ws/dashboard`

**Events (Server → Client):**

```json
// Vitals update
{ "type": "vitals_update", "data": {
    "badge_id": "NDRF-001",
    "heart_rate": 85.2,
    "spo2": 97.5,
    "hrv_ms": 42.1,
    "respiration_rate": 18.0,
    "body_temp_c": 37.2
}}

// Gas update
{ "type": "gas_update", "data": {
    "badge_id": "NDRF-001",
    "co_ppm": 12.5,
    "no2_ppm": 0.8,
    "nh3_ppm": 15.0,
    "o2_percent": 20.5,
    "gas_exposure_index": 0.08
}}

// RRI update
{ "type": "rri_update", "data": {
    "badge_id": "NDRF-001",
    "rri": 0.15,
    "risk_level": "normal",
    "fatigue_probability": 0.12
}}

// Alert triggered
{ "type": "alert_triggered", "data": {
    "id": "uuid",
    "alert_type": "co_poisoning",
    "severity": "critical",
    "message": "Dangerous CO level: 55.0 ppm",
    "rri_at_alert": 0.72
}}
```

---

## MQTT Topics

| Topic | Publisher | Payload |
|-------|-----------|---------|
| `responder/{badge_id}/vitals` | ESP32/Simulator | HR, SpO2, HRV, RR, Temp |
| `responder/{badge_id}/gas` | ESP32/Simulator | CO, NO2, NH3, O2, GEI |
| `responder/{badge_id}/motion` | ESP32/Simulator | Accel, Gyro, Intensity |
| `responder/{badge_id}/prediction` | ESP32/Simulator | RRI, Risk Level |
| `responder/{badge_id}/battery` | ESP32 | Voltage, %, Module |
| `responder/{badge_id}/location` | Android | Lat, Lon, Accuracy |
| `responder/{badge_id}/command` | Backend | Commands to device |
