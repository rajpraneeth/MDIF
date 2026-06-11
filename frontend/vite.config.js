var _a;
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        port: 5173,
        // Same-origin /api in dev; set VITE_API_BASE_URL=/api/v1 to use it.
        proxy: {
            "/api": {
                target: (_a = process.env.API_PROXY_TARGET) !== null && _a !== void 0 ? _a : "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },
});
