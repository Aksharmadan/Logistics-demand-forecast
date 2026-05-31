"""ForecastFlow AI — Real-time WebSocket Event Bus"""

import asyncio
import json
import random
from datetime import datetime
from typing import List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

REGIONS = ["North", "South", "East", "West", "Central", "North Hub", "East Metro", "West Coast"]
VEHICLE_IDS = [f"FF-{i:03d}" for i in range(1, 41)]

AI_INSIGHTS = [
    "Demand surge detected in East Metro — recommend pre-positioning 3 vehicles.",
    "North Hub utilization at 94% — capacity threshold approaching.",
    "Model confidence high for next 7-day forecast window.",
    "West Coast showing seasonal uptick — adjust safety stock levels.",
    "Anomaly pattern resolved in South Hub — operations normalized.",
    "Fleet utilization optimized — 12% efficiency gain this week.",
    "Forecast accuracy improved to 94.2% after last retraining.",
    "Central region demand stabilizing after 3-day spike.",
    "Recommend retraining model — 14 days since last training run.",
    "Low fuel alert: 4 vehicles below 25% — schedule refueling.",
]


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, data: dict):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


manager = ConnectionManager()


@router.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def live_data_broadcaster():
    """Background task: streams realistic operational events every 3-6 seconds."""
    tick = 0
    while True:
        await asyncio.sleep(random.uniform(3, 6))
        tick += 1

        if manager.connection_count == 0:
            continue

        # Rotate through event types for variety
        event_type = _pick_event(tick)

        if event_type == "demand_update":
            region = random.choice(REGIONS)
            payload = {
                "type": "demand_update",
                "ts": datetime.utcnow().isoformat(),
                "data": {
                    "region": region,
                    "demand_quantity": round(random.uniform(80, 950), 1),
                    "delta_pct": round(random.uniform(-15, 25), 1),
                },
            }

        elif event_type == "anomaly_alert":
            region = random.choice(REGIONS)
            severity = random.choices(["high", "medium"], weights=[0.3, 0.7])[0]
            actual = round(random.uniform(200, 1200), 1)
            expected = round(actual * random.uniform(0.5, 0.8), 1)
            payload = {
                "type": "anomaly_alert",
                "ts": datetime.utcnow().isoformat(),
                "data": {
                    "region": region,
                    "severity": severity,
                    "actual": actual,
                    "expected": expected,
                    "message": f"Demand {'spike' if actual > expected else 'drop'} in {region}: {actual:.0f} vs expected {expected:.0f}.",
                },
            }

        elif event_type == "vehicle_update":
            vid = random.choice(VEHICLE_IDS)
            status = random.choices(
                ["active", "en_route", "idle", "maintenance"],
                weights=[0.4, 0.35, 0.2, 0.05],
            )[0]
            payload = {
                "type": "vehicle_update",
                "ts": datetime.utcnow().isoformat(),
                "data": {
                    "vehicle_id": vid,
                    "status": status,
                    "region": random.choice(REGIONS),
                    "fuel_level": round(random.uniform(15, 100), 1),
                    "utilization": round(random.uniform(0, 100), 1),
                },
            }

        elif event_type == "ai_insight":
            payload = {
                "type": "ai_insight",
                "ts": datetime.utcnow().isoformat(),
                "data": {
                    "message": random.choice(AI_INSIGHTS),
                    "priority": random.choice(["info", "warning", "critical"]),
                },
            }

        elif event_type == "kpi_update":
            payload = {
                "type": "kpi_update",
                "ts": datetime.utcnow().isoformat(),
                "data": {
                    "active_vehicles": random.randint(22, 35),
                    "network_demand": round(random.uniform(4000, 8000), 0),
                    "open_alerts": random.randint(0, 8),
                    "forecast_accuracy": round(random.uniform(88, 97), 1),
                },
            }

        else:
            payload = {"type": "ping", "ts": datetime.utcnow().isoformat()}

        await manager.broadcast_json(payload)


def _pick_event(tick: int) -> str:
    """Weighted event selection with periodic KPI updates."""
    if tick % 10 == 0:
        return "kpi_update"
    if tick % 7 == 0:
        return "ai_insight"
    return random.choices(
        ["demand_update", "anomaly_alert", "vehicle_update", "ping"],
        weights=[0.40, 0.20, 0.30, 0.10],
    )[0]
