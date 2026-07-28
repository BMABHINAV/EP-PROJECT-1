"""
Raspberry Pi Field Gateway
==========================
Bridges LoRa radio <-> Cloud MQTT.

Hardware: Raspberry Pi 4 + SX1276 LoRa HAT (RAK2245 or Dragino)
Software: Python 3.11, aiomqtt, spidev

Flow:
  ESP32 (LoRa TX) → SX1276 RX → RPi → Parse JSON → MQTT Publish → Cloud
  Cloud → MQTT Subscribe → RPi → LoRa TX → ESP32 (Command)

Topics:
  Uplink:   responder/{badge_id}/vitals | gas | prediction
  Downlink: responder/{badge_id}/command
"""

import asyncio
import json
import logging
import struct
from datetime import datetime
from typing import Optional

try:
    import spidev
    import RPi.GPIO as GPIO
    HW_AVAILABLE = True
except ImportError:
    HW_AVAILABLE = False
    logging.warning("⚠️  RPi hardware not available — running in mock mode")

import aiomqtt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [gateway] %(levelname)s: %(message)s"
)
logger = logging.getLogger("lora_gateway")

# ─────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────

CLOUD_MQTT_HOST  = "localhost"  # Replace with cloud broker in production
CLOUD_MQTT_PORT  = 1883
MQTT_TOPIC_PREFIX = "responder"

# SX1276 / SPI configuration (Dragino LORA/GPS HAT)
LORA_SPI_BUS = 0
LORA_SPI_CS  = 0
LORA_RST_PIN = 22
LORA_DIO0_PIN = 25
LORA_FREQ    = 433e6  # 433 MHz (match ESP32 firmware)

# ─────────────────────────────────────────────────────────────────────
# SX1276 LoRa Driver (minimal register-level driver)
# ─────────────────────────────────────────────────────────────────────

