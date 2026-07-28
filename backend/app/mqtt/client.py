"""
MQTT client — subscribes to all responder topics and persists data to DB.
Also publishes processed alerts and RRI predictions.
"""

import asyncio
import json
import logging
from datetime import datetime

import aiomqtt
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.alert_service import evaluate_and_raise_alerts
from app.services.rri_service import compute_rri_from_data
from app.api.websocket import ws_manager

logger = logging.getLogger(__name__)

# MQTT Topic patterns
TOPIC_VITALS     = f"{settings.MQTT_TOPIC_PREFIX}/+/vitals"
TOPIC_GAS        = f"{settings.MQTT_TOPIC_PREFIX}/+/gas"
TOPIC_MOTION     = f"{settings.MQTT_TOPIC_PREFIX}/+/motion"
TOPIC_PREDICTION = f"{settings.MQTT_TOPIC_PREFIX}/+/prediction"
TOPIC_BATTERY    = f"{settings.MQTT_TOPIC_PREFIX}/+/battery"
TOPIC_LOCATION   = f"{settings.MQTT_TOPIC_PREFIX}/+/location"


class MQTTManager:
    def __init__(self):
        self._client = None
        self._running = False

    async def connect(self):
        self._running = True
        asyncio.create_task(self._listen_loop())

    async def disconnect(self):
        self._running = False

    async def subscribe_all(self):
        pass  # handled inside _listen_loop

    async def _listen_loop(self):
        """Long-running MQTT listener task."""
        async with aiomqtt.Client(
            hostname=settings.MQTT_BROKER_HOST,
            port=settings.MQTT_BROKER_PORT,
            identifier=settings.MQTT_CLIENT_ID,
            keepalive=settings.MQTT_KEEPALIVE,
        ) as client:
            self._client = client
            topics = [
                TOPIC_VITALS, TOPIC_GAS, TOPIC_MOTION,
                TOPIC_PREDICTION, TOPIC_BATTERY, TOPIC_LOCATION,
            ]
            for topic in topics:
                await client.subscribe(topic)
                logger.info(f"Subscribed to: {topic}")

            async for message in client.messages:
                if not self._running:
                    break
                await self._handle_message(str(message.topic), message.payload)

    async def _handle_message(self, topic: str, payload: bytes):
        """Route incoming MQTT message to the correct handler."""
        try:
            parts = topic.split("/")
            badge_id = parts[1]
            data_type = parts[2]
            data = json.loads(payload.decode("utf-8"))

            async with AsyncSessionLocal() as db:
                if data_type == "vitals":
                    await self._handle_vitals(db, badge_id, data)
                elif data_type == "gas":
                    await self._handle_gas(db, badge_id, data)
                elif data_type == "motion":
                    await self._handle_motion(db, badge_id, data)
                elif data_type == "prediction":
                    await self._handle_prediction(db, badge_id, data)
                elif data_type == "battery":
                    await self._handle_battery(db, badge_id, data)
                elif data_type == "location":
                    await self._handle_location(db, badge_id, data)

        except Exception as e:
            logger.error(f"MQTT handler error [{topic}]: {e}")

    async def _handle_vitals(self, db, badge_id: str, data: dict):
        from app.db.models.models import Vital, Responder
        from sqlalchemy import select

        result = await db.execute(select(Responder).where(Responder.badge_id == badge_id))
        responder = result.scalar_one_or_none()
        if not responder:
            logger.warning(f"Unknown responder badge_id: {badge_id}")
            return

        vital = Vital(
            responder_id     = responder.id,
            heart_rate       = data.get("heart_rate"),
            hrv_ms           = data.get("hrv_ms"),
            spo2             = data.get("spo2"),
            respiration_rate = data.get("respiration_rate"),
            body_temp_c      = data.get("body_temp_c"),
            time             = datetime.fromisoformat(data.get("timestamp", datetime.utcnow().isoformat())),
        )
        db.add(vital)
        await db.commit()
        logger.debug(f"Saved vitals for {badge_id}: HR={data.get('heart_rate')}")
        
        # Broadcast live data to Dashboard
        await ws_manager.broadcast("vitals_update", {"badge_id": badge_id, **data})

        # Check alerts
        await evaluate_and_raise_alerts(db, responder, "vitals", data)

    async def _handle_gas(self, db, badge_id: str, data: dict):
        from app.db.models.models import GasReading, Responder
        from sqlalchemy import select

        result = await db.execute(select(Responder).where(Responder.badge_id == badge_id))
        responder = result.scalar_one_or_none()
        if not responder:
            return

        gas = GasReading(
            responder_id       = responder.id,
            co_ppm             = data.get("co_ppm", 0),
            no2_ppm            = data.get("no2_ppm", 0),
            nh3_ppm            = data.get("nh3_ppm", 0),
            o2_percent         = data.get("o2_percent", 20.9),
            ambient_temp_c     = data.get("ambient_temp_c"),
            humidity_pct       = data.get("humidity_pct"),
            gas_exposure_index = data.get("gas_exposure_index"),
            time               = datetime.fromisoformat(data.get("timestamp", datetime.utcnow().isoformat())),
        )
        db.add(gas)
        await db.commit()
        
        # Broadcast live data to Dashboard
        await ws_manager.broadcast("gas_update", {"badge_id": badge_id, **data})

        await evaluate_and_raise_alerts(db, responder, "gas", data)

    async def _handle_motion(self, db, badge_id: str, data: dict):
        from app.db.models.models import Responder
        from sqlalchemy import select
        # Motion stored similarly
        pass

    async def _handle_prediction(self, db, badge_id: str, data: dict):
        from app.db.models.models import Prediction, Responder
        from sqlalchemy import select

        result = await db.execute(select(Responder).where(Responder.badge_id == badge_id))
        responder = result.scalar_one_or_none()
        if not responder:
            return

        rri = data.get("rri", 0.0)
        risk_level = (
            "normal"   if rri < 0.3 else
            "caution"  if rri < 0.6 else
            "warning"  if rri < 0.8 else
            "critical"
        )

        pred = Prediction(
            responder_id        = responder.id,
            rri                 = rri,
            risk_level          = risk_level,
            fatigue_probability = data.get("fatigue_probability"),
            inference_time_ms   = data.get("inference_time_ms"),
            features_json       = data.get("features"),
            time                = datetime.fromisoformat(data.get("timestamp", datetime.utcnow().isoformat())),
        )
        db.add(pred)
        await db.commit()
        
        # Broadcast live prediction to Dashboard
        await ws_manager.broadcast("rri_update", {
            "badge_id": badge_id, 
            "rri": rri, 
            "risk_level": risk_level, 
            **data
        })

    async def _handle_battery(self, db, badge_id: str, data: dict):
        pass  # implement similarly

    async def _handle_location(self, db, badge_id: str, data: dict):
        pass  # implement similarly

    async def publish(self, topic: str, payload: dict):
        """Publish a message to MQTT (for alerts, commands)."""
        if self._client:
            await self._client.publish(topic, json.dumps(payload).encode())


mqtt_manager = MQTTManager()
