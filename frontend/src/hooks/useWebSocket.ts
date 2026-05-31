import { useEffect, useRef, useState, useCallback } from "react";

export type WebSocketEvent = { type: string; ts?: string; data?: any };

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketEvent | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    try {
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => { if (!unmounted.current) setIsConnected(true); };

      socket.onclose = () => {
        if (unmounted.current) return;
        setIsConnected(false);
        // Auto-reconnect after 3s
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      socket.onerror = () => { socket.close(); };

      socket.onmessage = (event) => {
        if (unmounted.current) return;
        try {
          const data = JSON.parse(event.data as string);
          setLastMessage(data);
        } catch { /* ignore malformed */ }
      };
    } catch { /* ignore connection errors */ }
  }, [url]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, lastMessage, send };
}
