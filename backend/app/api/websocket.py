"""
WebSocket endpoint — pushes real-time data to dashboard clients.
"""

import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

ws_router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WS connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WS disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: dict):
        """Broadcast a typed event to all connected dashboard clients."""
        payload = json.dumps({"type": event_type, "data": data})
        dead = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead.add(connection)
        for d in dead:
            self.active_connections.discard(d)

    async def send_to(self, websocket: WebSocket, event_type: str, data: dict):
        payload = json.dumps({"type": event_type, "data": data})
        await websocket.send_text(payload)


ws_manager = ConnectionManager()


@ws_router.websocket("/dashboard")
async def dashboard_ws(websocket: WebSocket):
    """
    WebSocket endpoint for the dashboard.
    
    Events sent by server:
      - vitals_update   : { responder_id, heart_rate, spo2, ... }
      - gas_update      : { responder_id, co_ppm, no2_ppm, ... }
      - rri_update      : { responder_id, rri, risk_level }
      - alert_triggered : { alert_id, type, severity, message }
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, client can send pings
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@ws_router.websocket("/responder/{badge_id}")
async def responder_ws(websocket: WebSocket, badge_id: str):
    """Per-responder WebSocket for the Android app or field tablet."""
    await ws_manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
