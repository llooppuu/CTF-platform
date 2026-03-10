import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.VITE_BACKEND_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/login": { target: backend, changeOrigin: true },
      "/register": { target: backend, changeOrigin: true },
      "/logout": { target: backend, changeOrigin: true },
      "/scoreboard": { target: backend, changeOrigin: true },
      "/challenges": { target: backend, changeOrigin: true },
      "/settings": { target: backend, changeOrigin: true },
      "/teams": { target: backend, changeOrigin: true },
      "/users": { target: backend, changeOrigin: true },
      "/confirm": { target: backend, changeOrigin: true },
      "/reset_password": { target: backend, changeOrigin: true }
    }
  }
});
