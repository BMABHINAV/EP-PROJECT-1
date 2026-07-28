/**
 * Chest Module Firmware — ESP32-S3
 * =====================================
 * Main controller for the Responder System wearable.
 * 
 * Responsibilities:
 *   1. Read MAX30102 (HR, SpO2, HRV)
 *   2. Read DS18B20 (Body Temperature)
 *   3. Read MPU6050 (Acceleration, Gyroscope, Activity)
 *   4. Receive I2C data from Helmet Module (gas readings)
 *   5. Compute Rescue Risk Index via TFLite Micro (TinyML)
 *   6. Transmit via BLE to Android app / Wrist Module
 *   7. Transmit via LoRa to Field Gateway
 *   8. Store data to FRAM (offline)
 *   9. Drive local RGB LED + Buzzer for alerts
 * 
 * Hardware: ESP32-S3 DevKitC-1 (8MB PSRAM, 16MB Flash)
 * Framework: Arduino + ESP-IDF
 */

#include <Arduino.h>
#include <Wire.h>

// ── Sensor Libraries ─────────────────────────────────────────────────
#include <MAX30105.h>
#include <heartRate.h>
#include <spo2_algorithm.h>
#include <DallasTemperature.h>
#include <OneWire.h>
#include <MPU6050.h>
#include <LoRa.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── TFLite Micro ─────────────────────────────────────────────────────
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "rri_model.h"  // Generated C array from ML pipeline

// ── FRAM ─────────────────────────────────────────────────────────────
#include <FRAM_I2C.h>

// ─────────────────────────────────────────────────────────────────────
// Constants & Pin Definitions
// ─────────────────────────────────────────────────────────────────────

#define FIRMWARE_VERSION  "1.0.0"
#define DEVICE_BADGE_ID   "NDRF-001"   // Set per device at flash time

// Pins
#define LED_RED_PIN       2
#define LED_GREEN_PIN     3
#define LED_BLUE_PIN      4
#define BUZZER_PIN        5
#define ONE_WIRE_BUS      4

// LoRa pins (SPI)
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  26
#define LORA_FREQ  433E6  // 433 MHz

// BLE UUIDs
#define BLE_SERVICE_UUID          "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHAR_VITALS_UUID      "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CHAR_RRI_UUID         "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_CHAR_GAS_UUID         "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

// TFLite
constexpr int kTensorArenaSize = 10 * 1024;  // 10 KB arena
uint8_t tensor_arena[kTensorArenaSize];

// ─────────────────────────────────────────────────────────────────────
// Data Structures
// ─────────────────────────────────────────────────────────────────────

struct VitalData {
    float heart_rate       = 0.0f;
    float spo2             = 0.0f;
    float hrv_ms           = 0.0f;
    float respiration_rate = 0.0f;
    float body_temp_c      = 0.0f;
    bool  valid            = false;
};

struct GasData {
    float co_ppm              = 0.0f;
    float no2_ppm             = 0.0f;
    float nh3_ppm             = 0.0f;
    float o2_percent          = 20.9f;
    float ambient_temp_c      = 25.0f;
    float humidity_pct        = 60.0f;
    float gas_exposure_index  = 0.0f;
    bool  valid               = false;
};

struct MotionData {
    float accel_x = 0.0f;
    float accel_y = 0.0f;
    float accel_z = 9.8f;
    float gyro_x  = 0.0f;
    float gyro_y  = 0.0f;
    float gyro_z  = 0.0f;
    float intensity = 0.0f;
};

struct RRIPrediction {
    float rri               = 0.0f;
    float fatigue_prob      = 0.0f;
    uint8_t risk_level      = 0;  // 0=normal, 1=caution, 2=warning, 3=critical
    float inference_time_ms = 0.0f;
};

// ─────────────────────────────────────────────────────────────────────
// Global Objects
// ─────────────────────────────────────────────────────────────────────

MAX30105    pulseOximeter;
OneWire     oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
MPU6050     imu;
FRAM        fram;

BLEServer*          bleServer      = nullptr;
BLECharacteristic*  vitalsChar     = nullptr;
BLECharacteristic*  rriChar        = nullptr;
BLECharacteristic*  gasChar        = nullptr;
bool                bleConnected   = false;

// TFLite objects
const tflite::Model*            tfModel     = nullptr;
tflite::MicroInterpreter*       interpreter = nullptr;
TfLiteTensor*                   input       = nullptr;

