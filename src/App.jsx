import { useState, useRef, useEffect } from "react";
import { MODULE_TYPES, FILE_VIEWS, WIDGET_TYPES } from "./core/registry.js";
import { storage } from "./core/storage.js";
import { migrateProject, PROJECT_SCHEMA_VERSION } from "./core/migrations.js";
import { checkForUpdate, installUpdateAndRestart, getAppVersion } from "./core/updater.js";
import { findNode, removeNode, insertNode, moveNode, renameFolder, collectFileIds } from "./core/tree.js";
import { seedFiles, seedTree, seedTabs, seedExpanded } from "./core/seed.js";
import { I, Icn } from "./core/icons.jsx";
import { C, STICKY, TONES, CANVAS_W, CANVAS_H, CANVAS_SIZES, clampZ, uid, fileExt, KNOWN_EXTS, MONO, SANS, HAND } from "./core/theme.js";
import { makeModule } from "./views/board.jsx";
import { PreviewView, runFile } from "./views/code.jsx";
import { collectFlaggedItems, localDateStr } from "./core/reminders.js";

/* ---------- inline rename box, shared by folder + file rows ---------- */
function RenameInput({ initial, onCommit, onCancel }) {
  const [v, setV] = useState(initial);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input ref={ref} value={v} onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(v);
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onCommit(v)}
      style={{ background: C.bg, border: `1px solid ${C.gold}`, borderRadius: 4, color: C.text, fontSize: 12.5, fontFamily: SANS, padding: "1px 4px", outline: "none", flex: 1, minWidth: 0 }} />
  );
}

/* ---------- folder tree ---------- */
function TreeNode({ node, depth, files, expanded, toggle, openFile, activeId, renaming, startRename, commitRename, cancelRename, onCtxMenu, dragOverId, setDragOverId, onDropNode }) {
  const pad = 10 + depth * 14;
  const isRenaming = renaming === node.id;
  const onDragStart = (e) => { e.dataTransfer.setData("text/tree-node", node.id); e.stopPropagation(); };

  if (node.kind === "folder") {
    const open = expanded.has(node.id);
    return (
      <div>
        <div draggable={!isRenaming} onDragStart={onDragStart}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(node.id); }}
          onDragLeave={() => setDragOverId((id) => (id === node.id ? null : id))}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(null); onDropNode(e.dataTransfer.getData("text/tree-node"), node.id); }}
          onContextMenu={(e) => onCtxMenu(e, node)}
          onClick={() => !isRenaming && toggle(node.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: `7px 8px 7px ${pad}px`, cursor: "pointer", color: C.dim, fontSize: 12.5, borderRadius: 5, background: dragOverId === node.id ? C.panel2 : "transparent" }}>
          <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .12s", display: "flex", flexShrink: 0 }}><Icn d={I.chev} size={9} /></span>
          <Icn d={I.folder} size={13} />
          {isRenaming ? (
            <RenameInput initial={node.name} onCommit={(v) => commitRename(node.id, v)} onCancel={cancelRename} />
          ) : (
            <span onDoubleClick={(e) => { e.stopPropagation(); startRename(node.id); }}
              style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
          )}
        </div>
        {open && node.children.map((ch) => (
          <TreeNode key={ch.id} node={ch} depth={depth + 1} files={files} expanded={expanded} toggle={toggle} openFile={openFile} activeId={activeId}
            renaming={renaming} startRename={startRename} commitRename={commitRename} cancelRename={cancelRename}
            onCtxMenu={onCtxMenu} dragOverId={dragOverId} setDragOverId={setDragOverId} onDropNode={onDropNode} />
        ))}
      </div>
    );
  }
  const f = files[node.id];
  if (!f) return null;
  const v = FILE_VIEWS[f.view];
  if (!v) return null;
  const ext = fileExt(f.name);
  const isActive = activeId === node.id;
  return (
    <div draggable={!isRenaming} onDragStart={onDragStart}
      onContextMenu={(e) => onCtxMenu(e, node)}
      onClick={() => !isRenaming && openFile(node.id)}
      style={{ display: "flex", alignItems: "center", gap: 7, padding: `7px 8px 7px ${pad + 15}px`, cursor: "pointer", fontSize: 12.5, borderRadius: 5, color: isActive ? C.text : C.dim, background: isActive ? C.panel2 : "transparent" }}>
      <span style={{ color: f.view === "core:code" ? KNOWN_EXTS[ext] ?? v.color : v.color, display: "flex", flexShrink: 0 }}>
        <Icn d={v.icon} size={12} />
      </span>
      {isRenaming ? (
        <RenameInput initial={f.name} onCommit={(v) => commitRename(node.id, v)} onCancel={cancelRename} />
      ) : (
        <span onDoubleClick={(e) => { e.stopPropagation(); startRename(node.id); }}
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
      )}
    </div>
  );
}

/* ---------- persistent left nav rail: Home / Projects now, the
   rest are room-to-grow placeholders (group projects, chat, etc). ---- */
