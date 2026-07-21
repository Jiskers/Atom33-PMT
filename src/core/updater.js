/* ============================================================
   UPDATER

   Thin wrapper around @tauri-apps/plugin-updater/plugin-process.
   No-ops outside a real Tauri build (e.g. the plain `npm run dev`
   web server) since the plugin IPC bridge only exists inside a
   Tauri webview — lets App.jsx call this unconditionally.
   ============================================================ */
const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function checkForUpdate() {
  if (!inTauri()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  return check(); // null if already current, else an Update with .version/.body/.downloadAndInstall()
}

export async function installUpdateAndRestart(update) {
  await update.downloadAndInstall();
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

// The version actually running right now — the real Tauri build's own
// reported version (so a stale bundle can never lie about itself), or the
// package.json version Vite baked in at build time for the plain web app.
export async function getAppVersion() {
  if (!inTauri()) return __APP_VERSION__;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}