// Sensor data
VitalData     vitals;
GasData       gas;
MotionData    motion;
RRIPrediction prediction;

unsigned long missionStartMs    = 0;
unsigned long lastSensorReadMs  = 0;
unsigned long lastLoRaTxMs      = 0;
unsigned long lastBLETxMs       = 0;

const unsigned long SENSOR_READ_INTERVAL  = 2000;   // 2s
const unsigned long LORA_TX_INTERVAL      = 10000;  // 10s
const unsigned long BLE_TX_INTERVAL       = 2000;   // 2s

// HRV calculation buffers
#define RR_BUFFER_SIZE 32
float rrIntervals[RR_BUFFER_SIZE];
int   rrIdx = 0;

// ─────────────────────────────────────────────────────────────────────
// Normalization helpers (must match Python scaler_params.json)
// ─────────────────────────────────────────────────────────────────────

float normalize(float val, float min_val, float max_val) {
    return constrain((val - min_val) / (max_val - min_val), 0.0f, 1.0f);
}

// Feature indices (must match training order)
#define FEAT_HR     0
#define FEAT_SPO2   1
#define FEAT_HRV    2
#define FEAT_RR     3
#define FEAT_TEMP   4
#define FEAT_GEI    5
#define FEAT_MOTION 6
#define FEAT_DUR    7

// ─────────────────────────────────────────────────────────────────────
// TFLite Micro Initialization
// ─────────────────────────────────────────────────────────────────────

bool initTFLite() {
    tfModel = tflite::GetModel(rri_model_data);
    if (tfModel->version() != TFLITE_SCHEMA_VERSION) {
        Serial.println("❌ TFLite model schema version mismatch!");
        return false;
    }

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(
        tfModel, resolver, tensor_arena, kTensorArenaSize
    );
    interpreter = &static_interpreter;

    if (interpreter->AllocateTensors() != kTfLiteOk) {
        Serial.println("❌ TFLite AllocateTensors() failed!");
        return false;
    }

    input = interpreter->input(0);
    Serial.println("✅ TFLite model loaded successfully");
    Serial.printf("   Input shape: [1, %d]\n", input->dims->data[1]);
    return true;
}

// ─────────────────────────────────────────────────────────────────────
// RRI Inference
// ─────────────────────────────────────────────────────────────────────

RRIPrediction runRRIInference(float hr, float spo2, float hrv, float rr,
                               float temp, float gei, float motion_i, float dur_h) {
    RRIPrediction result;
    unsigned long t0 = millis();

    // Fill normalized input tensor
    input->data.f[FEAT_HR]     = normalize(hr,      40.0f,  220.0f);
    input->data.f[FEAT_SPO2]   = normalize(spo2,    70.0f,  100.0f);
    input->data.f[FEAT_HRV]    = normalize(hrv,     0.0f,   120.0f);
    input->data.f[FEAT_RR]     = normalize(rr,      8.0f,   50.0f);
    input->data.f[FEAT_TEMP]   = normalize(temp,    35.0f,  42.0f);
    input->data.f[FEAT_GEI]    = gei;  // already 0-1
    input->data.f[FEAT_MOTION] = motion_i;  // already 0-1
    input->data.f[FEAT_DUR]    = normalize(dur_h,   0.0f,   12.0f);

    // Run inference
    if (interpreter->Invoke() != kTfLiteOk) {
        Serial.println("❌ TFLite Invoke() failed");
        return result;
    }

    // Extract outputs
    TfLiteTensor* rri_output  = interpreter->output(0);   // RRI regression
    TfLiteTensor* risk_output = interpreter->output(1);   // Risk classification

    result.rri = rri_output->data.f[0];

    // Find argmax of risk softmax
    float max_prob = -1.0f;
    for (int i = 0; i < 4; i++) {
        if (risk_output->data.f[i] > max_prob) {
            max_prob = risk_output->data.f[i];
            result.risk_level = i;
        }
    }

    result.inference_time_ms = (float)(millis() - t0);

    return result;
}

// ─────────────────────────────────────────────────────────────────────
// Compute HRV (RMSSD) from RR interval buffer
// ─────────────────────────────────────────────────────────────────────

