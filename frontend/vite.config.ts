import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://127.0.0.1:8000",
      "/upload-data": "http://127.0.0.1:8000",
      "/train-model": "http://127.0.0.1:8000",
      "/predict": "http://127.0.0.1:8000",
      "/analytics": "http://127.0.0.1:8000",
      "/detect-anomalies": "http://127.0.0.1:8000",
      "/ingest": "http://127.0.0.1:8000",
      "/export": "http://127.0.0.1:8000",
      "/admin": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
    },
  },
});
