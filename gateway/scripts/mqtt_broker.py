"""
Python MQTT Broker (amqtt) — no external install required.
Runs a full-featured MQTT 3.1.1 broker on localhost:1883.

Usage:
  python mqtt_broker.py

This replaces Mosquitto for local simulation on Windows.
"""

import asyncio
import logging
from amqtt.broker import Broker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mqtt_broker")

CONFIG = {
    "listeners": {
        "default": {
            "type":      "tcp",
            "bind":      "0.0.0.0:1883",
        },
        "ws": {
            "type":      "ws",
            "bind":      "0.0.0.0:9001",
        }
    },
    "sys_interval": 10,
    "auth": {
        "allow-anonymous": True,
    },
    "topic-check": {
        "enabled": False,
    },
}


async def run():
    broker = Broker(CONFIG)
    await broker.start()
    logger.info("✅ MQTT Broker running on:")
    logger.info("   TCP: mqtt://localhost:1883")
    logger.info("   WS:  ws://localhost:9001")
    logger.info("Press Ctrl+C to stop")
    try:
        await asyncio.get_event_loop().create_future()  # run forever
    except asyncio.CancelledError:
        await broker.shutdown()
        logger.info("MQTT Broker stopped")


if __name__ == "__main__":
    asyncio.run(run())
