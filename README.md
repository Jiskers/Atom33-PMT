# devboard

A modular, local-first project management app for indie game devs. One codebase → web, desktop (Tauri), mobile (Capacitor).

Files live in a folder hierarchy. Every file has a **view type** — corkboard, kanban, sheet, draw, or code — opened in tabs. Boards hold **modules** (sticky notes, checklists, mechanic cards, reference pins) you pin anywhere. Everything autosaves locally.

---

## Getting started (web)

Requires Node.js 18+.

```bash
npm install
npm run dev        # → http://localhost:5173
```

That's the whole app, running with real persistence (localStorage for now — see Storage below). `npm run build` produces a static `dist/` you can host anywhere.

---

## Architecture

```
src/
├── main.jsx            entry — imports plugins, mounts App
├── App.jsx             the shell: menu bar, rail, tree, tabs,
│                       viewport host, zoom, autosave. Knows
│                       NOTHING about specific views/modules.
├── modules.jsx         built-in board modules (note, checklist,
│                       mechanic, ref) — written as plugins
├── views/
│   ├── board.jsx       corkboard canvas + draggable pinned cards
│   ├── kanban.jsx      columns + cards (DnD on desktop, buttons on touch)
│   ├── sheet.jsx       mini spreadsheet + safe formula engine
│   ├── draw.jsx        freehand SVG sketching + pen toolbar overlay
│   └── code.jsx        editor + Run → browser-chrome preview tab
└── core/
    ├── registry.js     the plugin contracts (READ THIS FIRST)
    ├── storage.js      persistence adapter (swappable)
    ├── migrations.js   versioned save-data upgrades, per module/view
    ├── tree.js         folder/file tree helpers (find, move, delete, rename)
    ├── updater.js      Tauri auto-updater + running-version wrapper
    ├── seed.js         first-launch example project
    ├── theme.js        design tokens + utilities
    └── icons.jsx       SVG icon set
```

**The rule that keeps this maintainable:** `App.jsx` renders whatever is in the registry. Adding a view or module never touches the shell.

### Adding a module (community plugin shape)

```jsx
import { registerModule } from "./core/registry.js";

registerModule("bug", {
  label: "Bug report",
  desc: "Repro steps + severity",
  w: 240,
  create: () => ({ title: "", repro: "", severity: 0 }),
  Body: ({ m, onData }) => ( /* the card */ ),
  Settings: ({ m, onData, onPatch }) => ( /* gear-popover options */ ),
});
```

Import the file in `main.jsx`. Done — it appears in the palette, drops onto boards, gets lock/straighten/remove for free.

### Adding a view

Same idea with `registerView` — see the contract documented in `core/registry.js` and `views/draw.jsx` for a full example including a floating `Overlay` (the pen toolbar) and `views/code.jsx` for a `headerAction` (the Run button).

### Storage

`core/storage.js` is the only persistence touchpoint: `load()`, `save(project)`, `reset()`. It's localStorage today, which already works inside Tauri and Capacitor webviews. Swap the internals later without touching the app:

- **Desktop:** `@tauri-apps/plugin-fs` — one JSON file per devboard file in the user's documents folder (user-ownable, sync-friendly, backup-friendly)
- **Mobile:** `@capacitor/filesystem` or the SQLite plugin
- **Cloud sync:** after each local save, diff-push changed files (by id + timestamp) to Google Drive / Dropbox. The project shape — a map of `id → file` — was chosen so sync is per-file, not per-project.

localStorage's practical limit is ~5MB. Fine for early use; move to the fs adapter before drawings get big.

---

## Desktop (Tauri)

Don't hand-write the Rust scaffold — generate it against your installed toolchain:

```bash
# prerequisites: Rust (rustup.rs) + platform deps → tauri.app/start/prerequisites
npm install -D @tauri-apps/cli
npx tauri init
#   dev server URL:   http://localhost:5173
#   frontend dist:    ../dist
#   dev command:      npm run dev
#   build command:    npm run build

npx tauri dev      # run desktop app
npx tauri build    # installers (.msi / .dmg / .deb …)
```

## Mobile (Capacitor)

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init devboard com.yourname.devboard --web-dir=dist
npm run build
npx cap add android    # and/or: npx cap add ios (macOS only)
npx cap sync
npx cap open android   # opens Android Studio; run on device/emulator
```

The UI is already responsive (drawer nav, touch drag, pinch zoom, bottom tabs). Remaining mobile polish lives in the roadmap.

---

## Roadmap

**Phase 1 — solid core (you are here)**
- [x] Shell: rail, tree, tabs, menus, autosave, zoom
- [x] Views: board, kanban, sheet, draw, code (+ run preview)
- [x] Modules: note, checklist, mechanic, ref — via plugin registry
- [x] File management: rename in tree, delete, move between folders, new folder UI
- [ ] Undo/redo (single history stack in App; views already funnel changes through one path)

**Phase 2 — desktop**
- [ ] Tauri wrapper + fs storage adapter (real files on disk)
- [ ] Native menu bar, window state, file associations

**Phase 3 — mobile**
- [ ] Capacitor wrapper, safe-area insets, keyboard avoidance
- [ ] Two-finger pan while drawing

**Phase 4 — sync & accounts**
- [ ] Google sign-in + Drive appData sync (per-file, last-write-wins)
- [ ] Conflict copy on clash (rename, never overwrite silently)

**Phase 5 — the fun stuff**
- [ ] Game-dev module pack: GDD outline, asset pipeline tracker, bug board, playtest log
- [ ] php-wasm runtime so Run works for .php
- [ ] Stable plugin API + docs → community modules/views
- [ ] Board links (pin a file onto a board), search across project

## Known gaps (honest list)

- No undo/redo yet — the biggest missing daily-driver feature
- Tree drag-to-move only works with a mouse — no touch fallback yet (mirrors the same desktop-only limitation modules have when dragging onto a board)
- Sheet formulas: only `+ - * / ( )`, refs, and `SUM(range)`
- Preview resolves linked files by filename, not full relative paths
- localStorage cap (~5MB) until the fs adapter lands
