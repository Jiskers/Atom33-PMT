/* ============================================================
   STORAGE ADAPTER

   The app talks only to this interface. Today it's backed by
   localStorage, which works identically in the browser, in a
   Tauri webview, and in a Capacitor webview — so persistence
   works on every platform from day one.

   Later adapters implement the same three functions:
     - Tauri:     @tauri-apps/plugin-fs → one JSON file per
                  devboard file in the user's documents dir
     - Capacitor: @capacitor/filesystem or SQLite plugin
     - Sync:      after writing locally, push the changed file
                  to Google Drive / Dropbox by file id + mtime

   The project shape is already sync-friendly: `files` is a map
   of id → file, so a sync layer diffs per-file, not per-project.

   Schema versioning lives INSIDE the saved payload (schemaVersion,
   plus per-file/per-module `v`), not in this key — see
   core/migrations.js. That's what lets the app upgrade old saves
   forward instead of orphaning them under a new key.
   ============================================================ */

const KEY = "devboard:project";

export const storage = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("storage.load failed", e);
      return null;
    }
  },

  async save(project) {
    try {
      localStorage.setItem(KEY, JSON.stringify(project));
      return true;
    } catch (e) {
      console.error("storage.save failed", e);
      return false;
    }
  },

  async reset() {
    localStorage.removeItem(KEY);
  },
};
