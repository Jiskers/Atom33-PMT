/* ============================================================
   PLUGIN REGISTRY

   Everything pluggable in devboard registers here. The core
   shell (App.jsx) knows nothing about specific modules or
   views — it only reads these maps. A community plugin is a
   JS file that imports these two functions and calls them.

   ---- registerModule(id, def) ----
   def = {
     label:    string        palette name
     desc:     string        palette description
     w:        number        default pinned width (px)
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
     fixed:     bool?        view manages its own scrolling
                             (core disables outer scroll)
     newName:   string?      default filename (else "untitled <label>")
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
   ============================================================ */

export const MODULE_TYPES = {};
export const FILE_VIEWS = {};

export function registerModule(id, def) {
  if (MODULE_TYPES[id]) console.warn(`module "${id}" re-registered`);
  MODULE_TYPES[id] = def;
}

export function registerView(id, def) {
  if (FILE_VIEWS[id]) console.warn(`view "${id}" re-registered`);
  FILE_VIEWS[id] = def;
}
