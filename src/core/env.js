// True inside a real Tauri webview (desktop or mobile) — false in the
// plain web build (npm run dev / a browser tab), where Tauri's plugin
// IPC bridge doesn't exist.
export const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
