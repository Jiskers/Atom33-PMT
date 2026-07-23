/* ============================================================
   PLUGIN REGISTRY

   Everything pluggable in devboard registers here. The core
   shell (App.jsx) knows nothing about specific modules or
   views — it only reads these maps. A community plugin is a
   JS file that imports these two functions and calls them.

   ---- id namespacing ----
   Every id is "namespace:name" (e.g. "core:note"). The "core:"
   namespace is reserved for the built-ins in this repo. A
   community plugin picks its own namespace (author or package
   name) so two unrelated plugins can never collide on a bare
   name like "note". Ids without a ":" are rejected at
   registration time.

   ---- registerModule(id, def) ----
   def = {
     label:    string        palette name
     desc:     string        palette description
     w:        number        default pinned width (px)
     version:  number?       data schema version, default 1
     migrate:  (data, fromVersion) => data
                             upgrades `data` by exactly one
                             version (fromVersion → fromVersion+1).
                             Required only once `version` > 1.
                             See core/migrations.js — bump version
                             and add this instead of changing an
                             existing shape in place.
     create:   () => data    starting data for a new instance
     Body:     Component     ({ m, onData }) card contents
     Settings: Component?    ({ m, onData, onPatch }) shown in
                             the instance gear popover, above
                             the core lock/straighten controls
   }

   ---- registerView(id, def) ----
   def = {
     label:     string       "board", "kanban", …
     icon:      string       SVG path data (see core/icons.jsx)
     color:     string       accent used in tree/tabs/header
     zoomable:  bool         core provides zoom UI + gestures
     canvas:    bool         core wraps it in the fixed-size,
                             scalable, toned/grid canvas
     modules:   bool?        this view accepts pinned MODULE_TYPES
                             instances (file.modules / makeModule
                             from views/board.jsx) — the rail's
                             module palette only shows/drags for
                             views that opt in
     fixed:     bool?        view manages its own scrolling
                             (core disables outer scroll)
     newName:   string?      default filename (else "untitled <label>")
     version:   number?      file body schema version, default 1
     migrate:   (data, fromVersion) => data
                             same contract as a module's migrate,
                             applied to the file body (everything
                             create() returns — not name/view)
     create:    () => data   starting file body
     Component: Component    ({ file, onChange, ctx })
     Overlay:   Component?   floating chrome over the viewport
                             (e.g. the draw toolbar)
     headerAction: Component? extra control in the file header
                             (e.g. the Run button)
   }

   ctx (passed to view Components/Overlays) = {
     files, activeId, updateFile, canvasRef, zoom, isMobile,
     say, openFile, selection: { selectedMod, setSelectedMod,
     settingsFor, setSettingsFor }
   }

   ---- registerWidget(id, def) ----
   Home dashboard widgets — a separate plugin category from board
   modules. Unlike a module (self-contained data pinned to one file),
   a widget lives on the project-wide Home dashboard and is free to
   read the rest of the project through ctx (open files, jump to one).
   def = {
     label:    string        palette name
     desc:     string        palette description
     w:        number?       grid column span, default 1 (of 4)
     version:  number?       data schema version, default 1
     migrate:  (data, fromVersion) => data   same contract as a module
     create:   () => data    starting data for a new instance
     Body:     Component     ({ m, onData, ctx }) widget contents —
                             m is the instance ({ id, type, data }),
                             same shape as a module's `m`. ctx is the
                             same object handed to views, so a widget
                             can list/open project files
   }
   ============================================================ */

export const MODULE_TYPES = {};
export const FILE_VIEWS = {};
export const WIDGET_TYPES = {};

const NAMESPACED_ID = /^[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/i;

function assertNamespaced(kind, id) {
  if (!NAMESPACED_ID.test(id)) {
    throw new Error(`${kind} id "${id}" must be namespaced as "namespace:name" (e.g. "core:note") — bare ids risk colliding with other plugins.`);
  }
}

export function registerModule(id, def) {
  assertNamespaced("module", id);
  if (MODULE_TYPES[id]) console.warn(`module "${id}" re-registered`);
  MODULE_TYPES[id] = def;
}

export function registerView(id, def) {
  assertNamespaced("view", id);
  if (FILE_VIEWS[id]) console.warn(`view "${id}" re-registered`);
  FILE_VIEWS[id] = def;
}

export function registerWidget(id, def) {
  assertNamespaced("widget", id);
  if (WIDGET_TYPES[id]) console.warn(`widget "${id}" re-registered`);
  WIDGET_TYPES[id] = def;
}
