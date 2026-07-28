"""
Responder System — Python Sensor Simulator
==========================================
Simulates 5 responders in a hazardous environment, publishing realistic
sensor data via MQTT. Designed to mimic ESP32 firmware behavior.

Features:
  - Physiological simulation (HR, SpO2, HRV, Temperature, Respiration)
  - Gas simulation (CO, NO2, NH3, O2)
  - Motion simulation (Accelerometer, Gyroscope)
  - Edge RRI computation (mirrors TinyML model logic)
  - Escalating scenarios (fatigue onset, gas leak events)
  - MQTT publish to all sensor topics

Usage:
  python main.py [--responders 5] [--interval 2] [--broker localhost]
"""

import asyncio
import json
import logging
import math
import random
import argparse
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional
import aiomqtt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("simulator")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

MQTT_BROKER   = "localhost"
MQTT_PORT     = 1883
TOPIC_PREFIX  = "responder"
NUM_RESPONDERS = 5
PUBLISH_INTERVAL = 2  # seconds

RESPONDERS_SEED = [
    {"badge_id": "NDRF-001", "name": "Arjun Singh",  "role": "firefighter"},
    {"badge_id": "NDRF-002", "name": "Priya Sharma", "role": "paramedic"},
    {"badge_id": "NDRF-003", "name": "Ravi Kumar",   "role": "firefighter"},
    {"badge_id": "NDRF-004", "name": "Anita Patel",  "role": "ndrf"},
    {"badge_id": "NDRF-005", "name": "Suresh Menon", "role": "firefighter"},
]


# ─────────────────────────────────────────────────────────────────────────────
# Responder State Model
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ResponderState:
    badge_id:            str
    name:                str
    role:                str
    mission_start:       datetime = field(default_factory=datetime.utcnow)

    # Vitals — baseline values
    heart_rate:          float = 72.0
    spo2:                float = 98.0
    hrv_ms:              float = 45.0
    respiration_rate:    float = 16.0
    body_temp_c:         float = 37.0

    # Gas — baseline (clean air)
    co_ppm:              float = 2.0
    no2_ppm:             float = 0.1
    nh3_ppm:             float = 5.0
    o2_percent:          float = 20.9
    ambient_temp_c:      float = 28.0
    humidity_pct:        float = 65.0

    # Motion
    accel_magnitude:     float = 9.8
    motion_intensity:    float = 0.3
    activity:            str = "walking"

    # Scenario state
    fatigue_level:       float = 0.0      # 0-1 (grows over time)
    gas_event_active:    bool = False
    scenario_step:       int = 0
    rri:                 float = 0.05

    # Derived
    gas_exposure_index:  float = 0.0

    def mission_duration_min(self) -> float:
        return (datetime.utcnow() - self.mission_start).total_seconds() / 60.0


# ─────────────────────────────────────────────────────────────────────────────
# Physiological Simulation Engine
# ─────────────────────────────────────────────────────────────────────────────

