import { useState, useRef, useEffect } from "react";
import { MODULE_TYPES, FILE_VIEWS } from "./core/registry.js";
import { storage } from "./core/storage.js";
import { migrateProject, PROJECT_SCHEMA_VERSION } from "./core/migrations.js";
import { seedFiles, seedTree, seedTabs, seedExpanded } from "./core/seed.js";
import { I, Icn } from "./core/icons.jsx";
import { C, STICKY, TONES, CANVAS_W, CANVAS_H, clampZ, uid, fileExt, KNOWN_EXTS, MONO, SANS, HAND } from "./core/theme.js";
import { makeModule } from "./views/board.jsx";
import { PreviewView, runFile } from "./views/code.jsx";

/* ---------- folder tree ---------- */
function TreeNode({ node, depth, files, expanded, toggle, openFile, activeId }) {
  const pad = 10 + depth * 14;
  if (node.kind === "folder") {
    const open = expanded.has(node.id);
    return (
      <div>
        <div onClick={() => toggle(node.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: `7px 8px 7px ${pad}px`, cursor: "pointer", color: C.dim, fontSize: 12.5, borderRadius: 5 }}>
          <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .12s", display: "flex" }}><Icn d={I.chev} size={9} /></span>
          <Icn d={I.folder} size={13} />
          <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
        </div>
        {open && node.children.map((ch) => (
          <TreeNode key={ch.id} node={ch} depth={depth + 1} files={files} expanded={expanded} toggle={toggle} openFile={openFile} activeId={activeId} />
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
    <div onClick={() => openFile(node.id)}
      style={{ display: "flex", alignItems: "center", gap: 7, padding: `7px 8px 7px ${pad + 15}px`, cursor: "pointer", fontSize: 12.5, borderRadius: 5, color: isActive ? C.text : C.dim, background: isActive ? C.panel2 : "transparent" }}>
      <span style={{ color: f.view === "core:code" ? KNOWN_EXTS[ext] ?? v.color : v.color, display: "flex" }}>
        <Icn d={v.icon} size={12} />
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
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
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedMod, setSelectedMod] = useState(null);
  const [settingsFor, setSettingsFor] = useState(null);
  const [saveState, setSaveState] = useState({ status: "saved", at: "—" });
  const [drawer, setDrawer] = useState(null);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const canvasRef = useRef(null);
  const toastT = useRef(null);
  const saveT = useRef(null);
  const zoomApi = useRef({});
  const camActive = useRef(false);

  const isMobile = vw < 760;
  const previewOf = active?.startsWith("pv:") ? active.slice(3) : null;
  const file = previewOf ? null : files[active];
  const previewFile = previewOf ? files[previewOf] : null;
  const view = file ? FILE_VIEWS[file.view] : null;
  const isBoard = file?.view === "core:board";
  const zoomable = !!view?.zoomable;
  const zoom = zoomable ? file.settings.zoom ?? 1 : 1;
  const pan = zoomable ? file.settings.pan ?? { x: 0, y: 0 } : { x: 0, y: 0 };
  const canvasish = !!view?.canvas;
  const ext = file?.view === "core:code" ? fileExt(file.name) : "";

  /* ---- load persisted project on boot ---- */
  useEffect(() => {
    (async () => {
      const saved = migrateProject(await storage.load());
      if (saved?.files && saved?.tree) {
        setFiles(saved.files);
        setTree(saved.tree);
        setTabs(saved.tabs ?? []);
        setActive(saved.active ?? saved.tabs?.[0] ?? null);
        setExpanded(new Set(saved.expanded ?? []));
      }
      setLoaded(true);
    })();
  }, []);

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
      await storage.save({ schemaVersion: PROJECT_SCHEMA_VERSION, files, tree, tabs, active, expanded: [...expanded] });
      setSaveState({ status: "saved", at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    }, 650);
    return () => clearTimeout(saveT.current);
  }, [files, tree, tabs, active, expanded, loaded]);

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
      if (pts.size === 0) { mode = null; camActive.current = false; }
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
  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openFile = (id) => {
    setTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActive(id);
    setSettingsFor(null); setSelectedMod(null); setDrawer(null);
  };
  const closeTab = (id) => setTabs((t) => {
    const n = t.filter((x) => x !== id);
    if (active === id) setActive(n[n.length - 1] ?? null);
    return n;
  });

  const addModule = (type, x = 100, y = 100) => {
    if (!file) return say("Open a board file first");
    if (!isBoard) return say(`Modules pin to board views — this tab is a ${view.label}`);
    updateFile(active, { modules: [...file.modules, makeModule(type, x, y)] });
    setDrawer(null);
  };

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

  /* ctx handed to view Components and Overlays */
  const ctx = {
    files, activeId: active, updateFile, canvasRef, zoom, pan, isMobile, say, openFile,
    cameraActive: camActive,
    selection: { selectedMod, setSelectedMod, settingsFor, setSettingsFor },
  };

  /* ---- menus ---- */
  const selExists = isBoard && file?.modules.some((m) => m.id === selectedMod);
  const patchSel = (patch) => updateFile(active, { modules: file.modules.map((m) => (m.id === selectedMod ? { ...m, ...patch } : m)) });
  const fileItems = [
    ...Object.entries(FILE_VIEWS).map(([k, v]) => ({ label: `New ${v.label}`, act: () => newFile(k) })),
    { sep: true },
    { label: "Close tab", act: () => closeTab(active), dis: !active },
    { sep: true },
    { label: "Reset project…", act: async () => { await storage.reset(); location.reload(); } },
  ];
  const editItems = [
    { label: "Straighten module", act: () => patchSel({ rot: 0 }), dis: !selExists },
    { label: "Delete module", act: () => { updateFile(active, { modules: file.modules.filter((m) => m.id !== selectedMod) }); setSelectedMod(null); setSettingsFor(null); }, dis: !selExists },
    { sep: true },
    { label: "Clear board", act: () => updateFile(active, { modules: [] }), dis: !isBoard },
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
          {isMobile ? "modules — tap to pin to the board" : "modules — drag onto the board"}
        </div>
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
      </div>
      <div style={{ flex: isMobile ? "unset" : "1 1 48%", borderTop: isMobile ? "none" : `1px solid ${C.line}`, overflowY: "auto", padding: "12px 10px", minHeight: 0, display: isMobile && drawer !== "files" ? "none" : "block" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 4px 8px" }}>
          <span style={{ fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase", color: C.faint, fontFamily: MONO }}>project files</span>
          {Object.entries(FILE_VIEWS).map(([k, v], i) => (
            <button key={k} onClick={() => newFile(k)} title={`New ${v.label}`}
              style={{ marginLeft: i === 0 ? "auto" : 0, background: "none", border: "none", color: v.color, cursor: "pointer", display: "flex", padding: 4 }}>
              <Icn d={v.icon} size={12} />
            </button>
          ))}
        </div>
        {tree.map((n) => (
          <TreeNode key={n.id} node={n} depth={0} files={files} expanded={expanded} toggle={toggle} openFile={openFile} activeId={active} />
        ))}
      </div>
    </>
  );

  if (!loaded) return <div style={{ height: "100vh", background: C.bg }} />;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.text, fontFamily: SANS, overflow: "hidden" }}>
      {/* ===== menu bar ===== */}
      <div style={{ height: 42, display: "flex", alignItems: "center", padding: "0 8px", borderBottom: `1px solid ${C.line}`, flexShrink: 0, position: "relative", zIndex: 60 }}>
        {isMobile && (
          <button onClick={() => setDrawer((d) => (d ? null : "files"))}
            style={{ background: drawer ? C.panel2 : "none", border: "none", color: C.text, cursor: "pointer", display: "flex", padding: 8, borderRadius: 6 }}>
            <Icn d={I.burger} size={15} stroke={1.8} />
          </button>
        )}
        <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 13, letterSpacing: 0.5, padding: "0 8px" }}>devboard</span>
        {Object.entries(menus).map(([name, items]) => (
          <div key={name} style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((m) => (m === name ? null : name))}
              onMouseEnter={() => menuOpen && setMenuOpen(name)}
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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontFamily: MONO, color: C.faint, padding: "0 6px" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: saveState.status === "saving" ? C.gold : "#A8D8B0", transition: "background .2s", flexShrink: 0 }} />
          {!isMobile && (saveState.status === "saving" ? "saving…" : `autosaved ${saveState.at}`)}
        </div>
      </div>
      {menuOpen && <div onClick={() => setMenuOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 55 }} />}

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
            ) : file ? (
              <>
                <span style={{ color: file.view === "core:code" ? KNOWN_EXTS[ext] ?? view.color : view.color, display: "flex", flexShrink: 0 }}>
                  <Icn d={view.icon} size={13} />
                </span>
                <input value={file.name} onChange={(e) => updateFile(active, { name: e.target.value })}
                  style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, fontWeight: 600, fontFamily: file.view === "core:code" ? MONO : SANS, flex: 1, minWidth: 0 }} />
                {HeaderAction && <HeaderAction file={file} ctx={ctx} />}
                <span style={{ fontSize: 10, fontFamily: MONO, color: C.faint, border: `1px solid ${C.line}`, padding: "1px 8px", borderRadius: 10, flexShrink: 0 }}>{view.label}</span>
              </>
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
                  style={{ position: "absolute", top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", cursor: "grab", ...gridBg }}
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

      {toast && (
        <div style={{ position: "fixed", bottom: 58, left: "50%", transform: "translateX(-50%)", background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, boxShadow: "0 10px 26px rgba(0,0,0,.5)", zIndex: 100, maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
