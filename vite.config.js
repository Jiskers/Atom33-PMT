import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri note: when you add Tauri later, it will serve this same dev server.
// Keep the port stable so tauri.conf.json can point at it.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist" },
});
