"use client";

import * as React from "react";
import { getToken, wsLiveUrl } from "@/lib/api";

export type LiveTick = { region: string; demand_quantity: number; ts: string };

export function useLiveDemand(enabled: boolean) {
  const [ticks, setTicks] = React.useState<LiveTick[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    const url = wsLiveUrl(token);
    if (!url) return;
    const ws = new WebSocket(url);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data as string);
        if (d.channel === "demand.tick") {
          setTicks((prev) => [{ region: d.region, demand_quantity: d.demand_quantity, ts: d.ts }, ...prev].slice(0, 40));
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      ws.close();
    };
  }, [enabled]);

  return { ticks, connected };
}
