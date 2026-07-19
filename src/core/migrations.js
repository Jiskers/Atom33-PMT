/* ============================================================
   MIGRATIONS

   Every saved project carries a schemaVersion. On load,
   migrateProject() walks it forward to PROJECT_SCHEMA_VERSION
   before the app ever sees it, then walks every file and every
   module instance forward through its own plugin-declared
   version/migrate() — see the contract in core/registry.js.

   Rule: never change what an existing version number means.
   When a module or view's data shape changes, bump its `version`
   in the registration and add a `migrate(data, fromVersion)` that
   returns the previous version's data upgraded by one step. This
   function chains those steps, so a save from three versions ago
   still loads correctly.
   ============================================================ */
import { MODULE_TYPES, FILE_VIEWS } from "./registry.js";

export const PROJECT_SCHEMA_VERSION = 2;

function migrateModule(m) {
  const def = MODULE_TYPES[m.type];
  if (!def) return m; // unknown type (plugin removed/renamed) — leave as-is
  const target = def.version ?? 1;
  const { v = 1, data, ...rest } = m;
  let cur = data;
  let ver = v;
  while (ver < target && def.migrate) {
    cur = def.migrate(cur, ver);
    ver++;
  }
  return { ...rest, v: target, data: cur };
}

function migrateFile(f) {
  const def = FILE_VIEWS[f.view];
  if (!def) return f; // unknown view (plugin removed/renamed) — leave as-is
  const target = def.version ?? 1;
  const { v = 1, name, view, ...data } = f;
  let cur = data;
  let ver = v;
  while (ver < target && def.migrate) {
    cur = def.migrate(cur, ver);
    ver++;
  }
  if (cur.modules) cur = { ...cur, modules: cur.modules.map(migrateModule) };
  return { name, view, v: target, ...cur };
}

// Structural changes to the top-level project envelope (files/tree/tabs/
// active/expanded shape itself) go here, keyed by the version migrating FROM.
// Runs BEFORE migrateFile/migrateModule, so ids are already correct by the
// time those look plugins up in the registry.
const V1_ID_RENAMES = {
  views: { board: "core:board", kanban: "core:kanban", sheet: "core:sheet", draw: "core:draw", code: "core:code" },
  modules: { note: "core:note", checklist: "core:checklist", mechanic: "core:mechanic", ref: "core:ref" },
};

function migrateProjectShape(project, fromVersion) {
  if (fromVersion === 1) {
    // v1 -> v2: built-in module/view ids became namespaced ("board" ->
    // "core:board") so community plugins can't collide with them on a bare name.
    const files = Object.fromEntries(
      Object.entries(project.files ?? {}).map(([id, f]) => {
        const view = V1_ID_RENAMES.views[f.view] ?? f.view;
        const modules = f.modules?.map((m) => ({ ...m, type: V1_ID_RENAMES.modules[m.type] ?? m.type }));
        return [id, modules ? { ...f, view, modules } : { ...f, view }];
      })
    );
    return { ...project, files };
  }
  return project;
}

export function migrateProject(raw) {
  if (!raw) return raw;
  let { schemaVersion = 1, ...rest } = raw;
  while (schemaVersion < PROJECT_SCHEMA_VERSION) {
    rest = migrateProjectShape(rest, schemaVersion);
    schemaVersion++;
  }
  const files = Object.fromEntries(
    Object.entries(rest.files ?? {}).map(([id, f]) => [id, migrateFile(f)])
  );
  return { ...rest, files, schemaVersion: PROJECT_SCHEMA_VERSION };
}