class PhysioSimulator:
    """Simulates realistic vital sign changes based on fatigue and gas exposure."""

    @staticmethod
    def add_gaussian_noise(value: float, sigma: float) -> float:
        return value + random.gauss(0, sigma)

    @staticmethod
    def simulate_hr(state: ResponderState) -> float:
        """
        Heart rate increases with:
        - Fatigue (linear rise)
        - Gas exposure (CO causes compensatory tachycardia)
        - Activity level
        Realistic baseline: 60-80 bpm at rest, up to 180+ under extreme stress
        """
        base = 72 + (state.fatigue_level * 60)
        gas_effect = (state.co_ppm / 200.0) * 20
        activity_effect = {
            "stationary": -5, "walking": 0, "running": 20, "climbing": 30
        }.get(state.activity, 0)

        hr = base + gas_effect + activity_effect
        return max(40, min(220, PhysioSimulator.add_gaussian_noise(hr, 2.0)))

    @staticmethod
    def simulate_spo2(state: ResponderState) -> float:
        """
        SpO2 decreases with:
        - CO poisoning (CO displaces O2 from hemoglobin)
        - O2 deficiency
        - Severe fatigue
        Normal: 95-100%, IDLH: <85%
        """
        base = 98.0
        co_effect  = -(state.co_ppm / 50.0) * 3.0    # 50ppm CO → -3% SpO2
        o2_effect  = -max(0, (20.9 - state.o2_percent) * 1.5)
        fatigue_eff = -(state.fatigue_level * 2.0)

        spo2 = base + co_effect + o2_effect + fatigue_eff
        return max(70, min(100, PhysioSimulator.add_gaussian_noise(spo2, 0.3)))

    @staticmethod
    def simulate_hrv(state: ResponderState) -> float:
        """
        HRV (RMSSD) DECREASES with fatigue and stress.
        Normal: 20-80ms, Fatigued: <15ms
        """
        base = 45.0 - (state.fatigue_level * 35.0)
        return max(5, PhysioSimulator.add_gaussian_noise(base, 2.0))

    @staticmethod
    def simulate_respiration(state: ResponderState) -> float:
        """Respiration rate increases with exertion and CO exposure."""
        base = 16 + (state.fatigue_level * 12) + (state.co_ppm / 100.0) * 4
        return max(8, min(40, PhysioSimulator.add_gaussian_noise(base, 0.5)))

    @staticmethod
    def simulate_body_temp(state: ResponderState) -> float:
        """Body temp rises with exertion and hot environment."""
        base = 37.0 + (state.fatigue_level * 1.5) + ((state.ambient_temp_c - 28) * 0.05)
        return max(36.0, min(42.0, PhysioSimulator.add_gaussian_noise(base, 0.05)))


# ─────────────────────────────────────────────────────────────────────────────
# Gas Simulation Engine
# ─────────────────────────────────────────────────────────────────────────────

class GasSimulator:
    """Simulates gas concentration changes in hazardous environments."""

    @staticmethod
    def compute_gas_exposure_index(co, no2, nh3, o2) -> float:
        """
        Normalized 0-1 index combining all gas readings.
        Weighted based on IDLH (Immediately Dangerous to Life and Health) values.
        IDLH: CO=1200ppm, NO2=20ppm, NH3=300ppm, O2<16%
        """
        co_idx  = min(co  / 300.0, 1.0)   * 0.40
        no2_idx = min(no2 / 20.0,  1.0)   * 0.25
        nh3_idx = min(nh3 / 300.0, 1.0)   * 0.20
        o2_idx  = max(0, (20.9 - o2) / 4.9) * 0.15
        return min(co_idx + no2_idx + nh3_idx + o2_idx, 1.0)

    @staticmethod
    def update_gas(state: ResponderState) -> None:
        if state.gas_event_active:
            # Gas leak event: CO and NO2 rising
            state.co_ppm  = min(state.co_ppm  + random.uniform(2, 6),  200.0)
            state.no2_ppm = min(state.no2_ppm + random.uniform(0.1, 0.5), 15.0)
            state.nh3_ppm = min(state.nh3_ppm + random.uniform(1, 10), 400.0)
            state.o2_percent = max(state.o2_percent - random.uniform(0.01, 0.05), 14.0)
        else:
            # Slowly return to baseline with noise
            state.co_ppm     = max(1, state.co_ppm     + random.gauss(0, 0.5))
            state.no2_ppm    = max(0, state.no2_ppm    + random.gauss(0, 0.02))
            state.nh3_ppm    = max(0, state.nh3_ppm    + random.gauss(0, 1.0))
            state.o2_percent = min(20.9, state.o2_percent + random.gauss(0.01, 0.01))

        state.ambient_temp_c = max(20, min(80, state.ambient_temp_c + random.gauss(0.1, 0.5)))
        state.humidity_pct   = max(10, min(100, state.humidity_pct + random.gauss(0, 0.5)))
        state.gas_exposure_index = GasSimulator.compute_gas_exposure_index(
            state.co_ppm, state.no2_ppm, state.nh3_ppm, state.o2_percent
        )


