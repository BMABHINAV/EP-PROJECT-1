/**
 * Helmet Module Firmware — ESP32-C3
 * =====================================
 * Environmental gas and ambient conditions monitoring.
 *
 * Responsibilities:
 *   1. Read MQ-7  (CO) sensor via ADC
 *   2. Read MQ-135 (NO2/NH3 composite) via ADC
 *   3. Read MiCS-2714 (NO2) via ADC
 *   4. Read Grove O2 sensor via ADC
 *   5. Read BME280 (Temp, Humidity, Pressure) via I2C
 *   6. Compute Gas Exposure Index (GEI)
 *   7. Publish gas data to Chest Module via I2C slave
 *   8. Drive RGB LED + Buzzer for local gas alerts
 *
 * Hardware: ESP32-C3 Mini (4MB Flash, 400KB SRAM)
 * Framework: Arduino
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>

// ─────────────────────────────────────────────────────────────────────
// Pin Definitions
// ─────────────────────────────────────────────────────────────────────

#define CO_SENSOR_PIN    A0    // MQ-7 analog out
#define NO2_SENSOR_PIN   A1    // MiCS-2714 analog out
#define NH3_SENSOR_PIN   A2    // MQ-135 analog out
#define O2_SENSOR_PIN    A3    // Grove O2 analog out

#define LED_RED_PIN      3
#define LED_GREEN_PIN    4
#define LED_BLUE_PIN     5
#define BUZZER_PIN       6

#define BME280_ADDR      0x76
#define I2C_SLAVE_ADDR   0x42   // Chest module reads from this address

// ─────────────────────────────────────────────────────────────────────
// Sensor Calibration Constants
// (Calibrate with reference meter before deployment)
// ─────────────────────────────────────────────────────────────────────

// MQ-7 CO: Vc=5V, RL=10kΩ, Rs/R0 in clean air ≈ 3.6
#define MQ7_R0         10.0f    // kΩ — calibrate in clean air
#define MQ7_RL         10.0f    // kΩ
#define CO_SLOPE       -1.525f  // log-log slope from datasheet
#define CO_INTERCEPT    1.693f

// O2 sensor: Grove O2 v1.0, linear output 0–25% O2
#define O2_VOLTAGE_MAX  3.3f
#define O2_SCALE        25.0f / 3.3f   // 25% / 3.3V

// IDLH thresholds
#define CO_WARN_PPM     25.0f
#define CO_DANGER_PPM   50.0f
#define NO2_WARN_PPM    3.0f
#define NO2_DANGER_PPM  5.0f
#define NH3_WARN_PPM    150.0f
#define NH3_DANGER_PPM  300.0f
#define O2_LOW_PCT      19.5f
#define O2_DANGER_PCT   16.0f

// ─────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────

Adafruit_BME280 bme;

struct GasPacket {
    float co_ppm;
    float no2_ppm;
    float nh3_ppm;
    float o2_percent;
    float ambient_temp_c;
} __attribute__((packed));

GasPacket gasPacket = {0};

// I2C slave TX buffer
uint8_t i2cTxBuffer[20];

// ─────────────────────────────────────────────────────────────────────
// ADC Conversion Helpers
// ─────────────────────────────────────────────────────────────────────

float adcToVoltage(int raw) {
    return (float)raw * 3.3f / 4095.0f;
}

/**
 * MQ-7 CO ppm calculation using Rs/R0 log-log relationship.
 * Rs = (Vc - Vout) / Vout * RL
 */
float mq7ToCOPPM(int rawADC) {
    float Vout = adcToVoltage(rawADC);
    if (Vout < 0.01f) return 0.0f;
    float Rs = (3.3f - Vout) / Vout * MQ7_RL;
    float ratio = Rs / MQ7_R0;
    return powf(10.0f, (log10f(ratio) - CO_INTERCEPT) / CO_SLOPE);
}

/**
 * Simplified MiCS-2714 NO2 ppm conversion.
 * For production: use Rs/Ro curve from datasheet.
 */
float adcToNO2PPM(int rawADC) {
    float V = adcToVoltage(rawADC);
    return (V / 3.3f) * 20.0f;  // simplified linear — replace with calibration curve
}

/**
 * MQ-135 NH3 simplified conversion.
 */
float adcToNH3PPM(int rawADC) {
    float V = adcToVoltage(rawADC);
    return (V / 3.3f) * 500.0f;  // simplified — calibrate with NH3 reference
}

/**
 * Grove O2 v1.0: 0–25% O2, linear voltage output.
 */
float adcToO2Percent(int rawADC) {
    float V = adcToVoltage(rawADC);
    return V * O2_SCALE;
}

/**
 * Compute Gas Exposure Index (0–1).
 */
float computeGEI(float co, float no2, float nh3, float o2) {
    float co_idx  = constrain(co  / 300.0f, 0.0f, 1.0f) * 0.40f;
    float no2_idx = constrain(no2 / 20.0f,  0.0f, 1.0f) * 0.25f;
    float nh3_idx = constrain(nh3 / 300.0f, 0.0f, 1.0f) * 0.20f;
    float o2_idx  = max(0.0f, (20.9f - o2) / 4.9f)     * 0.15f;
    return constrain(co_idx + no2_idx + nh3_idx + o2_idx, 0.0f, 1.0f);
}

