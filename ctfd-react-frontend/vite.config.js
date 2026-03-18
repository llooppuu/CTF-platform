import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.VITE_BACKEND_PROXY_TARGET || "http://localhost:4000";
const publicBase = process.env.VITE_PUBLIC_BASE || "/";
const normalizedBase = publicBase.endsWith("/") ? publicBase : `${publicBase}/`;
const apiProxyPrefix = `${normalizedBase.replace(/\/$/, "")}/api`;

export default defineConfig({
  base: normalizedBase,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      [apiProxyPrefix]: { target: backend, changeOrigin: true }
    }
  }
});
