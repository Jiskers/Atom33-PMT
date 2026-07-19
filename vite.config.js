import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri serves this same dev server. Keep the port stable so
// tauri.conf.json can point at it, and never watch src-tauri/target —
// it's Rust's build output, gets rewritten constantly mid-compile, and
// watching it races cargo's own writes (EBUSY on Windows).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: { outDir: "dist" },
});
