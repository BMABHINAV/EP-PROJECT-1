-- ============================================================
-- Responder System Database Schema
-- TimescaleDB (PostgreSQL extension)
-- ============================================================

-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ─────────────────────────────────────────────
-- RESPONDERS Table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id        VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    role            VARCHAR(50) NOT NULL,  -- 'firefighter','ndrf','paramedic'
    team            VARCHAR(50),
    blood_group     VARCHAR(5),
    age             INTEGER,
    weight_kg       FLOAT,
    height_cm       FLOAT,
    contact_next_of_kin VARCHAR(15),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- MISSIONS Table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_code    VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(150),
    location        VARCHAR(200),
    latitude        FLOAT,
    longitude       FLOAT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'active',  -- 'active','completed','aborted'
    commander_id    UUID REFERENCES responders(id),
    hazard_level    INTEGER DEFAULT 1,  -- 1-5
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- RESPONDER_MISSIONS (many-to-many)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responder_missions (
    responder_id    UUID REFERENCES responders(id) ON DELETE CASCADE,
    mission_id      UUID REFERENCES missions(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    left_at         TIMESTAMPTZ,
    role_in_mission VARCHAR(50),
    PRIMARY KEY (responder_id, mission_id)
);

-- ─────────────────────────────────────────────
-- VITALS Table (hypertable)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id    UUID NOT NULL REFERENCES responders(id),
    mission_id      UUID REFERENCES missions(id),
    heart_rate      FLOAT,          -- bpm
    hrv_ms          FLOAT,          -- RMSSD in ms
    spo2            FLOAT,          -- %
    respiration_rate FLOAT,         -- breaths/min
    body_temp_c     FLOAT,          -- Celsius
    systolic_bp     FLOAT,          -- optional, mmHg
    diastolic_bp    FLOAT,          -- optional, mmHg
    ecg_flag        BOOLEAN DEFAULT FALSE,
    data_source     VARCHAR(20) DEFAULT 'chest_module'
);

SELECT create_hypertable('vitals', 'time', if_not_exists => TRUE);

-- ─────────────────────────────────────────────
-- GAS_READINGS Table (hypertable)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gas_readings (
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id    UUID NOT NULL REFERENCES responders(id),
    mission_id      UUID REFERENCES missions(id),
    co_ppm          FLOAT DEFAULT 0,    -- Carbon Monoxide ppm
    no2_ppm         FLOAT DEFAULT 0,    -- Nitrogen Dioxide ppm
    nh3_ppm         FLOAT DEFAULT 0,    -- Ammonia ppm
    o2_percent      FLOAT DEFAULT 20.9, -- Oxygen %
    ambient_temp_c  FLOAT,
    humidity_pct    FLOAT,
    pressure_hpa    FLOAT,
    gas_exposure_index FLOAT            -- derived combined index 0-1
);

SELECT create_hypertable('gas_readings', 'time', if_not_exists => TRUE);

-- ─────────────────────────────────────────────
-- MOTION_DATA Table (hypertable)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS motion_data (
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id    UUID NOT NULL REFERENCES responders(id),
    mission_id      UUID REFERENCES missions(id),
    accel_x         FLOAT,
    accel_y         FLOAT,
    accel_z         FLOAT,
    gyro_x          FLOAT,
    gyro_y          FLOAT,
    gyro_z          FLOAT,
    activity_label  VARCHAR(30),        -- 'walking','running','stationary','climbing'
    step_count      INTEGER,
    motion_intensity FLOAT              -- 0-1 normalized
);

SELECT create_hypertable('motion_data', 'time', if_not_exists => TRUE);

-- ─────────────────────────────────────────────
-- PREDICTIONS Table (hypertable) — RRI outputs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
    time                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id        UUID NOT NULL REFERENCES responders(id),
    mission_id          UUID REFERENCES missions(id),
    rri                 FLOAT NOT NULL,     -- Rescue Risk Index 0-1
    risk_level          VARCHAR(15),        -- 'normal','caution','warning','critical'
    fatigue_probability FLOAT,              -- 0-1
    collapse_probability FLOAT,             -- 0-1
    model_version       VARCHAR(20) DEFAULT 'v1.0',
    inference_time_ms   FLOAT,              -- edge inference latency
    features_json       JSONB               -- raw input features snapshot
);

SELECT create_hypertable('predictions', 'time', if_not_exists => TRUE);

-- ─────────────────────────────────────────────
-- ALERTS Table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id    UUID NOT NULL REFERENCES responders(id),
    mission_id      UUID REFERENCES missions(id),
    alert_type      VARCHAR(50) NOT NULL,   -- 'co_poisoning','fatigue','spo2_drop','high_temp','critical_rri'
    severity        VARCHAR(15) NOT NULL,   -- 'info','warning','critical'
    message         TEXT NOT NULL,
    rri_at_alert    FLOAT,
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES responders(id),
    acknowledged_at TIMESTAMPTZ,
    resolved        BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ
);

-- ─────────────────────────────────────────────
-- LOCATION Table (hypertable)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id    UUID NOT NULL REFERENCES responders(id),
    mission_id      UUID REFERENCES missions(id),
    latitude        FLOAT,
    longitude       FLOAT,
    altitude_m      FLOAT,
    accuracy_m      FLOAT,
    source          VARCHAR(20) DEFAULT 'gps'  -- 'gps','indoor','estimated'
);

SELECT create_hypertable('locations', 'time', if_not_exists => TRUE);

-- ─────────────────────────────────────────────
-- BATTERY_STATUS Table (hypertable)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS battery_status (
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id    UUID NOT NULL REFERENCES responders(id),
    module          VARCHAR(20),    -- 'helmet','chest','wrist'
    voltage_v       FLOAT,
    percentage      FLOAT,          -- 0-100
    charging        BOOLEAN DEFAULT FALSE,
    estimated_runtime_min FLOAT
);

SELECT create_hypertable('battery_status', 'time', if_not_exists => TRUE);

-- ─────────────────────────────────────────────
-- SENSOR_LOGS Table — raw telemetry for debugging
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sensor_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responder_id    UUID REFERENCES responders(id),
    module          VARCHAR(20),
    raw_payload     JSONB,
    firmware_version VARCHAR(20),
    rssi_dbm        INTEGER,
    snr_db          FLOAT
);

-- ─────────────────────────────────────────────
-- TimescaleDB Continuous Aggregates (1-min rollup)
-- ─────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS vitals_1min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket,
    responder_id,
    AVG(heart_rate)      AS avg_hr,
    MIN(heart_rate)      AS min_hr,
    MAX(heart_rate)      AS max_hr,
    AVG(spo2)            AS avg_spo2,
    AVG(body_temp_c)     AS avg_temp,
    AVG(respiration_rate) AS avg_rr
FROM vitals
GROUP BY bucket, responder_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS gas_1min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS bucket,
    responder_id,
    MAX(co_ppm)     AS max_co,
    MAX(no2_ppm)    AS max_no2,
    MAX(nh3_ppm)    AS max_nh3,
    MIN(o2_percent) AS min_o2,
    AVG(gas_exposure_index) AS avg_gei
FROM gas_readings
GROUP BY bucket, responder_id;

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vitals_responder ON vitals (responder_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_gas_responder    ON gas_readings (responder_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_pred_responder   ON predictions (responder_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type      ON alerts (alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unacked   ON alerts (acknowledged) WHERE acknowledged = FALSE;
