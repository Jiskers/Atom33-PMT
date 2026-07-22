/* ============================================================
   STORAGE ADAPTER

   The app talks only to this interface. App.jsx always hands save()
   the WHOLE active project's data on every autosave tick — this
   adapter decides internally what actually needs writing and which
   project "active" currently means, so callers never change no
   matter which backend is active or how many projects exist.

   - load() / save(project) / reset() — operate on whichever project
     is currently active.
   - listProjects() / createProject(name) / renameProject(id, name) /
     getActiveProjectId() / setActiveProjectId(id) — project management.

   Backends:
   - Web (plain browser): one localStorage key per project, capped
     around ~5MB each.
   - Tauri (desktop + mobile — same plugin, same code path): one JSON
     file per devboard file under $APPDATA/projects/<id>/files/<fid>.json,
     plus a project.json manifest per project. Per-file writes only
     touch what actually changed — which is also exactly the shape a
     future sync layer needs (diff per file by id, not per project).

   Pre-multi-project installs kept a single project directly at the
   storage root. The first time the project registry is empty, that
   data is adopted as the user's first project instead of lost — see
   migrateLegacyProject() / migrateLegacyWeb() below.

   Schema versioning lives INSIDE each project's saved payload
   (schemaVersion, plus per-file/per-module `v`), not in a filename or
   key — see core/migrations.js. That's what lets the app upgrade old
   saves forward instead of orphaning them under a new location.
   ============================================================ */
import { inTauri } from "./env.js";

function makeProjectId() {
  return "proj_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------------------------------------------------------- */
/* Web backend                                                       */
/* ---------------------------------------------------------------- */

const KEY = "devboard:project"; // legacy bare key; per-project keys are `${KEY}:${id}`
const REGISTRY_KEY = "devboard:projects";

let webRegistryCache = null;

function readRegistryWeb() {
  if (webRegistryCache) return webRegistryCache;
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    webRegistryCache = raw ? JSON.parse(raw) : { activeId: null, projects: [] };
  } catch {
    webRegistryCache = { activeId: null, projects: [] };
  }
  return webRegistryCache;
}
function writeRegistryWeb(registry) {
  webRegistryCache = registry;
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}
function migrateLegacyWeb(registry) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    return null;
  }
  const id = makeProjectId();
  localStorage.setItem(`${KEY}:${id}`, raw);
  localStorage.removeItem(KEY);
  registry.projects.push({ id, name: manifest.tree?.[0]?.name || "My Project", createdAt: Date.now() });
  registry.activeId = id;
  writeRegistryWeb(registry);
  return id;
}
function ensureActiveIdWeb({ createIfMissing }) {
  const registry = readRegistryWeb();
  if (registry.activeId && registry.projects.some((p) => p.id === registry.activeId)) return registry.activeId;
  const migratedId = migrateLegacyWeb(registry);
  if (migratedId) return migratedId;
  if (!createIfMissing) return null;
  const id = makeProjectId();
  registry.projects.push({ id, name: "My Project", createdAt: Date.now() });
  registry.activeId = id;
  writeRegistryWeb(registry);
  return id;
}