class SX1276:
    """Minimal SX1276 LoRa driver using SPI."""

    # Register map
    REG_FIFO           = 0x00
    REG_OP_MODE        = 0x01
    REG_FR_MSB         = 0x06
    REG_FR_MID         = 0x07
    REG_FR_LSB         = 0x08
    REG_MODEM_CONFIG_1 = 0x1D
    REG_MODEM_CONFIG_2 = 0x1E
    REG_PAYLOAD_LEN    = 0x22
    REG_FIFO_RX_CURRENT= 0x10
    REG_IRQ_FLAGS      = 0x12
    REG_RX_NB_BYTES    = 0x13
    REG_PKT_RSSI       = 0x1A
    REG_PKT_SNR        = 0x19

    MODE_LONG_RANGE    = 0x80
    MODE_SLEEP         = 0x00
    MODE_STDBY         = 0x01
    MODE_TX            = 0x03
    MODE_RX_CONT       = 0x05

    IRQ_RX_DONE        = 0x40

    def __init__(self):
        if not HW_AVAILABLE:
            logger.warning("Mock SX1276 — no actual SPI communication")
            return
        self.spi = spidev.SpiDev()
        self.spi.open(LORA_SPI_BUS, LORA_SPI_CS)
        self.spi.max_speed_hz = 5000000
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(LORA_RST_PIN, GPIO.OUT)
        GPIO.setup(LORA_DIO0_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
        self._reset()
        self._init_lora()

    def _write_reg(self, reg, val):
        self.spi.xfer2([reg | 0x80, val])

    def _read_reg(self, reg):
        return self.spi.xfer2([reg & 0x7F, 0])[1]

    def _reset(self):
        GPIO.output(LORA_RST_PIN, GPIO.LOW)
        asyncio.sleep(0.01)
        GPIO.output(LORA_RST_PIN, GPIO.HIGH)
        asyncio.sleep(0.01)

    def _init_lora(self):
        self._write_reg(self.REG_OP_MODE, self.MODE_LONG_RANGE | self.MODE_SLEEP)
        # Set frequency 433 MHz
        frf = int(LORA_FREQ / 32e6 * (1 << 19))
        self._write_reg(self.REG_FR_MSB, (frf >> 16) & 0xFF)
        self._write_reg(self.REG_FR_MID, (frf >> 8)  & 0xFF)
        self._write_reg(self.REG_FR_LSB, frf & 0xFF)
        # Modem config: BW=125kHz, CR=4/5, SF=9
        self._write_reg(self.REG_MODEM_CONFIG_1, 0x72)
        self._write_reg(self.REG_MODEM_CONFIG_2, 0x94)
        # Standby
        self._write_reg(self.REG_OP_MODE, self.MODE_LONG_RANGE | self.MODE_STDBY)

    def start_receive(self):
        if not HW_AVAILABLE: return
        self._write_reg(self.REG_OP_MODE, self.MODE_LONG_RANGE | self.MODE_RX_CONT)

    def check_received(self) -> Optional[bytes]:
        if not HW_AVAILABLE: return None
        irq = self._read_reg(self.REG_IRQ_FLAGS)
        if irq & self.IRQ_RX_DONE:
            self._write_reg(self.REG_IRQ_FLAGS, self.IRQ_RX_DONE)
            nb = self._read_reg(self.REG_RX_NB_BYTES)
            ptr = self._read_reg(self.REG_FIFO_RX_CURRENT)
            self._write_reg(0x0D, ptr)  # FIFO addr ptr
            data = []
            for _ in range(nb):
                data.append(self._read_reg(self.REG_FIFO))
            return bytes(data)
        return None

    @property
    def last_rssi(self):
        if not HW_AVAILABLE: return -70
        return self._read_reg(self.REG_PKT_RSSI) - 157

    @property
    def last_snr(self):
        if not HW_AVAILABLE: return 10
        val = self._read_reg(self.REG_PKT_SNR)
        return (val if val < 128 else val - 256) / 4.0


# ─────────────────────────────────────────────────────────────────────
# Packet Parser
# ─────────────────────────────────────────────────────────────────────

def parse_lora_packet(raw: bytes) -> Optional[dict]:
    """
    Parse compact JSON LoRa packet from ESP32.
    Expected format:
    {"id":"NDRF-001","hr":85.2,"spo2":97.5,"tmp":37.1,"co":12.3,"o2":20.8,"rri":0.12,"rl":0}
    """
    try:
        text = raw.decode("utf-8").strip()
        data = json.loads(text)
        return data
    except Exception as e:
        logger.error(f"Failed to parse LoRa packet: {e} | raw={raw}")
        return None


def expand_packet(compact: dict, rssi: int, snr: float) -> dict:
    """Expand compact LoRa packet to full MQTT payload."""
    return {
        "badge_id":    compact.get("id", "UNKNOWN"),
        "timestamp":   datetime.utcnow().isoformat(),
        "heart_rate":  compact.get("hr"),
        "spo2":        compact.get("spo2"),
        "body_temp_c": compact.get("tmp"),
        "co_ppm":      compact.get("co"),
        "o2_percent":  compact.get("o2"),
        "rri":         compact.get("rri"),
        "risk_level":  compact.get("rl"),
        "rssi_dbm":    rssi,
        "snr_db":      snr,
        "gateway":     "lora_rpi",
    }


# ─────────────────────────────────────────────────────────────────────
# Gateway Main Loop
# ─────────────────────────────────────────────────────────────────────

async def run_gateway():
    radio = SX1276()
    radio.start_receive()
    logger.info("🔰 LoRa gateway initialized — listening...")

    async with aiomqtt.Client(
        hostname=CLOUD_MQTT_HOST,
        port=CLOUD_MQTT_PORT,
        identifier="lora-gateway-rpi"
    ) as mqtt_client:
        logger.info(f"📡 Connected to MQTT broker @ {CLOUD_MQTT_HOST}:{CLOUD_MQTT_PORT}")

        # Subscribe to command topics (downlink from cloud)
        await mqtt_client.subscribe(f"{MQTT_TOPIC_PREFIX}/+/command")

        loop_count = 0
        while True:
            loop_count += 1

            # Check for LoRa RX
            raw = radio.check_received()
            if raw:
                logger.info(f"📶 LoRa RX ({len(raw)} bytes) RSSI={radio.last_rssi}dBm SNR={radio.last_snr}dB")
                packet = parse_lora_packet(raw)
                if packet:
                    badge_id = packet.get("id", "UNKNOWN")
                    expanded = expand_packet(packet, radio.last_rssi, radio.last_snr)

                    # Publish vitals and prediction to MQTT
                    await mqtt_client.publish(
                        f"{MQTT_TOPIC_PREFIX}/{badge_id}/vitals",
                        json.dumps({
                            "badge_id":    badge_id,
                            "timestamp":   expanded["timestamp"],
                            "heart_rate":  expanded["heart_rate"],
                            "spo2":        expanded["spo2"],
                            "body_temp_c": expanded["body_temp_c"],
                        }),
                        qos=1,
                    )
                    await mqtt_client.publish(
                        f"{MQTT_TOPIC_PREFIX}/{badge_id}/prediction",
                        json.dumps({
                            "badge_id":  badge_id,
                            "timestamp": expanded["timestamp"],
                            "rri":       expanded["rri"],
                            "risk_level": expanded.get("risk_level", 0),
                        }),
                        qos=1,
                    )
                    logger.info(f"✅ Published LoRa data for {badge_id} to MQTT")

            # Simulation mode: inject mock data every 30s
            if not HW_AVAILABLE and loop_count % 150 == 0:
                mock_badges = ["NDRF-001", "NDRF-003", "NDRF-005"]
                import random
                for bid in mock_badges:
                    mock_data = {
                        "badge_id":   bid,
                        "timestamp":  datetime.utcnow().isoformat(),
                        "heart_rate": round(random.uniform(80, 140), 1),
                        "spo2":       round(random.uniform(93, 99), 1),
                        "body_temp_c": round(random.uniform(37, 38.5), 2),
                        "co_ppm":     round(random.uniform(0, 60), 1),
                        "rri":        round(random.uniform(0.1, 0.7), 3),
                    }
                    await mqtt_client.publish(
                        f"{MQTT_TOPIC_PREFIX}/{bid}/vitals",
                        json.dumps(mock_data), qos=0
                    )
                logger.info(f"[MOCK] Injected gateway data for {mock_badges}")

            await asyncio.sleep(0.2)  # 200ms polling loop


def main():
    logger.info("🚀 Starting LoRa Field Gateway")
    asyncio.run(run_gateway())


if __name__ == "__main__":
    main()
