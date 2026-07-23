# devboard

A modular, local-first project management app for indie game devs. One codebase → web, desktop, and mobile, all through Tauri (v2 targets both from the same Rust shell — no separate Capacitor project).

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
    ├── storage.js      persistence adapter — localStorage (web) or
    │                   real per-file JSON on disk (Tauri), picked
    │                   by env.js at import time
    ├── env.js          inTauri() — the one runtime check everything
    │                   else (storage, updater) branches on
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

`core/storage.js` is the only persistence touchpoint: `load()`, `save(project)`, `reset()`. App.jsx always hands `save()` the whole project object — the adapter itself decides what actually needs writing, so callers never change no matter which backend is picked at import time (`inTauri()`, from `core/env.js`):

- **Web (plain browser):** one localStorage blob, capped around ~5MB.
- **Desktop + mobile (real, not aspirational):** `@tauri-apps/plugin-fs` — one JSON file per devboard file under `$APPDATA/files/<id>.json`, plus a `project.json` manifest for everything else (tree, tabs, active, expanded). Same plugin, same code path on both, since it's one Tauri shell. Per-file writes only touch files that actually changed (diffed against an in-memory cache of what's already on disk) — no size cap, and it's already the shape a sync layer needs.
- **Cloud sync (not built yet):** after each local save, diff-push changed files (by id + timestamp) to Google Drive's `appDataFolder`.

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

## Mobile (Tauri, deferred — see Phase 3)

Same `src-tauri/` project as desktop — Tauri 2 adds Android/iOS as extra
build targets rather than a separate framework:

```bash
npx tauri android init   # and/or: npx tauri ios init (macOS + Xcode only)
npx tauri android dev    # run on a device/emulator
npx tauri android build  # signed .apk / .aab
```

The UI is already responsive (drawer nav, touch drag, pinch zoom, bottom tabs) and the camera/pinch-zoom work covers touch. Not actually running this yet, though — see Phase 3 for why.

---

## Roadmap

**Phase 1 — solid core (complete)**
- [x] Shell: rail, tree, tabs, menus, autosave, zoom
- [x] Views: board, kanban, sheet, draw, code (+ run preview)
- [x] Modules: note, checklist, mechanic, ref — via plugin registry
- [x] File management: rename in tree, delete, move between folders, new folder UI
- [x] Undo/redo (single history stack in App; views already funnel changes through one path)

**Phase 2 — desktop (complete)**
- [x] Tauri wrapper: scaffold, `tauri dev`/`tauri build`, signed auto-updater backed by GitHub Releases (checks on launch, File → Check for updates, real version shown in the menu bar)
- [x] fs storage adapter — real per-file JSON on disk via `@tauri-apps/plugin-fs` under `$APPDATA` (`project.json` manifest + `files/<id>.json`), diffed against an in-memory cache so autosave only writes what changed. Verified round-trip: edited a file directly on disk, relaunched, the edit survived and re-saved correctly instead of reverting to seed data
- [x] Window state persistence — `tauri-plugin-window-state`, remembers position/size/maximized across launches. Verified: moved + resized the window, closed it gracefully, relaunched, geometry matched exactly
- Dropped: a native OS menu bar. devboard's own in-app menu already works identically across web/desktop/mobile — a second, native one would be redundant (same reasoning VS Code/Figma/Discord use for skipping theirs)
- Dropped: file associations. There's no user-facing file format to associate — devboard's "files" are internal JSON keyed by id, not documents. What this item was actually reaching for turned out to be multi-project support, done under Phase 4 below

**Phase 3 — mobile (decided, deliberately not started)**
- Decided: Tauri's own Android/iOS targets instead of a separate Capacitor project — one shell, one update mechanism, for desktop and mobile both.
- Deliberately deferred: the core is still moving fast (undo/redo, tree management, and the camera system all landed in the same week) — shipping to app stores now means a re-submission for every one of those. Revisit once Phase 2 and the Phase 5 page work below settle down.
- [ ] `tauri android init` / `tauri ios init`, safe-area insets, keyboard avoidance
- [ ] Two-finger pan while drawing

**Phase 4 — sync & accounts**
- [x] Multi-project support: File → New/Rename/switch between projects. storage.js now tracks a project registry (`projects.json` on Tauri, `devboard:projects` on web) with each project's data keyed by id; existing single-project installs migrate automatically into "project 1" the first time they load. No delete-project yet.
- [ ] Settings/account surface — new UI, doesn't exist yet — to hold Google sign-in and sync status
- [ ] Google sign-in (system-browser OAuth + loopback redirect — Google blocks embedded webviews for this) + Drive `appDataFolder` sync, per-file, last-write-wins
- [ ] Conflict copy on clash (rename, never overwrite silently)

**Phase 5 — page depth & extensibility**
- [x] Modules become per-view instead of board-only: `registerView` takes a `modules: bool` flag — the rail's palette and drag/drop now only show for views that opt in (board, home), instead of always showing the board set on every tab
- [x] Sheet: past the fixed 6×16 (A–F, 1–16) grid — resizable up to 26×200, capped at single-letter columns (A-Z) since the formula engine's cell-ref regex assumes one letter
- [x] Kanban: custom columns (add/rename/delete/reorder) plus a Trello-style card detail panel (description, checklist, image URLs) opened from a card
- [x] Board + draw: adjustable canvas/workspace size — 4 presets (Compact/Default/Large/Huge) in the View menu, per file. Resizing is non-destructive; content outside the new bounds just loses the toned backdrop, nothing is clipped
- [x] New "Home" view: a customizable dashboard/summary page — same free-pin canvas mechanic as board, its own identity (icon, cork tone), built on the per-view-module system above
- [x] Game-dev module pack: GDD outline, asset pipeline tracker, bug report, playtest log
- [ ] php-wasm runtime so Run works for .php
- [ ] Stable plugin API + docs → community modules/views
- [ ] Board links (pin a file onto a board), search across project

## Known gaps (honest list)

- Undo/redo only covers file/tree content — not tabs, active file, expanded folders, or camera pan/zoom
- Tree drag-to-move only works with a mouse — no touch fallback yet (mirrors the same desktop-only limitation modules have when dragging onto a board)
- Sheet formulas: only `+ - * / ( )`, refs, and `SUM(range)` — grid size is tracked in Phase 5, formula depth isn't yet
- Preview resolves linked files by filename, not full relative paths