function RailIcon({ icon, label, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "8px 0", color: active ? C.gold : hover ? C.text : C.faint }}>
      <span style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8,
        background: active ? "#E8C87A22" : hover ? C.panel2 : "none",
      }}>
        <Icn d={icon} size={15} stroke={1.6} />
      </span>
      {label && <span style={{ fontSize: 9, fontFamily: SANS, fontWeight: active ? 700 : 500 }}>{label}</span>}
    </button>
  );
}
function IconRail({ section, setSection, say, onQuickAdd }) {
  const soon = (label) => say(`${label} isn't built yet`);
  return (
    <div style={{ width: 64, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 6px" }}>
      <button onClick={onQuickAdd} title="New board"
        style={{ width: 32, height: 32, borderRadius: "50%", background: C.gold, color: C.ink, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icn d={I.plus} size={14} stroke={2} />
      </button>
      <RailIcon icon={I.search} label="" active={false} onClick={() => soon("Search")} />
      <div style={{ height: 10 }} />
      <RailIcon icon={I.home} label="Home" active={section === "home"} onClick={() => setSection("home")} />
      <RailIcon icon={I.folder} label="Projects" active={section === "projects"} onClick={() => setSection("projects")} />
      <RailIcon icon={I.calendar} label="Calendar" active={section === "calendar"} onClick={() => setSection("calendar")} />
      <RailIcon icon={I.reports} label="Reports" active={false} onClick={() => soon("Reports")} />
      <RailIcon icon={I.people} label="People" active={false} onClick={() => soon("People")} />
      <RailIcon icon={I.chat} label="Chat" active={false} onClick={() => soon("Chat")} />
      <div style={{ flex: 1 }} />
      <RailIcon icon={I.help} label="" active={false} onClick={() => soon("Help")} />
      <RailIcon icon={I.gear} label="" active={false} onClick={() => soon("Settings")} />
      <button onClick={() => soon("Profile")} title="Me"
        style={{ width: 28, height: 28, borderRadius: "50%", background: C.gold, color: C.ink, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: SANS, marginTop: 8 }}>
        me
      </button>
    </div>
  );
}

/* ---------- Home dashboard: a grid of widgets, not free-pinned —
   "position" is just order, so the grid packs snug instead of
   leaving gaps like board's absolute x/y canvas would. ---- */
function WidgetCard({ w, index, count, ctx, ops }) {
  const [hover, setHover] = useState(false);
  const def = WIDGET_TYPES[w.type];
  if (!def) return null;
  const { Body } = def;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ gridColumn: `span ${Math.min(def.w ?? 1, 4)}`, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, position: "relative", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, fontFamily: MONO }}>{def.label}</span>
        {hover && (
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => ops.move(-1)} disabled={index === 0} title="Move left"
              style={{ background: "none", border: "none", color: index === 0 ? C.line : C.faint, cursor: index === 0 ? "default" : "pointer", display: "flex", padding: 4 }}>
              <Icn d={I.left} size={10} stroke={2} />
            </button>
            <button onClick={() => ops.move(1)} disabled={index === count - 1} title="Move right"
              style={{ background: "none", border: "none", color: index === count - 1 ? C.line : C.faint, cursor: index === count - 1 ? "default" : "pointer", display: "flex", padding: 4 }}>
              <Icn d={I.right} size={10} stroke={2} />
            </button>
            <button onClick={ops.remove} title="Remove widget"
              style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: 4 }}>
              <Icn d={I.x} size={10} stroke={2} />
            </button>
          </div>
        )}
      </div>
      <Body m={w} onData={ops.data} ctx={ctx} />
    </div>
  );
}
function HomeSection({ home, api, ctx, isMobile }) {
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {!isMobile && (
        <div style={{ width: 248, borderRight: `1px solid ${C.line}`, overflowY: "auto", padding: "12px 10px", flexShrink: 0, background: C.panel }}>
          <div style={{ fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase", color: C.faint, fontFamily: MONO, padding: "0 4px 8px" }}>
            widgets — click to add
          </div>
          {Object.entries(WIDGET_TYPES).map(([type, t]) => (
            <div key={type} onClick={() => api.add(type)}
              style={{ padding: "11px 10px", marginBottom: 6, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, cursor: "pointer" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.label}</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>{t.desc}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: SANS, marginBottom: 14 }}>Home</div>
        {home.widgets.length === 0 ? (
          <div style={{ fontFamily: HAND, fontSize: 24, color: C.faint, transform: "rotate(-1deg)" }}>
            {isMobile ? "no widgets yet" : "add a widget from the left to build your dashboard →"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start" }}>
            {home.widgets.map((w, i) => (
              <WidgetCard key={w.id} w={w} index={i} count={home.widgets.length} ctx={ctx}
                ops={{
                  move: (dir) => api.move(w.id, dir),
                  remove: () => api.remove(w.id),
                  data: (patch) => api.patch(w.id, patch),
                }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Calendar: flagged modules/kanban cards plotted on a
   month grid by due date — same data as the Reminders widget, just
   a different shape. Local only for now; Google Calendar sync is a
   Phase 4 idea that rides along with real sign-in, not this. ---- */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad2 = (n) => String(n).padStart(2, "0");

function CalendarSection({ ctx }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const byDate = {};
  for (const it of collectFlaggedItems(ctx.files)) {
    if (!it.due) continue;
    (byDate[it.due] ??= []).push(it);
  }

  const first = new Date(ym.y, ym.m, 1);
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = localDateStr(now);
  const shiftMonth = (delta) => setYm((s) => {
    let m = s.m + delta, y = s.y;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    return { y, m };
  });
  const navBtn = { width: 26, height: 26, borderRadius: 6, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: SANS }}>{MONTH_NAMES[ym.m]} {ym.y}</div>
        <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
          <button onClick={() => shiftMonth(-1)} title="Previous month" style={navBtn}><Icn d={I.left} size={11} stroke={2} /></button>
          <button onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}
            style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 11.5, fontFamily: SANS }}>
            Today
          </button>
          <button onClick={() => shiftMonth(1)} title="Next month" style={navBtn}><Icn d={I.right} size={11} stroke={2} /></button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ fontSize: 10, fontFamily: MONO, color: C.faint, textAlign: "center", padding: "0 0 4px" }}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${ym.y}-${pad2(ym.m + 1)}-${pad2(d)}`;
          const dayItems = byDate[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          return (
            <div key={i} style={{ minHeight: 76, border: `1px solid ${isToday ? C.gold : C.line}`, borderRadius: 6, padding: 6, background: isToday ? "#E8C87A14" : C.panel, display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" }}>
              <div style={{ fontSize: 10.5, fontFamily: MONO, color: isToday ? C.gold : C.faint }}>{d}</div>
              {dayItems.slice(0, 3).map((it) => (
                <button key={it.id} onClick={() => ctx.openFile(it.fileId)} title={it.label}
                  style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", color: "#E8564A", fontSize: 9.5, fontFamily: SANS, padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0 }}>
                  <Icn d={I.flag} size={7} stroke={2.4} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                </button>
              ))}
              {dayItems.length > 3 && <div style={{ fontSize: 9, color: C.faint }}>+{dayItems.length - 3} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [files, setFiles] = useState(seedFiles);
  const [tree, setTree] = useState(seedTree);
  const [tabs, setTabs] = useState(seedTabs);
  const [active, setActive] = useState(seedTabs[0]);
  const [expanded, setExpanded] = useState(new Set(seedExpanded));
  const [home, setHome] = useState({ widgets: [] });
  const [section, setSection] = useState("projects");
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedMod, setSelectedMod] = useState(null);
  const [settingsFor, setSettingsFor] = useState(null);
  const [saveState, setSaveState] = useState({ status: "saved", at: "—" });
  const [drawer, setDrawer] = useState(null);
  const [update, setUpdate] = useState(null);
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  const [renaming, setRenaming] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectIdState] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [historyLen, setHistoryLen] = useState({ undo: 0, redo: 0 });
  const canvasRef = useRef(null);
  const toastT = useRef(null);
  const saveT = useRef(null);
  const zoomApi = useRef({});
  const camActive = useRef(false);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const lastCommitted = useRef(null); // baseline { files, tree } the next debounced edit diffs from
  const undoT = useRef(null);
  const applyingHistory = useRef(false); // true while undo()/redo() itself is setting files/tree
  const historyApi = useRef({});
  const menuCloseT = useRef(null);

  const isMobile = vw < 760;
  const previewOf = active?.startsWith("pv:") ? active.slice(3) : null;
  const file = previewOf ? null : files[active];
  const previewFile = previewOf ? files[previewOf] : null;
  const view = file ? FILE_VIEWS[file.view] : null;
  const supportsModules = !!view?.modules;
  const zoomable = !!view?.zoomable;
  const zoom = zoomable ? file.settings.zoom ?? 1 : 1;
  const pan = zoomable ? file.settings.pan ?? { x: 0, y: 0 } : { x: 0, y: 0 };
  const canvasish = !!view?.canvas;
  const canvasW = canvasish ? file.settings.canvasW ?? CANVAS_W : CANVAS_W;
  const canvasH = canvasish ? file.settings.canvasH ?? CANVAS_H : CANVAS_H;
  const ext = file?.view === "core:code" ? fileExt(file.name) : "";

  /* ---- apply a loaded project's data into state (boot + project switch) ---- */
  const applyLoaded = (saved) => {
    if (saved?.files && saved?.tree) {
      setFiles(saved.files);
      setTree(saved.tree);
      setTabs(saved.tabs ?? []);
      setActive(saved.active ?? saved.tabs?.[0] ?? null);
      setExpanded(new Set(saved.expanded ?? []));
      setHome(saved.home ?? { widgets: [] });
    }
  };

  /* ---- load persisted project on boot ---- */
  useEffect(() => {
    (async () => {
      applyLoaded(migrateProject(await storage.load()));
      setLoaded(true);
    })();
  }, []);

  /* ---- project list + multi-project management ---- */
  const refreshProjects = async () => {
    setProjects(await storage.listProjects());
    setActiveProjectIdState(await storage.getActiveProjectId());
  };
  useEffect(() => {
    if (loaded) refreshProjects();
  }, [loaded]);

  const switchProject = async (id) => {
    if (id === activeProjectId) return;
    await storage.setActiveProjectId(id);
    undoStack.current = [];
    redoStack.current = [];
    lastCommitted.current = null;
    setSelectedMod(null); setSettingsFor(null); setMenuOpen(null); setCtxMenu(null); setRenaming(null); setDragOverId(null);
    applyLoaded(migrateProject(await storage.load()));
    setActiveProjectIdState(id);
  };
  const newProject = async () => {
    const name = window.prompt("Project name:", "My Project");
    if (name === null) return;
    const id = await storage.createProject(name);
    await refreshProjects();
    await switchProject(id);
  };
  const renameProjectPrompt = async () => {
    const cur = projects.find((p) => p.id === activeProjectId);
    const name = window.prompt("Rename project:", cur?.name ?? "");
    if (name === null || !name.trim()) return;
    await storage.renameProject(activeProjectId, name.trim());
    await refreshProjects();
  };

  /* ---- window resize ---- */
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  /* ---- debounced autosave through the storage adapter ---- */
  useEffect(() => {
    if (!loaded) return;
    setSaveState({ status: "saving" });
    clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      await storage.save({ schemaVersion: PROJECT_SCHEMA_VERSION, files, tree, tabs, active, expanded: [...expanded], home });
      setSaveState({ status: "saved", at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    }, 650);
    return () => clearTimeout(saveT.current);
  }, [files, tree, tabs, active, expanded, home, loaded]);

  /* ---- undo/redo: a single history stack over { files, tree } — every
     view already funnels edits through onChange/updateFile into those two,
     so this covers board/kanban/sheet/draw/code and tree ops for free.
     Rapid edits (typing) coalesce into one step via a debounce; a real
     pause commits the pre-burst state as an undo point. Tabs/active/
     expanded/camera are deliberately NOT part of history — only content. */
  useEffect(() => {
    if (!loaded) return;
    if (lastCommitted.current === null) { lastCommitted.current = { files, tree }; return; } // baseline right after load
    if (applyingHistory.current) { applyingHistory.current = false; lastCommitted.current = { files, tree }; return; }
    if (redoStack.current.length) redoStack.current = []; // any new edit invalidates redo, immediately
    clearTimeout(undoT.current);
    undoT.current = setTimeout(() => {
      undoT.current = null; // this timer has now fired — nothing left pending to flush
      undoStack.current.push(lastCommitted.current);
      if (undoStack.current.length > 100) undoStack.current.shift();
      lastCommitted.current = { files, tree };
      setHistoryLen({ undo: undoStack.current.length, redo: redoStack.current.length });
    }, 600);
    setHistoryLen({ undo: undoStack.current.length, redo: redoStack.current.length });
  }, [files, tree, loaded]);

  const flushPendingHistory = () => {
    if (!undoT.current) return;
    clearTimeout(undoT.current);
    undoT.current = null;
    undoStack.current.push(lastCommitted.current);
    if (undoStack.current.length > 100) undoStack.current.shift();
    lastCommitted.current = { files, tree };
  };
  const undo = () => {
    flushPendingHistory();
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop();
    redoStack.current.push({ files, tree });
    applyingHistory.current = true;
    setFiles(prev.files);
    setTree(prev.tree);
    setSelectedMod(null); setSettingsFor(null);
    setHistoryLen({ undo: undoStack.current.length, redo: redoStack.current.length });
  };
  const redo = () => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop();
    undoStack.current.push({ files, tree });
    applyingHistory.current = true;
    setFiles(next.files);
    setTree(next.tree);
    setSelectedMod(null); setSettingsFor(null);
    setHistoryLen({ undo: undoStack.current.length, redo: redoStack.current.length });
  };
  historyApi.current = { undo, redo };

  /* ---- Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y — skipped while an input/
     textarea/contenteditable has focus, so native in-field text undo
     (e.g. a half-typed sticky note) isn't hijacked by project-level undo ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = document.activeElement;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); historyApi.current.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); historyApi.current.redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const updateFile = (id, patch) => setFiles((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
  /* zoom anchored at a point in canvasRef's local space, so the point under
     it (cursor, pinch midpoint) stays fixed on screen as zoom changes */
  const zoomAt = (sx, sy, fn) => {
    const f = zoomApi.current.file;
    if (!f || !FILE_VIEWS[f.view]?.zoomable) return;
    const oldZ = f.settings.zoom ?? 1;
    const oldPan = f.settings.pan ?? { x: 0, y: 0 };
    const newZ = clampZ(fn(oldZ));
    updateFile(zoomApi.current.id, {
      settings: { ...f.settings, zoom: newZ, pan: { x: sx - (newZ / oldZ) * (sx - oldPan.x), y: sy - (newZ / oldZ) * (sy - oldPan.y) } },
    });
  };
  const setZoom = (fn) => {
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, fn);
  };
  const resetCamera = () => {
    const f = zoomApi.current.file;
    if (!f || !FILE_VIEWS[f.view]?.zoomable) return;
    updateFile(zoomApi.current.id, { settings: { ...f.settings, zoom: 1, pan: { x: 0, y: 0 } } });
  };
  zoomApi.current = { file, id: active, canvasish };

  /* ---- camera: click/touch-drag pans, wheel zooms, pinch zooms+pans.
     A shared pointer count gates everything so a 2nd touch always wins:
     board's module-drag and draw's stroke-drawing both bail out (see
     ctx.cameraActive) the instant a pinch starts, instead of racing it. ---- */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const pts = new Map();
    let mode = null; // null | "pan" | "pinch"
    let start = null;

    const settings = () => zoomApi.current.file?.settings ?? {};
    const commit = (patch) => {
      const f = zoomApi.current.file;
      if (!f) return;
      updateFile(zoomApi.current.id, { settings: { ...f.settings, ...patch } });
    };

    const onWheel = (e) => {
      if (!zoomApi.current.canvasish) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, (z) => z * (1 - e.deltaY * 0.0015));
    };

    const onPD = (e) => {
      if (!zoomApi.current.canvasish) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.pointerType === "mouse" && e.button === 1) {
        // middle-click drag always pans, regardless of what's underneath —
        // the one mouse-based pan gesture that can't collide with drawing
        // or module-dragging, both of which only respond to the primary button.
        e.preventDefault();
        camActive.current = true;
        mode = "pan";
        start = { x: e.clientX, y: e.clientY, pan: settings().pan ?? { x: 0, y: 0 } };
        el.style.cursor = "grabbing";
        return;
      }
      if (pts.size >= 2) {
        camActive.current = true;
        const [a, b] = [...pts.values()];
        const s = settings();
        const zoom = s.zoom ?? 1, pan = s.pan ?? { x: 0, y: 0 };
        const r = el.getBoundingClientRect();
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        mode = "pinch";
        start = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          zoom,
          localAnchor: { x: (mid.x - r.left - pan.x) / zoom, y: (mid.y - r.top - pan.y) / zoom },
        };
      } else if (pts.size === 1 && e.target.hasAttribute?.("data-cam-bg")) {
        mode = "pan";
        start = { x: e.clientX, y: e.clientY, pan: settings().pan ?? { x: 0, y: 0 } };
      }
    };

    const onPM = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === "pan") {
        commit({ pan: { x: start.pan.x + (e.clientX - start.x), y: start.pan.y + (e.clientY - start.y) } });
      } else if (mode === "pinch") {
        const [a, b] = [...pts.values()];
        const r = el.getBoundingClientRect();
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const newZoom = clampZ(start.zoom * (dist / start.dist));
        commit({
          zoom: newZoom,
          pan: { x: mid.x - r.left - newZoom * start.localAnchor.x, y: mid.y - r.top - newZoom * start.localAnchor.y },
        });
      }
    };

    const endPointer = (e) => {
      pts.delete(e.pointerId);
      if (pts.size === 0) { mode = null; camActive.current = false; el.style.cursor = ""; }
      else if (pts.size === 1 && mode === "pinch") {
        const [p] = [...pts.values()];
        mode = "pan";
        start = { x: p.x, y: p.y, pan: settings().pan ?? { x: 0, y: 0 } };
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPD, { capture: true });
    el.addEventListener("pointermove", onPM, { capture: true });
    el.addEventListener("pointerup", endPointer, { capture: true });
    el.addEventListener("pointercancel", endPointer, { capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPD, { capture: true });
      el.removeEventListener("pointermove", onPM, { capture: true });
      el.removeEventListener("pointerup", endPointer, { capture: true });
      el.removeEventListener("pointercancel", endPointer, { capture: true });
    };
  }, [loaded]);

  const say = (msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 3000);
  };
  const checkUpdates = async (silent) => {
    const u = await checkForUpdate();
    setUpdate(u);
    if (u) say(`Update v${u.version} available — File → Install update & restart`);
    else if (!silent) say("You're on the latest version");
  };
  /* ---- silent update check on launch (only speaks up if one's found) ---- */
  useEffect(() => {
    if (loaded) checkUpdates(true);
  }, [loaded]);

  /* ---- real running version (corrects the build-time fallback once a
     Tauri build can report its own — proof an update actually took) ---- */
  useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);
  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* ---- menu bar: hover-to-open on desktop, click-to-toggle on mobile
     (no hover there). A short close delay tolerates the dead zone
     between the button and its dropdown so crossing it doesn't flicker. */
  const openMenu = (name) => {
    clearTimeout(menuCloseT.current);
    setMenuOpen(name);
  };
  const scheduleMenuClose = () => {
    clearTimeout(menuCloseT.current);
    menuCloseT.current = setTimeout(() => setMenuOpen(null), 150);
  };
  const openFile = (id) => {
    setTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActive(id);
    setSettingsFor(null); setSelectedMod(null); setDrawer(null);
    setSection("projects");
  };
  const closeTab = (id) => setTabs((t) => {
    const n = t.filter((x) => x !== id);
    if (active === id) setActive(n[n.length - 1] ?? null);
    return n;
  });

  const addModule = (type, x = 100, y = 100) => {
    if (!file) return say("Open a board file first");
    if (!supportsModules) return say(`Modules don't pin to ${view.label} tabs`);
    updateFile(active, { modules: [...file.modules, makeModule(type, x, y)] });
    setDrawer(null);
  };

  /* ---- Home dashboard widgets: an ordered list, not free-pinned like
     board modules — the grid packs them, so "position" is just index. ---- */
  const addWidget = (type) => {
    const def = WIDGET_TYPES[type];
    if (!def) return;
    setHome((h) => ({ ...h, widgets: [...h.widgets, { id: uid("w"), type, data: def.create() }] }));
  };
  const removeWidget = (id) => setHome((h) => ({ ...h, widgets: h.widgets.filter((w) => w.id !== id) }));
  const moveWidget = (id, dir) => setHome((h) => {
    const i = h.widgets.findIndex((w) => w.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= h.widgets.length) return h;
    const arr = [...h.widgets];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...h, widgets: arr };
  });
  const patchWidgetData = (id, patch) => setHome((h) => ({ ...h, widgets: h.widgets.map((w) => (w.id === id ? { ...w, data: { ...w.data, ...patch } } : w)) }));

  const newFile = (viewId) => {
    const def = FILE_VIEWS[viewId];
    const id = uid("f");
    setFiles((f) => ({ ...f, [id]: { name: def.newName ?? `untitled ${def.label}`, view: viewId, ...def.create() } }));
    setTree((t) => {
      const n = structuredClone(t);
      (n[0]?.children ?? n).push({ id, kind: "file" });
      return n;
    });
    if (tree[0]) setExpanded((s) => new Set(s).add(tree[0].id));
    openFile(id);
  };

  /* ---- tree: rename / delete / new folder / drag-move ---- */
  const startRename = (id) => setRenaming(id);
  const cancelRename = () => setRenaming(null);
  const commitRename = (id, name) => {
    setRenaming(null);
    if (!name.trim()) return;
    const node = findNode(tree, id);
    if (node?.kind === "folder") setTree((t) => renameFolder(t, id, name));
    else updateFile(id, { name: name.trim() });
  };
  const newFolder = (parentId = null) => {
    const id = uid("d");
    setTree((t) => insertNode(t, { id, kind: "folder", name: "New folder", children: [] }, parentId));
    if (parentId) setExpanded((s) => new Set(s).add(parentId));
    setRenaming(id);
  };
  const deleteNode = (id) => {
    const node = findNode(tree, id);
    if (!node) return;
    const fileIds = new Set(collectFileIds(node));
    const label = node.kind === "folder"
      ? `"${node.name}" and its ${fileIds.size} file${fileIds.size === 1 ? "" : "s"}`
      : `"${files[id]?.name ?? "this file"}"`;
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    setTree((t) => removeNode(t, id).tree);
    setFiles((f) => { const n = { ...f }; fileIds.forEach((fid) => delete n[fid]); return n; });
    setTabs((t) => {
      const kept = t.filter((tid) => !fileIds.has(tid.startsWith("pv:") ? tid.slice(3) : tid));
      if (fileIds.has(previewOf ?? active)) setActive(kept[kept.length - 1] ?? null);
      return kept;
    });
    setExpanded((s) => { const n = new Set(s); n.delete(id); fileIds.forEach((fid) => n.delete(fid)); return n; });
    setSelectedMod(null); setSettingsFor(null); setCtxMenu(null);
  };
  const onDropNode = (draggedId, targetParentId) => {
    if (!draggedId) return;
    setTree((t) => moveNode(t, draggedId, targetParentId));
  };
  const openCtxMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, node });
  };

  /* ctx handed to view Components and Overlays */
  const ctx = {
    files, activeId: active, updateFile, canvasRef, zoom, pan, isMobile, say, openFile,
    cameraActive: camActive,
    selection: { selectedMod, setSelectedMod, settingsFor, setSettingsFor },
  };

  /* ---- menus ---- */
  const selExists = supportsModules && file?.modules.some((m) => m.id === selectedMod);
  const patchSel = (patch) => updateFile(active, { modules: file.modules.map((m) => (m.id === selectedMod ? { ...m, ...patch } : m)) });
  const fileItems = [
    { label: "New project…", act: newProject },
    { label: "Rename project…", act: renameProjectPrompt, dis: !activeProjectId },
    { sep: true },
    ...projects.map((p) => ({ label: p.name, act: () => switchProject(p.id), check: p.id === activeProjectId })),
    { sep: true },
    ...Object.entries(FILE_VIEWS).map(([k, v]) => ({ label: `New ${v.label}`, act: () => newFile(k) })),
    { sep: true },
    { label: "Close tab", act: () => closeTab(active), dis: !active },
    { sep: true },
    { label: "Check for updates", act: () => checkUpdates(false) },
    ...(update ? [{ label: `Install update v${update.version} & restart`, act: () => installUpdateAndRestart(update) }] : []),
    { sep: true },
    { label: "Reset project…", act: async () => { await storage.reset(); location.reload(); } },
  ];
  const editItems = [
    { label: "Undo", act: undo, dis: !historyLen.undo },
    { label: "Redo", act: redo, dis: !historyLen.redo },
    { sep: true },
    { label: "Straighten module", act: () => patchSel({ rot: 0 }), dis: !selExists },
    { label: "Delete module", act: () => { updateFile(active, { modules: file.modules.filter((m) => m.id !== selectedMod) }); setSelectedMod(null); setSettingsFor(null); }, dis: !selExists },
    { sep: true },
    { label: "Clear modules", act: () => updateFile(active, { modules: [] }), dis: !supportsModules },
  ];
  const viewItems = [
    { label: "Zoom in", act: () => setZoom((z) => z * 1.2), dis: !zoomable },
    { label: "Zoom out", act: () => setZoom((z) => z / 1.2), dis: !zoomable },
    { label: "Reset zoom", act: resetCamera, dis: !zoomable },
    { sep: true },
    { label: "Dot grid", check: !!file?.settings?.grid, act: () => updateFile(active, { settings: { ...file.settings, grid: !file.settings.grid } }), dis: !canvasish },
    { sep: true },
    ...Object.keys(TONES).map((k) => ({
      label: `Tone: ${k}`, radio: file?.settings?.tone === k,
      act: () => updateFile(active, { settings: { ...file.settings, tone: k } }), dis: !canvasish,
    })),
    { sep: true },
    ...Object.entries(CANVAS_SIZES).map(([k, { w, h }]) => ({
      label: `Canvas: ${k} (${w}×${h})`, radio: canvasW === w && canvasH === h,
      act: () => updateFile(active, { settings: { ...file.settings, canvasW: w, canvasH: h } }), dis: !canvasish,
    })),
  ];
  const runItems = [
    { label: "Run file", act: () => runFile(files, active, openFile, say), dis: !file || file.view !== "core:code" },
  ];
  const menus = isMobile
    ? { Menu: [...fileItems, { sep: true }, ...editItems, { sep: true }, ...viewItems, { sep: true }, ...runItems] }
    : { File: fileItems, Edit: editItems, View: viewItems, Run: runItems };

  const gridBg = file?.settings?.grid
    ? { backgroundImage: "radial-gradient(rgba(255,255,255,.055) 1px, transparent 1px)", backgroundSize: "26px 26px" }
    : {};

  const HeaderAction = view?.headerAction;
  const ViewComponent = view?.Component;
  const ViewOverlay = view?.Overlay;

  const railContent = (
    <>
      <div style={{ flex: isMobile ? "unset" : "1 1 52%", overflowY: "auto", padding: "12px 10px", minHeight: 0, display: isMobile && drawer !== "modules" ? "none" : "block" }}>
        <div style={{ fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase", color: C.faint, fontFamily: MONO, padding: "0 4px 8px" }}>
          {isMobile ? "modules — tap to pin" : "modules — drag onto the canvas"}
        </div>
        {supportsModules ? (
          <>
            {Object.entries(MODULE_TYPES).map(([type, t], i) => (
              <div key={type} draggable={!isMobile}
                onDragStart={(e) => e.dataTransfer.setData("module", type)}
                onClick={() => addModule(type, 90 + i * 34, 80 + i * 30)}
                style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 10px", marginBottom: 6, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, cursor: isMobile ? "pointer" : "grab" }}>
                <div style={{ width: 26, height: 26, borderRadius: 5, background: STICKY[i % 4], flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,.4)", transform: `rotate(${i % 2 ? 3 : -3}deg)` }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 10.5, color: C.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: C.faint, padding: "8px 4px 0", lineHeight: 1.5 }}>
              Modules and views are plugins — everything here registers through the same contracts community add-ons would use.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11.5, color: C.faint, padding: "8px 4px 0", lineHeight: 1.5 }}>
            {file ? `${view.label} tabs don't use pinned modules.` : "Open a board file to pin modules."}
          </div>
        )}
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setDragOverId(null); onDropNode(e.dataTransfer.getData("text/tree-node"), null); }}
        style={{ flex: isMobile ? "unset" : "1 1 48%", borderTop: isMobile ? "none" : `1px solid ${C.line}`, overflowY: "auto", padding: "12px 10px", minHeight: 0, display: isMobile && drawer !== "files" ? "none" : "block" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 4px 8px" }}>
          <span style={{ fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase", color: C.faint, fontFamily: MONO }}>project files</span>
          <button onClick={() => newFolder(null)} title="New folder"
            style={{ marginLeft: "auto", background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex", padding: 4 }}>
            <Icn d={I.folder} size={12} />
          </button>
          {Object.entries(FILE_VIEWS).map(([k, v]) => (
            <button key={k} onClick={() => newFile(k)} title={`New ${v.label}`}
              style={{ background: "none", border: "none", color: v.color, cursor: "pointer", display: "flex", padding: 4 }}>
              <Icn d={v.icon} size={12} />
            </button>
          ))}
        </div>
        {tree.map((n) => (
          <TreeNode key={n.id} node={n} depth={0} files={files} expanded={expanded} toggle={toggle} openFile={openFile} activeId={active}
            renaming={renaming} startRename={startRename} commitRename={commitRename} cancelRename={cancelRename}
            onCtxMenu={openCtxMenu} dragOverId={dragOverId} setDragOverId={setDragOverId} onDropNode={onDropNode} />
        ))}
      </div>
    </>
  );

  if (!loaded) return <div style={{ height: "100vh", background: C.bg }} />;

  const homeApi = { add: addWidget, remove: removeWidget, move: moveWidget, patch: patchWidgetData };

  return (
    <div style={{ height: "100%", display: "flex", background: C.bg, color: C.text, fontFamily: SANS, overflow: "hidden" }}>
      {!isMobile && <IconRail section={section} setSection={setSection} say={say} onQuickAdd={() => newFile("core:board")} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      {/* ===== menu bar ===== */}
      <div style={{ height: 42, display: "flex", alignItems: "center", padding: "0 8px", borderBottom: `1px solid ${C.line}`, flexShrink: 0, position: "relative", zIndex: 60 }}>
        {isMobile && (
          <button onClick={() => setDrawer((d) => (d ? null : "files"))}
            style={{ background: drawer ? C.panel2 : "none", border: "none", color: C.text, cursor: "pointer", display: "flex", padding: 8, borderRadius: 6 }}>
            <Icn d={I.burger} size={15} stroke={1.8} />
          </button>
        )}
        <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 13, letterSpacing: 0.5, padding: "0 8px" }}>
          devboard{activeProjectId && <span style={{ color: C.faint, fontWeight: 400 }}> — {projects.find((p) => p.id === activeProjectId)?.name}</span>}
        </span>
        {Object.entries(menus).map(([name, items]) => (
          <div key={name} style={{ position: "relative" }}
            onMouseEnter={() => !isMobile && openMenu(name)}
            onMouseLeave={() => !isMobile && scheduleMenuClose()}>
            <button onClick={() => setMenuOpen((m) => (m === name ? null : name))}
              style={{ background: menuOpen === name ? C.panel2 : "none", border: "none", color: C.text, fontSize: 12.5, padding: "7px 11px", borderRadius: 6, cursor: "pointer", fontFamily: SANS }}>
              {name}
            </button>
            {menuOpen === name && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: 195, maxHeight: "70vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 5, boxShadow: "0 16px 34px rgba(0,0,0,.55)" }}>
                {items.map((it, i) => it.sep ? (
                  <div key={i} style={{ height: 1, background: C.line, margin: "5px 8px" }} />
                ) : (
                  <button key={i} disabled={it.dis}
                    onClick={() => { setMenuOpen(null); it.act(); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: it.dis ? C.faint : C.text, fontSize: 12.5, padding: "8px 10px", borderRadius: 6, cursor: it.dis ? "default" : "pointer", fontFamily: SANS, opacity: it.dis ? 0.55 : 1 }}>
                    <span style={{ width: 13, display: "flex", color: C.gold }}>
                      {(it.check || it.radio) && <Icn d={I.check} size={11} stroke={2.2} />}
                    </span>
                    {it.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontSize: 11, fontFamily: MONO, color: C.faint, padding: "0 6px" }}>
          <span title="Currently running version — check this after an update to confirm it applied">v{appVersion}</span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: saveState.status === "saving" ? C.gold : "#A8D8B0", transition: "background .2s", flexShrink: 0 }} />
          {!isMobile && (saveState.status === "saving" ? "saving…" : `autosaved ${saveState.at}`)}
        </div>
      </div>
      {menuOpen && <div onClick={() => setMenuOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 55 }} />}

      {section === "home" && <HomeSection home={home} api={homeApi} ctx={ctx} isMobile={isMobile} />}
      {section === "calendar" && <CalendarSection ctx={ctx} />}
      {section === "projects" && (
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {!isMobile && (
          <div style={{ width: 248, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", background: C.panel, flexShrink: 0 }}>
            {railContent}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* file header */}
          <div style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
            {previewFile ? (
              <>
                <span style={{ color: "#E8956B", display: "flex", flexShrink: 0 }}><Icn d={I.play} size={12} /></span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewFile.name}</span>
                <span style={{ fontSize: 10, fontFamily: MONO, color: C.faint, border: `1px solid ${C.line}`, padding: "1px 8px", borderRadius: 10, flexShrink: 0 }}>preview</span>
              </>
            ) : file && view ? (
              <>
                <span style={{ color: file.view === "core:code" ? KNOWN_EXTS[ext] ?? view.color : view.color, display: "flex", flexShrink: 0 }}>
                  <Icn d={view.icon} size={13} />
                </span>
                <input value={file.name} onChange={(e) => updateFile(active, { name: e.target.value })}
                  style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, fontWeight: 600, fontFamily: file.view === "core:code" ? MONO : SANS, flex: 1, minWidth: 0 }} />
                {HeaderAction && <HeaderAction file={file} ctx={ctx} />}
                <span style={{ fontSize: 10, fontFamily: MONO, color: C.faint, border: `1px solid ${C.line}`, padding: "1px 8px", borderRadius: 10, flexShrink: 0 }}>{view.label}</span>
              </>
            ) : file ? (
              <span style={{ fontSize: 12, color: C.faint }}>"{file.name}" uses a view that isn't installed</span>
            ) : (
              <span style={{ fontSize: 12, color: C.faint }}>no file open</span>
            )}
          </div>

          {/* viewport */}
          <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex" }}>
            <div ref={canvasRef}
              style={{ flex: 1, overflow: previewOf || view?.fixed || canvasish ? "hidden" : "auto", position: "relative", background: file ? (canvasish ? TONES[file.settings.tone ?? "slate"] : C.bg) : C.bg, touchAction: canvasish ? "none" : undefined, WebkitOverflowScrolling: "touch" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const type = e.dataTransfer.getData("module");
                if (!type || !file) return;
                const el = canvasRef.current;
                const r = el.getBoundingClientRect();
                addModule(type, (e.clientX - r.left - pan.x) / zoom - 90, (e.clientY - r.top - pan.y) / zoom - 20);
              }}>
              {!file && !previewOf && (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, textAlign: "center" }}>
                  <div style={{ fontFamily: HAND, fontSize: 30, color: C.dim }}>the wall is empty</div>
                  <div style={{ fontSize: 12.5, color: C.faint }}>Open a file from the hierarchy, or start a new board.</div>
                  <button onClick={() => newFile("core:board")}
                    style={{ background: C.gold, color: C.ink, border: "none", borderRadius: 6, padding: "10px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: SANS }}>
                    New board
                  </button>
                </div>
              )}
              {file && canvasish && ViewComponent && (
                <div data-cam-bg="1"
                  style={{ position: "absolute", top: 0, left: 0, width: canvasW, height: canvasH, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", cursor: "grab", ...gridBg }}
                  onPointerDown={(e) => { if (e.target === e.currentTarget) { setSelectedMod(null); setSettingsFor(null); } }}>
                  <ViewComponent file={file} ctx={ctx} onChange={(f) => setFiles((fs) => ({ ...fs, [active]: f }))} />
                </div>
              )}
              {file && !canvasish && ViewComponent && (
                <ViewComponent file={file} ctx={ctx} onChange={(f) => setFiles((fs) => ({ ...fs, [active]: f }))} />
              )}
              {previewOf && <PreviewView files={files} fileId={previewOf} />}
            </div>

            {file && ViewOverlay && (
              <ViewOverlay file={file} ctx={ctx} onChange={(f) => setFiles((fs) => ({ ...fs, [active]: f }))} />
            )}

            {zoomable && (
              <div style={{ position: "absolute", bottom: 12, right: 14, zIndex: 30, display: "flex", alignItems: "center", gap: 2, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, boxShadow: "0 8px 22px rgba(0,0,0,.45)" }}>
                <button onClick={() => setZoom((z) => z / 1.2)} title="Zoom out"
                  style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex", padding: 8, borderRadius: 6 }}><Icn d={I.minus} size={12} stroke={2} /></button>
                <button onClick={resetCamera} title="Reset zoom"
                  style={{ background: "none", border: "none", color: C.text, cursor: "pointer", fontSize: 11, fontFamily: MONO, padding: "6px 6px", minWidth: 44 }}>
                  {Math.round(zoom * 100)}%
                </button>
                <button onClick={() => setZoom((z) => z * 1.2)} title="Zoom in"
                  style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex", padding: 8, borderRadius: 6 }}><Icn d={I.plus} size={12} stroke={2} /></button>
              </div>
            )}
          </div>

          {/* tabs */}
          <div style={{ height: 42, display: "flex", alignItems: "stretch", borderTop: `1px solid ${C.line}`, background: C.panel, flexShrink: 0, overflowX: "auto" }}>
            {tabs.map((id) => {
              const isPv = id.startsWith("pv:");
              const f = files[isPv ? id.slice(3) : id];
              if (!f) return null;
              const v = FILE_VIEWS[f.view];
              if (!v && !isPv) return null;
              const on = id === active;
              return (
                <div key={id} onClick={() => { setActive(id); setSettingsFor(null); setSelectedMod(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 12px", cursor: "pointer", fontSize: 12, borderRight: `1px solid ${C.line}`, background: on ? C.bg : "transparent", color: on ? C.text : C.dim, boxShadow: on ? `inset 0 2px 0 ${C.gold}` : "none", whiteSpace: "nowrap" }}>
                  <span style={{ color: isPv ? "#E8956B" : v.color, display: "flex" }}>
                    <Icn d={isPv ? I.play : v.icon} size={11} />
                  </span>
                  {isPv ? `preview: ${f.name}` : f.name}
                  <button onClick={(e) => { e.stopPropagation(); closeTab(id); }}
                    style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: 4 }}>
                    <Icn d={I.x} size={8} stroke={2.2} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => newFile("core:board")} title="New board tab"
              style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", alignItems: "center", padding: "0 14px" }}>
              <Icn d={I.plus} size={11} />
            </button>
          </div>
        </div>
      </div>
      )}

      {/* mobile drawer */}
      {isMobile && drawer && (
        <>
          <div onClick={() => setDrawer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 70 }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: "68vh", background: C.panel, borderTop: `1px solid ${C.line}`, borderRadius: "16px 16px 0 0", zIndex: 71, display: "flex", flexDirection: "column", boxShadow: "0 -12px 40px rgba(0,0,0,.5)" }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: C.line, margin: "10px auto 6px" }} />
            <div style={{ display: "flex", gap: 6, padding: "4px 12px 10px" }}>
              {["files", "modules"].map((k) => (
                <button key={k} onClick={() => setDrawer(k)}
                  style={{ flex: 1, background: drawer === k ? C.panel2 : "none", border: `1px solid ${drawer === k ? "#E8C87A55" : C.line}`, color: drawer === k ? C.text : C.dim, fontSize: 12.5, fontWeight: 600, padding: "9px 0", borderRadius: 8, cursor: "pointer", fontFamily: SANS, textTransform: "capitalize" }}>
                  {k === "files" ? "Project files" : "Modules"}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>{railContent}</div>
          </div>
        </>
      )}
      </div>

      {ctxMenu && (
        <>
          <div onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "fixed", top: ctxMenu.y, left: ctxMenu.x, minWidth: 170, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 5, boxShadow: "0 16px 34px rgba(0,0,0,.55)", zIndex: 91 }}>
            {ctxMenu.node.kind === "folder" && (
              <button onClick={() => { const id = ctxMenu.node.id; setCtxMenu(null); newFolder(id); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: C.text, fontSize: 12.5, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontFamily: SANS }}>
                New folder
              </button>
            )}
            <button onClick={() => { const id = ctxMenu.node.id; setCtxMenu(null); startRename(id); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: C.text, fontSize: 12.5, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontFamily: SANS }}>
              Rename
            </button>
            <button onClick={() => { const id = ctxMenu.node.id; setCtxMenu(null); deleteNode(id); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: "#E8564A", fontSize: 12.5, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontFamily: SANS }}>
              Delete
            </button>
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 58, left: "50%", transform: "translateX(-50%)", background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, boxShadow: "0 10px 26px rgba(0,0,0,.5)", zIndex: 100, maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
