/* ============================================================
   STORAGE ADAPTER

   The app talks only to this interface: load(), save(project), reset().
   App.jsx always hands save() the WHOLE project object on every
   autosave tick — this adapter decides internally what actually needs
   writing, so callers never change no matter which backend is active.

   - Web (plain browser): one localStorage blob. Capped around ~5MB.
   - Tauri (desktop + mobile — same plugin, same code path): one JSON
     file per devboard file under $APPDATA/files/<id>.json, plus a
     project.json manifest for everything else (tree, tabs, active,
     expanded). Real files, no size cap, and per-file writes only
     touch what actually changed — which is also exactly the shape a
     future sync layer needs (diff per file by id, not per project).

   Schema versioning lives INSIDE the saved payload (schemaVersion,
   plus per-file/per-module `v`), not in a filename or key — see
   core/migrations.js. That's what lets the app upgrade old saves
   forward instead of orphaning them under a new location.
   ============================================================ */
import { inTauri } from "./env.js";

const KEY = "devboard:project";

const webStorage = {
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

const PROJECT_FILE = "project.json";
const FILES_DIR = "files";

// Last-written-to-disk JSON strings, so save() only touches files that
// actually changed instead of rewriting the whole project every autosave.
let manifestCache = null;
const fileCache = new Map();

const fsStorage = {
  async load() {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    try {
      if (!(await fs.exists(PROJECT_FILE, { baseDir: base.AppData }))) return null;
      const manifestRaw = await fs.readTextFile(PROJECT_FILE, { baseDir: base.AppData });
      const manifest = JSON.parse(manifestRaw);
      manifestCache = manifestRaw;

      const files = {};
      fileCache.clear();
      if (await fs.exists(FILES_DIR, { baseDir: base.AppData })) {
        const entries = await fs.readDir(FILES_DIR, { baseDir: base.AppData });
        for (const entry of entries) {
          if (!entry.name?.endsWith(".json")) continue;
          const id = entry.name.slice(0, -5);
          const raw = await fs.readTextFile(`${FILES_DIR}/${entry.name}`, { baseDir: base.AppData });
          files[id] = JSON.parse(raw);
          fileCache.set(id, raw);
        }
      }
      return { ...manifest, files };
    } catch (e) {
      console.error("storage.load (fs) failed", e);
      return null;
    }
  },

  async save(project) {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    try {
      const { files, ...manifest } = project;
      await fs.mkdir(FILES_DIR, { baseDir: base.AppData, recursive: true });

      const manifestRaw = JSON.stringify(manifest);
      if (manifestRaw !== manifestCache) {
        await fs.writeTextFile(PROJECT_FILE, manifestRaw, { baseDir: base.AppData });
        manifestCache = manifestRaw;
      }

      const seen = new Set();
      for (const [id, data] of Object.entries(files)) {
        seen.add(id);
        const raw = JSON.stringify(data);
        if (fileCache.get(id) !== raw) {
          await fs.writeTextFile(`${FILES_DIR}/${id}.json`, raw, { baseDir: base.AppData });
          fileCache.set(id, raw);
        }
      }
      for (const id of [...fileCache.keys()]) {
        if (seen.has(id)) continue;
        await fs.remove(`${FILES_DIR}/${id}.json`, { baseDir: base.AppData }).catch(() => {});
        fileCache.delete(id);
      }
      return true;
    } catch (e) {
      console.error("storage.save (fs) failed", e);
      return false;
    }
  },

  async reset() {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    try {
      await fs.remove(PROJECT_FILE, { baseDir: base.AppData }).catch(() => {});
      await fs.remove(FILES_DIR, { baseDir: base.AppData, recursive: true }).catch(() => {});
    } catch (e) {
      console.error("storage.reset (fs) failed", e);
    }
    manifestCache = null;
    fileCache.clear();
  },
};

export const storage = inTauri() ? fsStorage : webStorage;
