"""In-process ring buffer simulating a streaming / Kafka-style event log for the live dashboard."""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any

_MAX = 300
_buf: deque[dict[str, Any]] = deque(maxlen=_MAX)
_lock = Lock()


def publish_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    row = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": event_type,
        **payload,
    }
    with _lock:
        _buf.appendleft(row)
    return row


def recent_events(limit: int = 80) -> list[dict[str, Any]]:
    with _lock:
        return list(_buf)[:limit]