// ─────────────────────────────────────────────────────────────────────
// Alert Control
// ─────────────────────────────────────────────────────────────────────

void setLED(bool r, bool g, bool b) {
    digitalWrite(LED_RED_PIN,   r ? HIGH : LOW);
    digitalWrite(LED_GREEN_PIN, g ? HIGH : LOW);
    digitalWrite(LED_BLUE_PIN,  b ? HIGH : LOW);
}

void evaluateLocalAlerts() {
    bool critical = false;
    bool warning  = false;

    if (gasPacket.co_ppm  > CO_DANGER_PPM  ||
        gasPacket.no2_ppm > NO2_DANGER_PPM ||
        gasPacket.nh3_ppm > NH3_DANGER_PPM ||
        gasPacket.o2_percent < O2_DANGER_PCT) {
        critical = true;
    } else if (gasPacket.co_ppm  > CO_WARN_PPM  ||
               gasPacket.no2_ppm > NO2_WARN_PPM ||
               gasPacket.nh3_ppm > NH3_WARN_PPM ||
               gasPacket.o2_percent < O2_LOW_PCT) {
        warning = true;
    }

    if (critical) {
        setLED(true, false, false);
        tone(BUZZER_PIN, 2000, 500);
        delay(600);
        tone(BUZZER_PIN, 2000, 500);
        Serial.println("🚨 CRITICAL GAS ALERT — Evacuate!");
    } else if (warning) {
        setLED(true, true, false);
        tone(BUZZER_PIN, 1500, 300);
        Serial.println("⚠️  Gas WARNING — Increase vigilance");
    } else {
        setLED(false, true, false);  // Green = OK
    }
}

// ─────────────────────────────────────────────────────────────────────
// I2C Slave TX Handler (Chest module requests data)
// ─────────────────────────────────────────────────────────────────────

void onI2CRequest() {
    Wire.write((uint8_t*)&gasPacket, sizeof(GasPacket));
}

// ─────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("========================================");
    Serial.println("  RESPONDER HELMET MODULE v1.0");
    Serial.println("========================================");

    // GPIO
    pinMode(LED_RED_PIN,   OUTPUT);
    pinMode(LED_GREEN_PIN, OUTPUT);
    pinMode(LED_BLUE_PIN,  OUTPUT);
    pinMode(BUZZER_PIN,    OUTPUT);

    // ADC resolution (ESP32-C3: 12-bit)
    analogReadResolution(12);

    // BME280
    Wire.begin();
    if (!bme.begin(BME280_ADDR)) {
        Serial.println("❌ BME280 not found! Check wiring.");
    } else {
        bme.setSampling(Adafruit_BME280::MODE_NORMAL,
                        Adafruit_BME280::SAMPLING_X4,
                        Adafruit_BME280::SAMPLING_X4,
                        Adafruit_BME280::SAMPLING_X4,
                        Adafruit_BME280::FILTER_X4,
                        Adafruit_BME280::STANDBY_MS_500);
        Serial.println("✅ BME280 initialized");
    }

    // I2C Slave
    Wire.onRequest(onI2CRequest);
    Serial.printf("✅ I2C slave @ 0x%02X\n", I2C_SLAVE_ADDR);

    // Warm-up delay for gas sensors (MQ sensors need 20-48h first boot, 30s thereafter)
    Serial.println("⏳ Gas sensor warm-up (30s)...");
    setLED(false, false, true);  // Blue during warm-up
    delay(30000);
    setLED(false, true, false);

    Serial.println("🚀 Helmet module ready");
}

// ─────────────────────────────────────────────────────────────────────
// Loop
// ─────────────────────────────────────────────────────────────────────

void loop() {
    // Read gas sensors (average 10 ADC samples for stability)
    int co_raw = 0, no2_raw = 0, nh3_raw = 0, o2_raw = 0;
    for (int i = 0; i < 10; i++) {
        co_raw  += analogRead(CO_SENSOR_PIN);
        no2_raw += analogRead(NO2_SENSOR_PIN);
        nh3_raw += analogRead(NH3_SENSOR_PIN);
        o2_raw  += analogRead(O2_SENSOR_PIN);
        delay(10);
    }
    co_raw /= 10;  no2_raw /= 10;
    nh3_raw /= 10; o2_raw  /= 10;

    // Convert to engineering units
    gasPacket.co_ppm       = mq7ToCOPPM(co_raw);
    gasPacket.no2_ppm      = adcToNO2PPM(no2_raw);
    gasPacket.nh3_ppm      = adcToNH3PPM(nh3_raw);
    gasPacket.o2_percent   = adcToO2Percent(o2_raw);
    gasPacket.ambient_temp_c = bme.readTemperature();

    float gei = computeGEI(
        gasPacket.co_ppm, gasPacket.no2_ppm,
        gasPacket.nh3_ppm, gasPacket.o2_percent
    );

    Serial.printf(
        "🌡️  CO=%.1fppm NO2=%.2fppm NH3=%.0fppm O2=%.1f%% "
        "T=%.1f°C H=%.1f%% GEI=%.3f\n",
        gasPacket.co_ppm, gasPacket.no2_ppm, gasPacket.nh3_ppm,
        gasPacket.o2_percent, gasPacket.ambient_temp_c,
        bme.readHumidity(), gei
    );

    evaluateLocalAlerts();
    delay(2000);
}