const webStorage = {
  async load() {
    try {
      const id = ensureActiveIdWeb({ createIfMissing: false });
      if (!id) return null;
      const raw = localStorage.getItem(`${KEY}:${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("storage.load failed", e);
      return null;
    }
  },
  async save(project) {
    try {
      const id = ensureActiveIdWeb({ createIfMissing: true });
      localStorage.setItem(`${KEY}:${id}`, JSON.stringify(project));
      return true;
    } catch (e) {
      console.error("storage.save failed", e);
      return false;
    }
  },
  async reset() {
    const id = ensureActiveIdWeb({ createIfMissing: false });
    if (id) localStorage.removeItem(`${KEY}:${id}`);
  },
  async listProjects() {
    ensureActiveIdWeb({ createIfMissing: false });
    return [...readRegistryWeb().projects];
  },
  async getActiveProjectId() {
    return ensureActiveIdWeb({ createIfMissing: false });
  },
  async setActiveProjectId(id) {
    const registry = readRegistryWeb();
    if (!registry.projects.some((p) => p.id === id)) return;
    registry.activeId = id;
    writeRegistryWeb(registry);
  },
  async createProject(name) {
    const registry = readRegistryWeb();
    const id = makeProjectId();
    registry.projects.push({ id, name: (name || "").trim() || "My Project", createdAt: Date.now() });
    registry.activeId = id;
    localStorage.setItem(`${KEY}:${id}`, JSON.stringify({ tree: [], tabs: [], active: null, expanded: [] }));
    writeRegistryWeb(registry);
    return id;
  },
  async renameProject(id, name) {
    const registry = readRegistryWeb();
    const p = registry.projects.find((p) => p.id === id);
    if (!p || !name.trim()) return;
    p.name = name.trim();
    writeRegistryWeb(registry);
  },
};

/* ---------------------------------------------------------------- */
/* Tauri fs backend                                                   */
/* ---------------------------------------------------------------- */

const REGISTRY_FILE = "projects.json";
const LEGACY_PROJECT_FILE = "project.json";
const LEGACY_FILES_DIR = "files";

const projFilesDir = (id) => `projects/${id}/files`;
const projManifestPath = (id) => `projects/${id}/project.json`;

let registryCache = null;
let manifestCache = null;
const fileCache = new Map();

async function readRegistry(fs, base) {
  if (registryCache) return registryCache;
  if (await fs.exists(REGISTRY_FILE, { baseDir: base.AppData })) {
    registryCache = JSON.parse(await fs.readTextFile(REGISTRY_FILE, { baseDir: base.AppData }));
  } else {
    registryCache = { activeId: null, projects: [] };
  }
  return registryCache;
}
async function writeRegistry(fs, base, registry) {
  registryCache = registry;
  await fs.writeTextFile(REGISTRY_FILE, JSON.stringify(registry), { baseDir: base.AppData });
}
async function migrateLegacyProject(fs, base, registry) {
  if (!(await fs.exists(LEGACY_PROJECT_FILE, { baseDir: base.AppData }))) return null;
  const manifestRaw = await fs.readTextFile(LEGACY_PROJECT_FILE, { baseDir: base.AppData });
  const manifest = JSON.parse(manifestRaw);
  const id = makeProjectId();

  await fs.mkdir(projFilesDir(id), { baseDir: base.AppData, recursive: true });
  await fs.writeTextFile(projManifestPath(id), manifestRaw, { baseDir: base.AppData });
  if (await fs.exists(LEGACY_FILES_DIR, { baseDir: base.AppData })) {
    const entries = await fs.readDir(LEGACY_FILES_DIR, { baseDir: base.AppData });
    for (const entry of entries) {
      if (!entry.name?.endsWith(".json")) continue;
      const raw = await fs.readTextFile(`${LEGACY_FILES_DIR}/${entry.name}`, { baseDir: base.AppData });
      await fs.writeTextFile(`${projFilesDir(id)}/${entry.name}`, raw, { baseDir: base.AppData });
    }
  }
  await fs.remove(LEGACY_PROJECT_FILE, { baseDir: base.AppData }).catch(() => {});
  await fs.remove(LEGACY_FILES_DIR, { baseDir: base.AppData, recursive: true }).catch(() => {});

  registry.projects.push({ id, name: manifest.tree?.[0]?.name || "My Project", createdAt: Date.now() });
  registry.activeId = id;
  await writeRegistry(fs, base, registry);
  return id;
}
// Single-flight guard: this whole function is async (real fs IO, unlike the
// web backend's synchronous localStorage calls), so two callers racing here
// — e.g. React StrictMode's intentional double-invoke of effects in dev —
// would otherwise both see "no active project" and both migrate/create one,
// with only the last registry write winning and orphaning the other.
let ensureActiveIdPromise = null;

async function ensureActiveId(fs, base, { createIfMissing }) {
  const registry = await readRegistry(fs, base);
  if (registry.activeId && registry.projects.some((p) => p.id === registry.activeId)) return registry.activeId;

  if (!ensureActiveIdPromise) {
    ensureActiveIdPromise = (async () => {
      const reg = await readRegistry(fs, base);
      if (reg.activeId && reg.projects.some((p) => p.id === reg.activeId)) return reg.activeId;
      const migratedId = await migrateLegacyProject(fs, base, reg);
      if (migratedId) return migratedId;
      if (!createIfMissing) return null;
      const id = makeProjectId();
      reg.projects.push({ id, name: "My Project", createdAt: Date.now() });
      reg.activeId = id;
      await writeRegistry(fs, base, reg);
      return id;
    })().finally(() => {
      ensureActiveIdPromise = null;
    });
  }
  return ensureActiveIdPromise;
}

const fsStorage = {
  async load() {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    try {
      const id = await ensureActiveId(fs, base, { createIfMissing: false });
      if (!id) return null;
      if (!(await fs.exists(projManifestPath(id), { baseDir: base.AppData }))) return null;
      const manifestRaw = await fs.readTextFile(projManifestPath(id), { baseDir: base.AppData });
      manifestCache = manifestRaw;

      const files = {};
      fileCache.clear();
      if (await fs.exists(projFilesDir(id), { baseDir: base.AppData })) {
        const entries = await fs.readDir(projFilesDir(id), { baseDir: base.AppData });
        for (const entry of entries) {
          if (!entry.name?.endsWith(".json")) continue;
          const fid = entry.name.slice(0, -5);
          const raw = await fs.readTextFile(`${projFilesDir(id)}/${entry.name}`, { baseDir: base.AppData });
          files[fid] = JSON.parse(raw);
          fileCache.set(fid, raw);
        }
      }
      return { ...JSON.parse(manifestRaw), files };
    } catch (e) {
      console.error("storage.load (fs) failed", e);
      return null;
    }
  },

  async save(project) {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    try {
      const id = await ensureActiveId(fs, base, { createIfMissing: true });
      const { files, ...manifest } = project;
      await fs.mkdir(projFilesDir(id), { baseDir: base.AppData, recursive: true });

      const manifestRaw = JSON.stringify(manifest);
      if (manifestRaw !== manifestCache) {
        await fs.writeTextFile(projManifestPath(id), manifestRaw, { baseDir: base.AppData });
        manifestCache = manifestRaw;
      }
      const seen = new Set();
      for (const [fid, data] of Object.entries(files)) {
        seen.add(fid);
        const raw = JSON.stringify(data);
        if (fileCache.get(fid) !== raw) {
          await fs.writeTextFile(`${projFilesDir(id)}/${fid}.json`, raw, { baseDir: base.AppData });
          fileCache.set(fid, raw);
        }
      }
      for (const fid of [...fileCache.keys()]) {
        if (seen.has(fid)) continue;
        await fs.remove(`${projFilesDir(id)}/${fid}.json`, { baseDir: base.AppData }).catch(() => {});
        fileCache.delete(fid);
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
      const id = await ensureActiveId(fs, base, { createIfMissing: false });
      if (id) {
        await fs.remove(projManifestPath(id), { baseDir: base.AppData }).catch(() => {});
        await fs.remove(projFilesDir(id), { baseDir: base.AppData, recursive: true }).catch(() => {});
      }
    } catch (e) {
      console.error("storage.reset (fs) failed", e);
    }
    manifestCache = null;
    fileCache.clear();
  },

  async listProjects() {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    await ensureActiveId(fs, base, { createIfMissing: false }); // surfaces a migrated legacy project, if any
    return [...(await readRegistry(fs, base)).projects];
  },

  async getActiveProjectId() {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    return ensureActiveId(fs, base, { createIfMissing: false });
  },

  async setActiveProjectId(id) {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    const registry = await readRegistry(fs, base);
    if (!registry.projects.some((p) => p.id === id)) return;
    registry.activeId = id;
    await writeRegistry(fs, base, registry);
    manifestCache = null;
    fileCache.clear();
  },

  async createProject(name) {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    const registry = await readRegistry(fs, base);
    const id = makeProjectId();
    registry.projects.push({ id, name: (name || "").trim() || "My Project", createdAt: Date.now() });
    registry.activeId = id;
    await fs.mkdir(projFilesDir(id), { baseDir: base.AppData, recursive: true });
    await fs.writeTextFile(projManifestPath(id), JSON.stringify({ tree: [], tabs: [], active: null, expanded: [] }), { baseDir: base.AppData });
    await writeRegistry(fs, base, registry);
    manifestCache = null;
    fileCache.clear();
    return id;
  },

  async renameProject(id, name) {
    const fs = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory: base } = fs;
    const registry = await readRegistry(fs, base);
    const p = registry.projects.find((p) => p.id === id);
    if (!p || !name.trim()) return;
    p.name = name.trim();
    await writeRegistry(fs, base, registry);
  },
};

export const storage = inTauri() ? fsStorage : webStorage;