# ─────────────────────────────────────────────────────────────────────────────
# RRI Computation (mirrors TinyML model)
# ─────────────────────────────────────────────────────────────────────────────

def compute_rri(state: ResponderState) -> float:
    """
    Rescue Risk Index — rule-based approximation of TinyML output.
    In production this runs as TensorFlow Lite on ESP32-S3.
    """
    score = 0.0

    # SpO2 component (critical weight = 0.25)
    if state.spo2 < 90:
        score += 0.25
    elif state.spo2 < 94:
        score += 0.15
    elif state.spo2 < 96:
        score += 0.05

    # Heart rate component (0.15)
    if state.heart_rate > 180:
        score += 0.15
    elif state.heart_rate > 160:
        score += 0.10
    elif state.heart_rate > 140:
        score += 0.05

    # HRV component (0.10) — low HRV = high risk
    if state.hrv_ms < 10:
        score += 0.10
    elif state.hrv_ms < 20:
        score += 0.06
    elif state.hrv_ms < 30:
        score += 0.02

    # Gas exposure index (0.25)
    score += state.gas_exposure_index * 0.25

    # O2 depletion (0.10)
    if state.o2_percent < 16:
        score += 0.10
    elif state.o2_percent < 19.5:
        score += 0.05

    # Body temperature (0.05)
    if state.body_temp_c > 40:
        score += 0.05
    elif state.body_temp_c > 38.5:
        score += 0.03

    # Mission duration (0.10)
    duration_h = state.mission_duration_min() / 60.0
    if duration_h > 4:
        score += 0.10
    elif duration_h > 2:
        score += 0.06
    elif duration_h > 1:
        score += 0.03

    return min(score, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# MQTT Publisher
# ─────────────────────────────────────────────────────────────────────────────

async def publish_responder_data(client: aiomqtt.Client, state: ResponderState):
    """Update state and publish all sensor readings for one responder."""

    # 1. Update scenario
    state.scenario_step += 1
    state.fatigue_level = min(1.0, state.fatigue_level + 0.002)  # slow fatigue onset

    # Randomly trigger gas events
    if state.scenario_step % 150 == 0:  # ~every 5 min
        state.gas_event_active = True
        logger.warning(f"⚠️  Gas event triggered for {state.badge_id}")
    if state.gas_event_active and state.scenario_step % 200 == 0:
        state.gas_event_active = False
        logger.info(f"✅ Gas event cleared for {state.badge_id}")

    # Update activity randomly
    if random.random() < 0.05:
        state.activity = random.choice(["walking", "running", "stationary", "climbing"])

    # 2. Simulate all sensors
    state.heart_rate       = PhysioSimulator.simulate_hr(state)
    state.spo2             = PhysioSimulator.simulate_spo2(state)
    state.hrv_ms           = PhysioSimulator.simulate_hrv(state)
    state.respiration_rate = PhysioSimulator.simulate_respiration(state)
    state.body_temp_c      = PhysioSimulator.simulate_body_temp(state)
    GasSimulator.update_gas(state)
    state.rri = compute_rri(state)

    ts = datetime.utcnow().isoformat()

    # 3. Publish vitals
    vitals_payload = {
        "badge_id":         state.badge_id,
        "timestamp":        ts,
        "heart_rate":       round(state.heart_rate, 1),
        "hrv_ms":           round(state.hrv_ms, 1),
        "spo2":             round(state.spo2, 1),
        "respiration_rate": round(state.respiration_rate, 1),
        "body_temp_c":      round(state.body_temp_c, 2),
    }
    await client.publish(
        f"{TOPIC_PREFIX}/{state.badge_id}/vitals",
        json.dumps(vitals_payload),
        qos=1,
    )

    # 4. Publish gas
    gas_payload = {
        "badge_id":           state.badge_id,
        "timestamp":          ts,
        "co_ppm":             round(state.co_ppm, 2),
        "no2_ppm":            round(state.no2_ppm, 3),
        "nh3_ppm":            round(state.nh3_ppm, 1),
        "o2_percent":         round(state.o2_percent, 2),
        "ambient_temp_c":     round(state.ambient_temp_c, 1),
        "humidity_pct":       round(state.humidity_pct, 1),
        "gas_exposure_index": round(state.gas_exposure_index, 4),
    }
    await client.publish(
        f"{TOPIC_PREFIX}/{state.badge_id}/gas",
        json.dumps(gas_payload),
        qos=1,
    )

    # 5. Publish prediction (RRI)
    risk_level = (
        "normal"   if state.rri < 0.3 else
        "caution"  if state.rri < 0.6 else
        "warning"  if state.rri < 0.8 else
        "critical"
    )
    pred_payload = {
        "badge_id":            state.badge_id,
        "timestamp":           ts,
        "rri":                 round(state.rri, 4),
        "risk_level":          risk_level,
        "fatigue_probability": round(state.fatigue_level, 3),
        "inference_time_ms":   round(random.uniform(2.5, 8.0), 2),  # simulated edge latency
        "features": {
            "heart_rate":       round(state.heart_rate, 1),
            "spo2":             round(state.spo2, 1),
            "hrv_ms":           round(state.hrv_ms, 1),
            "respiration_rate": round(state.respiration_rate, 1),
            "body_temp_c":      round(state.body_temp_c, 2),
            "gas_exposure_index": round(state.gas_exposure_index, 4),
            "motion_intensity": round(state.motion_intensity, 2),
            "duration_min":     round(state.mission_duration_min(), 1),
        }
    }
    await client.publish(
        f"{TOPIC_PREFIX}/{state.badge_id}/prediction",
        json.dumps(pred_payload),
        qos=1,
    )

    logger.info(
        f"[{state.badge_id}] HR={state.heart_rate:.0f} SpO2={state.spo2:.1f}% "
        f"CO={state.co_ppm:.1f}ppm RRI={state.rri:.3f} [{risk_level.upper()}]"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Main Loop
# ─────────────────────────────────────────────────────────────────────────────

async def run_simulator(broker: str, port: int, num_responders: int, interval: float):
    """Main simulator loop — connects to MQTT and publishes data for all responders."""

    # Initialize responder states with staggered mission start times
    states = []
    for i, info in enumerate(RESPONDERS_SEED[:num_responders]):
        state = ResponderState(
            badge_id      = info["badge_id"],
            name          = info["name"],
            role          = info["role"],
            mission_start = datetime.utcnow() - timedelta(minutes=random.randint(10, 120)),
        )
        # Add some initial variance
        state.fatigue_level = random.uniform(0.0, 0.3)
        states.append(state)

    logger.info(f"🚀 Simulator starting: {num_responders} responders → {broker}:{port}")
    logger.info(f"📡 Publish interval: {interval}s")

    async with aiomqtt.Client(hostname=broker, port=port, identifier="responder-simulator") as client:
        logger.info("✅ Connected to MQTT broker")
        loop_count = 0
        while True:
            loop_count += 1
            tasks = [publish_responder_data(client, state) for state in states]
            await asyncio.gather(*tasks)

            if loop_count % 30 == 0:
                logger.info(f"📊 Simulation tick #{loop_count} — all responders updated")

            await asyncio.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="Responder Sensor Simulator")
    parser.add_argument("--broker",     default="localhost", help="MQTT broker host")
    parser.add_argument("--port",       type=int, default=1883, help="MQTT broker port")
    parser.add_argument("--responders", type=int, default=NUM_RESPONDERS, help="Number of responders")
    parser.add_argument("--interval",   type=float, default=PUBLISH_INTERVAL, help="Publish interval (seconds)")
    args = parser.parse_args()

    # Fix: Windows Python 3.12 defaults to ProactorEventLoop which
    # does not support add_reader/add_writer used by aiomqtt (paho-mqtt).
    # Force SelectorEventLoop on Windows.
    import sys
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(run_simulator(args.broker, args.port, args.responders, args.interval))


if __name__ == "__main__":
    main()
