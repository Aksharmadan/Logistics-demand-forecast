from __future__ import annotations

import asyncio
import json
import random
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_settings
from app.security import decode_token
from app.stream_bus import publish_event

router = APIRouter()
settings = get_settings()


@router.websocket("/ws/live")
async def live_demand_socket(websocket: WebSocket, token: str | None = None) -> None:
    await websocket.accept()
    payload = decode_token(token) if token else None
    if payload is None or not payload.sub:
        await websocket.close(code=4401)
        return

    regions = [
        "North Hub",
        "South Hub",
        "East Metro",
        "West Port",
        "Central DC",
        "Chennai",
        "Mumbai",
        "Bengaluru",
    ]
    try:
        while True:
            await asyncio.sleep(2.2)
            r = random.choice(regions)
            base = random.uniform(80, 320)
            noise = random.uniform(-18, 22)
            qty = max(0.0, base + noise)
            msg = {
                "channel": "demand.tick",
                "region": r,
                "demand_quantity": round(qty, 2),
                "ts": datetime.now(timezone.utc).isoformat(),
            }
            publish_event("demand_tick", {"region": r, "demand_quantity": qty})
            await websocket.send_text(json.dumps(msg))
    except WebSocketDisconnect:
        return
