@echo off
REM ============================================================
REM  ResQ Responder System — Local Dev Launcher (Windows)
REM  NO DOCKER required — runs everything natively
REM
REM  Services:
REM   [1] MQTT Broker    → localhost:1883  (Python amqtt)
REM   [2] FastAPI Backend→ localhost:8000
REM   [3] Simulator      → publishes 5 responders every 2s
REM   [4] React Dashboard→ localhost:3000
REM ============================================================

echo.
echo  =========================================
echo   ResQ Responder System - Local Dev Mode
echo   (No Docker required)
echo  =========================================
echo.

SET PROJ=d:\EP PROJECT\Responder-System

REM ── Step 1: Start Python MQTT Broker ─────────────────────────
echo [1/4] Starting Python MQTT Broker on port 1883...
start "MQTT Broker" cmd /k "cd /d "%PROJ%" && python gateway\scripts\mqtt_broker.py"
timeout /t 3 /nobreak > nul
echo      OK: MQTT Broker started on mqtt://localhost:1883
echo.

REM ── Step 2: Start FastAPI Backend ────────────────────────────
echo [2/4] Starting FastAPI Backend on port 8000...
start "ResQ Backend" cmd /k "cd /d "%PROJ%\backend" && python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0"
timeout /t 4 /nobreak > nul
echo      OK: Backend at http://localhost:8000
echo      Docs: http://localhost:8000/docs
echo.

REM ── Step 3: Start Sensor Simulator ───────────────────────────
echo [3/4] Starting Sensor Simulator (5 responders, 2s interval)...
REM Note: Windows asyncio fix (WindowsSelectorEventLoopPolicy) is already applied in main.py
start "ResQ Simulator" cmd /k "cd /d "%PROJ%\sensor_simulator" && python main.py --broker localhost --responders 5 --interval 2"
timeout /t 2 /nobreak > nul
echo      OK: Simulator publishing live data
echo.

REM ── Step 4: Start React Dashboard ────────────────────────────
echo [4/4] Starting React Dashboard on port 3000...
start "ResQ Dashboard" cmd /k "cd /d "%PROJ%\dashboard" && npm run dev"
echo      OK: Dashboard at http://localhost:3000 (may take 10-15s to start)
echo.

echo  =========================================
echo   All services launched!
echo.
echo   Dashboard:   http://localhost:3000
echo   Backend API: http://localhost:8000
echo   API Docs:    http://localhost:8000/docs
echo  =========================================
echo.
echo  Press any key to open Dashboard in browser...
pause > nul
start http://localhost:3000
