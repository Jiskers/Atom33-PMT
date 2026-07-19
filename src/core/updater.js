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