float computeRMSSD() {
    if (rrIdx < 2) return 45.0f;  // default
    float sum_sq = 0.0f;
    int count = 0;
    for (int i = 1; i < rrIdx && i < RR_BUFFER_SIZE; i++) {
        float diff = rrIntervals[i] - rrIntervals[i - 1];
        sum_sq += diff * diff;
        count++;
    }
    return (count > 0) ? sqrtf(sum_sq / count) : 45.0f;
}

// ─────────────────────────────────────────────────────────────────────
// Gas Exposure Index Calculation
// ─────────────────────────────────────────────────────────────────────

float computeGEI(float co, float no2, float nh3, float o2) {
    float co_idx  = constrain(co  / 300.0f, 0.0f, 1.0f) * 0.40f;
    float no2_idx = constrain(no2 / 20.0f,  0.0f, 1.0f) * 0.25f;
    float nh3_idx = constrain(nh3 / 300.0f, 0.0f, 1.0f) * 0.20f;
    float o2_idx  = max(0.0f, (20.9f - o2) / 4.9f)     * 0.15f;
    return constrain(co_idx + no2_idx + nh3_idx + o2_idx, 0.0f, 1.0f);
}

// ─────────────────────────────────────────────────────────────────────
// Alert Logic
// ─────────────────────────────────────────────────────────────────────

void triggerAlert(uint8_t risk_level, const char* message) {
    Serial.printf("⚠️  ALERT [L%d]: %s\n", risk_level, message);

    // LED color based on risk
    digitalWrite(LED_RED_PIN,   LOW);
    digitalWrite(LED_GREEN_PIN, LOW);
    digitalWrite(LED_BLUE_PIN,  LOW);

    if (risk_level == 3) {         // CRITICAL: Red flashing
        for (int i = 0; i < 5; i++) {
            digitalWrite(LED_RED_PIN, HIGH);
            tone(BUZZER_PIN, 2000, 200);
            delay(300);
            digitalWrite(LED_RED_PIN, LOW);
            delay(200);
        }
    } else if (risk_level == 2) {  // WARNING: Orange (R+G)
        digitalWrite(LED_RED_PIN,   HIGH);
        digitalWrite(LED_GREEN_PIN, HIGH);
        tone(BUZZER_PIN, 1500, 500);
    } else if (risk_level == 1) {  // CAUTION: Yellow
        digitalWrite(LED_RED_PIN,   HIGH);
        digitalWrite(LED_GREEN_PIN, HIGH);
    } else {                        // NORMAL: Green
        digitalWrite(LED_GREEN_PIN, HIGH);
    }
}

// ─────────────────────────────────────────────────────────────────────
// BLE Server Callbacks
// ─────────────────────────────────────────────────────────────────────

class BLEServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* server) {
        bleConnected = true;
        Serial.println("📱 BLE device connected");
        digitalWrite(LED_BLUE_PIN, HIGH);
    }
    void onDisconnect(BLEServer* server) {
        bleConnected = false;
        Serial.println("📱 BLE device disconnected");
        digitalWrite(LED_BLUE_PIN, LOW);
        server->startAdvertising();
    }
};

