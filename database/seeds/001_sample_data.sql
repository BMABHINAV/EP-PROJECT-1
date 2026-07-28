-- ============================================================
-- Seed Data — Sample responders and missions for simulation
-- ============================================================

-- Sample Responders
INSERT INTO responders (badge_id, name, role, team, blood_group, age, weight_kg, height_cm) VALUES
('NDRF-001', 'Arjun Singh',    'firefighter', 'Alpha', 'O+',  32, 78.0, 178.0),
('NDRF-002', 'Priya Sharma',   'paramedic',   'Alpha', 'A+',  28, 62.0, 165.0),
('NDRF-003', 'Ravi Kumar',     'firefighter', 'Bravo', 'B+',  35, 82.0, 180.0),
('NDRF-004', 'Anita Patel',    'ndrf',        'Bravo', 'AB-', 29, 68.0, 170.0),
('NDRF-005', 'Suresh Menon',   'firefighter', 'Alpha', 'O-',  40, 85.0, 182.0)
ON CONFLICT (badge_id) DO NOTHING;

-- Sample Mission
INSERT INTO missions (mission_code, name, location, latitude, longitude, hazard_level, status) VALUES
('OPS-2026-001', 'Industrial Fire Response - Sector 7', 'Bhilai Steel Plant, Chhattisgarh', 21.2096, 81.4285, 4, 'active')
ON CONFLICT (mission_code) DO NOTHING;
