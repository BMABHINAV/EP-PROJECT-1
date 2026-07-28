# Hardware Bill of Materials (BOM)
## Integrated Wearable Device for Rescue Personnel

---

## MODULE 1: CHEST MODULE (Main Controller)

| # | Component | Part Number | Qty | Unit Cost (₹) | Function |
|---|-----------|-------------|-----|---------------|----------|
| 1 | ESP32-S3-DevKitC-1 | Espressif | 1 | 800 | Main MCU + BLE + AI |
| 2 | MAX30102 Breakout | Sparkfun/Generic | 1 | 400 | HR + SpO2 (I2C) |
| 3 | MPU6050 Breakout | InvenSense | 1 | 150 | Accelerometer + Gyroscope |
| 4 | DS18B20 (waterproof) | Dallas/Maxim | 1 | 120 | Body Temperature |
| 5 | MLX90614 (optional) | Melexis | 1 | 600 | Non-contact IR Temperature |
| 6 | AD8232 ECG Module | Analog Devices | 1 | 350 | Heart rhythm (optional) |
| 7 | SX1276 LoRa Module (Ra-02) | Ai-Thinker | 1 | 450 | LoRa 433MHz TX/RX |
| 8 | 433MHz Antenna (SMA) | Generic | 1 | 80 | LoRa antenna |
| 9 | FRAM MB85RC256V | Fujitsu | 1 | 250 | Non-volatile RAM (offline) |
| 10| W25Q128 Flash | Winbond | 1 | 180 | 16MB SPI Flash |
| 11| TP4056 Li-ion Charger | Generic | 1 | 60 | Battery charging |
| 12| Li-ion 3.7V 3000mAh | Samsung/Generic | 1 | 500 | Power source |
| 13| MT3608 Boost Converter | Generic | 1 | 50 | 3.3V/5V power rail |
| 14| RGB LED Common Cathode | Generic | 1 | 20 | Risk level indicator |
| 15| Buzzer 5V Piezo | Generic | 1 | 30 | Audio alert |
| 16| 4.7kΩ Resistors (10 pack) | Generic | 1 | 20 | Pull-ups, dividers |
| 17| 100nF Decoupling Capacitors | Generic | 10 | 30 | Power filtering |
| **TOTAL** | | | | **₹4,090** | |

---

## MODULE 2: HELMET MODULE (Environmental Monitoring)

| # | Component | Part Number | Qty | Unit Cost (₹) | Function |
|---|-----------|-------------|-----|---------------|----------|
| 1 | ESP32-C3 Mini | Espressif | 1 | 400 | I2C slave controller |
| 2 | MQ-7 Gas Sensor | Hanwei | 1 | 250 | Carbon Monoxide (CO) |
| 3 | MiCS-2714 Breakout | SGX Sensortech | 1 | 600 | Nitrogen Dioxide (NO2) |
| 4 | MQ-135 Gas Sensor | Hanwei | 1 | 200 | NH3 / volatile gases |
| 5 | Grove O2 Sensor (ME2-O2) | Seeedstudio | 1 | 800 | Oxygen % measurement |
| 6 | BME280 Breakout | Bosch | 1 | 350 | Temp + Humidity + Pressure |
| 7 | RGB LED (Common Cathode) | Generic | 1 | 20 | Gas alert indicator |
| 8 | Buzzer Piezo 5V | Generic | 1 | 30 | Local audio alert |
| 9 | Li-ion 3.7V 2000mAh | Generic | 1 | 350 | Power source |
| 10| TP4056 Charger | Generic | 1 | 60 | Battery charger |
| 11| MQ sensor heater resistors | Generic | 5 | 50 | MQ sensor support |
| 12| Relay module (MQ preheat) | Generic | 1 | 80 | MQ-7 heater switching |
| **TOTAL** | | | | **₹3,190** | |

> **Note:** For production, replace MQ sensors with electrochemical sensors:
> - CO: SPEC Sensors 3SP_CO_1000 (~₹2000)
> - NO2: SPEC Sensors 3SP_NO2_20 (~₹2500)
> These offer much better accuracy, selectivity, and long-term stability.

---

## MODULE 3: WRIST MODULE

| # | Component | Part Number | Qty | Unit Cost (₹) | Function |
|---|-----------|-------------|-----|---------------|----------|
| 1 | ESP32-C3 Mini | Espressif | 1 | 400 | BLE controller |
| 2 | MAX30102 Breakout | Generic | 1 | 400 | SpO2 + HR (wrist PPG) |
| 3 | SSD1306 OLED 0.96" | Generic | 1 | 200 | Display |
| 4 | Vibration Motor (ERM) | Generic | 1 | 80 | Haptic alert |
| 5 | Tactile Buttons (x3) | Generic | 3 | 30 | User input |
| 6 | Li-po 3.7V 400mAh | Generic | 1 | 200 | Compact power |
| 7 | TP4056 Charger | Generic | 1 | 60 | Charging |
| **TOTAL** | | | | **₹1,370** | |

---

## FIELD GATEWAY: Raspberry Pi Setup

| # | Component | Qty | Unit Cost (₹) | Function |
|---|-----------|-----|---------------|----------|
| 1 | Raspberry Pi 4 (4GB) | 1 | 5500 | Gateway processor |
| 2 | Dragino LoRa/GPS HAT | 1 | 3500 | SX1276 LoRa + GPS |
| 3 | 433 MHz Antenna | 1 | 200 | LoRa |
| 4 | 32GB microSD | 1 | 400 | OS + data storage |
| 5 | 5V 3A Power Supply | 1 | 500 | Power |
| 6 | Waterproof enclosure | 1 | 800 | Field protection |
| **TOTAL** | | | | **₹10,900** | |

---

## PCB LAYOUT RECOMMENDATIONS

### Chest Module PCB
- **Layer count:** 4-layer (top Cu, GND, PWR, bottom Cu)
- **Board size:** 80mm × 60mm (fits chest strap housing)
- **Key routing notes:**
  - Keep MAX30102 away from LoRa RF traces
  - Star-ground topology for analog sensors
  - Ferrite beads on sensor power rails
  - SX1276: 50Ω coplanar waveguide for RF trace
  - Decoupling caps within 2mm of all power pins
- **ESD Protection:** TVS diodes on all exposed connectors
- **Connector type:** JST-PH 2.0mm for battery; SMA for antenna

### Helmet Module PCB
- **Board size:** 70mm × 50mm
- **Key notes:**
  - MQ sensors need separate 5V heater rail (isolated from MCU)
  - BME280: placement away from heat sources
  - Adequate ventilation slots in PCB for gas ingress

### Recommended CAD Tools (Free)
- KiCad 7.0 — full schematic + PCB layout
- EasyEDA — browser-based, LCSC BOM integration
- Fritzing — prototyping diagrams

---

## TOTAL PROTOTYPE COST PER UNIT

| Module | Cost (₹) |
|--------|----------|
| Chest Module | 4,090 |
| Helmet Module | 3,190 |
| Wrist Module | 1,370 |
| Miscellaneous (cables, enclosures, etc.) | 1,000 |
| **Per Responder Set** | **₹9,650** |
| Field Gateway (shared) | 10,900 |
| **Complete System (5 responders)** | **₹58,150** |