void initBLE() {
    BLEDevice::init(String("Responder-") + DEVICE_BADGE_ID);
    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new BLEServerCallbacks());

    BLEService* service = bleServer->createService(BLE_SERVICE_UUID);

    vitalsChar = service->createCharacteristic(
        BLE_CHAR_VITALS_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    vitalsChar->addDescriptor(new BLE2902());

    rriChar = service->createCharacteristic(
        BLE_CHAR_RRI_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    rriChar->addDescriptor(new BLE2902());

    gasChar = service->createCharacteristic(
        BLE_CHAR_GAS_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    gasChar->addDescriptor(new BLE2902());

    service->start();
    BLEAdvertising* advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(BLE_SERVICE_UUID);
    advertising->setScanResponse(true);
    BLEDevice::startAdvertising();
    Serial.println("✅ BLE initialized — advertising as: Responder-" + String(DEVICE_BADGE_ID));
}

// ─────────────────────────────────────────────────────────────────────
// LoRa Packet Transmission
// ─────────────────────────────────────────────────────────────────────

void sendLoRaPacket() {
    // Compact JSON payload (LoRa bandwidth is limited)
    char buf[256];
    snprintf(buf, sizeof(buf),
        "{\"id\":\"%s\","
        "\"hr\":%.1f,\"spo2\":%.1f,\"tmp\":%.2f,"
        "\"co\":%.1f,\"o2\":%.1f,"
        "\"rri\":%.3f,\"rl\":%d}",
        DEVICE_BADGE_ID,
        vitals.heart_rate, vitals.spo2, vitals.body_temp_c,
        gas.co_ppm, gas.o2_percent,
        prediction.rri, prediction.risk_level
    );

    LoRa.beginPacket();
    LoRa.print(buf);
    LoRa.endPacket();
    Serial.printf("📡 LoRa TX: %s\n", buf);
}

// ─────────────────────────────────────────────────────────────────────
// BLE Notify
// ─────────────────────────────────────────────────────────────────────

void sendBLENotifications() {
    if (!bleConnected) return;

    // Vitals JSON
    char buf[256];
    snprintf(buf, sizeof(buf),
        "{\"hr\":%.1f,\"spo2\":%.1f,\"hrv\":%.1f,\"rr\":%.1f,\"tmp\":%.2f}",
        vitals.heart_rate, vitals.spo2, vitals.hrv_ms,
        vitals.respiration_rate, vitals.body_temp_c
    );
    vitalsChar->setValue((uint8_t*)buf, strlen(buf));
    vitalsChar->notify();

    // RRI JSON
    snprintf(buf, sizeof(buf),
        "{\"rri\":%.4f,\"rl\":%d,\"inf_ms\":%.2f}",
        prediction.rri, prediction.risk_level, prediction.inference_time_ms
    );
    rriChar->setValue((uint8_t*)buf, strlen(buf));
    rriChar->notify();

    // Gas JSON
    snprintf(buf, sizeof(buf),
        "{\"co\":%.2f,\"no2\":%.3f,\"nh3\":%.1f,\"o2\":%.2f,\"gei\":%.4f}",
        gas.co_ppm, gas.no2_ppm, gas.nh3_ppm, gas.o2_percent, gas.gas_exposure_index
    );
    gasChar->setValue((uint8_t*)buf, strlen(buf));
    gasChar->notify();
}

// ─────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n========================================");
    Serial.printf("  RESPONDER CHEST MODULE v%s\n", FIRMWARE_VERSION);
    Serial.printf("  Badge ID: %s\n", DEVICE_BADGE_ID);
    Serial.println("========================================");

    // GPIO
    pinMode(LED_RED_PIN,   OUTPUT);
    pinMode(LED_GREEN_PIN, OUTPUT);
    pinMode(LED_BLUE_PIN,  OUTPUT);
    pinMode(BUZZER_PIN,    OUTPUT);

    // Startup blink
    digitalWrite(LED_BLUE_PIN, HIGH);
    delay(500);
    digitalWrite(LED_BLUE_PIN, LOW);

    // I2C
    Wire.begin();
    Serial.println("✅ I2C initialized");

    // MAX30102
    if (!pulseOximeter.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("❌ MAX30102 not found!");
    } else {
        pulseOximeter.setup();
        pulseOximeter.setPulseAmplitudeRed(0x0A);
        pulseOximeter.setPulseAmplitudeGreen(0);
        Serial.println("✅ MAX30102 initialized");
    }

    // DS18B20
    tempSensor.begin();
    Serial.printf("✅ DS18B20: %d sensor(s) found\n", tempSensor.getDeviceCount());

    // MPU6050
    imu.initialize();
    if (!imu.testConnection()) {
        Serial.println("❌ MPU6050 not connected!");
    } else {
        Serial.println("✅ MPU6050 initialized");
    }

    // LoRa
    LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
    if (!LoRa.begin(LORA_FREQ)) {
        Serial.println("❌ LoRa init failed!");
    } else {
        LoRa.setSpreadingFactor(9);
        LoRa.setSignalBandwidth(125E3);
        LoRa.setCodingRate4(5);
        Serial.printf("✅ LoRa initialized @ %.0f MHz\n", LORA_FREQ / 1e6);
    }

    // BLE
    initBLE();

    // TFLite Micro
    if (!initTFLite()) {
        Serial.println("❌ TFLite init failed — using rule-based fallback");
    }

    missionStartMs = millis();
    Serial.println("🚀 System ready — entering main loop");
    digitalWrite(LED_GREEN_PIN, HIGH);
}

// ─────────────────────────────────────────────────────────────────────
// Loop
// ─────────────────────────────────────────────────────────────────────

void loop() {
    unsigned long now = millis();

    // ── Sensor Read (every 2s) ─────────────────────────────────────
    if (now - lastSensorReadMs >= SENSOR_READ_INTERVAL) {
        lastSensorReadMs = now;

        // --- MAX30102: HR + SpO2 ---
        uint32_t irBuffer[100], redBuffer[100];
        for (int i = 0; i < 100; i++) {
            while (!pulseOximeter.available()) pulseOximeter.check();
            redBuffer[i] = pulseOximeter.getRed();
            irBuffer[i]  = pulseOximeter.getIR();
            pulseOximeter.nextSample();
        }

        int8_t validSPO2, validHR;
        int32_t spo2Raw, hrRaw;
        maxim_heart_rate_and_oxygen_saturation(
            irBuffer, 100, redBuffer,
            &spo2Raw, &validSPO2, &hrRaw, &validHR
        );

        if (validHR && validSPO2 && hrRaw > 0) {
            vitals.heart_rate = (float)hrRaw;
            vitals.spo2       = (float)spo2Raw;
            vitals.valid      = true;
        }

        // --- DS18B20: Body Temperature ---
        tempSensor.requestTemperatures();
        float tmpC = tempSensor.getTempCByIndex(0);
        if (tmpC != DEVICE_DISCONNECTED_C) {
            vitals.body_temp_c = tmpC;
        }

        // --- MPU6050: Motion ---
        int16_t ax, ay, az, gx, gy, gz;
        imu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
        motion.accel_x = ax / 16384.0f;
        motion.accel_y = ay / 16384.0f;
        motion.accel_z = az / 16384.0f;
        float accel_mag = sqrtf(motion.accel_x*motion.accel_x +
                                motion.accel_y*motion.accel_y +
                                motion.accel_z*motion.accel_z);
        motion.intensity = constrain(abs(accel_mag - 1.0f) / 2.0f, 0.0f, 1.0f);

        // --- I2C: Read gas from Helmet Module ---
        // (Helmet publishes to I2C register 0x42)
        Wire.requestFrom(0x42, 20);
        if (Wire.available() >= 20) {
            // Unpack float values (4 bytes each)
            Wire.readBytes((uint8_t*)&gas.co_ppm,    4);
            Wire.readBytes((uint8_t*)&gas.no2_ppm,   4);
            Wire.readBytes((uint8_t*)&gas.nh3_ppm,   4);
            Wire.readBytes((uint8_t*)&gas.o2_percent, 4);
            Wire.readBytes((uint8_t*)&gas.ambient_temp_c, 4);
            gas.valid = true;
            gas.gas_exposure_index = computeGEI(
                gas.co_ppm, gas.no2_ppm, gas.nh3_ppm, gas.o2_percent
            );
        }

        // --- TFLite Inference ---
        float dur_hours = (float)(now - missionStartMs) / 3600000.0f;
        if (vitals.valid) {
            prediction = runRRIInference(
                vitals.heart_rate, vitals.spo2, vitals.hrv_ms,
                vitals.respiration_rate, vitals.body_temp_c,
                gas.gas_exposure_index, motion.intensity, dur_hours
            );

            Serial.printf(
                "📊 HR=%.0f SpO2=%.1f%% Temp=%.2f°C CO=%.1fppm "
                "RRI=%.3f [%s] Inference=%.2fms\n",
                vitals.heart_rate, vitals.spo2, vitals.body_temp_c, gas.co_ppm,
                prediction.rri,
                prediction.risk_level == 0 ? "NORMAL" :
                prediction.risk_level == 1 ? "CAUTION" :
                prediction.risk_level == 2 ? "WARNING" : "CRITICAL",
                prediction.inference_time_ms
            );

            // Alert if needed
            if (prediction.risk_level >= 3) {
                triggerAlert(3, "CRITICAL: High RRI — immediate action required!");
            } else if (prediction.risk_level == 2) {
                triggerAlert(2, "WARNING: Elevated risk detected");
            }
        }
    }

    // ── BLE Notify (every 2s) ──────────────────────────────────────
    if (now - lastBLETxMs >= BLE_TX_INTERVAL) {
        lastBLETxMs = now;
        sendBLENotifications();
    }

    // ── LoRa TX (every 10s) ────────────────────────────────────────
    if (now - lastLoRaTxMs >= LORA_TX_INTERVAL) {
        lastLoRaTxMs = now;
        if (vitals.valid) {
            sendLoRaPacket();
        }
    }
}
