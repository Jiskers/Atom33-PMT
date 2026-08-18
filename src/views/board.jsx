import { useState, useRef, useEffect } from "react";
import { registerView, MODULE_TYPES } from "../core/registry.js";
import { I, Icn } from "../core/icons.jsx";
import { C, MONO, SANS, HAND, uid, CANVAS_W, CANVAS_H } from "../core/theme.js";

const MIN_W = 120;
const MAX_ATTACH_BYTES = 5 * 1024 * 1024; // 5MB — data URLs live inline in file JSON

/* Connect-mode state lives at module scope, like draw.jsx's pen —
   it's a hand tool shared between the canvas and the toolbar
   Overlay (two separate components App.jsx renders as siblings),
   not document data worth threading through file.settings/undo. */
let connectState = { active: false, from: null };
const connectListeners = new Set();
const setConnect = (patch) => {
  connectState = { ...connectState, ...patch };
  connectListeners.forEach((fn) => fn(connectState));
};
const useConnect = () => {
  const [c, setC] = useState(connectState);
  useEffect(() => {
    const fn = (n) => setC(n);
    connectListeners.add(fn);
    return () => connectListeners.delete(fn);
  }, []);
  return c;
};

/* ---------- attachment lightbox: fixed-position so a rotated
   card's counter-rotation trick isn't needed ---------- */
function AttachmentPopup({ m, onClose }) {
  const a = m.attachment;
  if (!a) return null;
  const isImage = a.type?.startsWith("image/");
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", maxWidth: "min(720px, 92vw)", maxHeight: "88vh", overflow: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, boxShadow: "0 24px 60px rgba(0,0,0,.6)", zIndex: 201 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 }}>
            <Icn d={I.x} size={13} stroke={2} />
          </button>
        </div>
        {isImage ? (
          <img src={a.dataUrl} style={{ maxWidth: "100%", maxHeight: "70vh", display: "block", borderRadius: 6, margin: "0 auto" }} />
        ) : (
          <div style={{ textAlign: "center", padding: "30px 10px" }}>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 14 }}>{((a.size ?? 0) / 1024).toFixed(0)} KB · {a.type || "unknown type"}</div>
            <a href={a.dataUrl} download={a.name} target="_blank" rel="noopener"
              style={{ display: "inline-block", background: C.gold, color: C.ink, textDecoration: "none", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: 6 }}>
              Open / download
            </a>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- one pinned, draggable module instance ---------- */
function ModuleCard({ m, ctx, ops, connect }) {
  const { canvasRef, zoom, pan, isMobile, selection, cameraActive, say } = ctx;
  const drag = useRef(null);
  const resizing = useRef(null);
  const fileInputRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const def = MODULE_TYPES[m.type];
  if (!def) return null;
  const { Body, Settings } = def;
  const selected = selection.selectedMod === m.id;
  const settingsOpen = selection.settingsFor === m.id;
  const showTools = isMobile ? selected || settingsOpen : hover || settingsOpen;
  const width = m.w ?? def.w;

  const ptr = (e) => {
    const el = canvasRef.current;
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
  };
  const down = (e) => {
    if (cameraActive?.current) return; // a pinch just took over — don't start a drag
    if (connect.active) { e.stopPropagation(); connect.onClick(m.id); return; }
    selection.setSelectedMod(m.id);
    ops.toFront();
    if (m.locked) return;
    if (e.target.closest("input,textarea,button,label,[data-nodrag]")) return;
    const p = ptr(e);
    drag.current = { ox: p.x - m.x, oy: p.y - m.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (cameraActive?.current) { drag.current = null; return; } // pinch took over mid-drag
    if (!drag.current) return;
    const p = ptr(e);
    ops.move(Math.max(0, p.x - drag.current.ox), Math.max(0, p.y - drag.current.oy));
  };
  const up = () => (drag.current = null);
  const btn = isMobile ? 26 : 21;

  const resizeDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const resizeMove = (e) => {
    if (!resizing.current) return;
    const p = ptr(e);
    ops.patch({ w: Math.max(MIN_W, Math.round(p.x - m.x)) });
  };
  const resizeUp = () => (resizing.current = false);

  const pickFile = () => fileInputRef.current?.click();
  const onFileChosen = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_ATTACH_BYTES) return say(`"${f.name}" is over 5MB — too big to attach`);
    const reader = new FileReader();
    reader.onload = () => ops.patch({ attachment: { name: f.name, type: f.type, size: f.size, dataUrl: reader.result } });
    reader.readAsDataURL(f);
  };

  const isImage = m.attachment?.type?.startsWith("image/");

  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute", left: m.x, top: m.y, width,
        transform: `rotate(${m.rot}deg)`, cursor: connect.active ? "crosshair" : m.locked ? "default" : "grab",
        boxShadow: "0 10px 22px rgba(0,0,0,.45)", borderRadius: 3, touchAction: "none",
        outline: selected ? "1.5px solid rgba(232,200,122,.55)" : connect.from === m.id ? "1.5px solid #E8564A" : "none", outlineOffset: 3,
      }}>
      {/* the pin */}
      <div title={m.locked ? "Locked" : ""}
        style={{
          position: "absolute", top: -6, left: "50%", marginLeft: -6, width: 12, height: 12,
          borderRadius: "50%", zIndex: 2, boxShadow: "0 3px 4px rgba(0,0,0,.5)",
          background: m.locked
            ? "radial-gradient(circle at 35% 30%, #B8BDC7, #6B7280 65%)"
            : "radial-gradient(circle at 35% 30%, #F08A80, #C0392B 65%)",
        }} />
      {m.flag && (
        <div title={m.due ? `Reminder: ${m.due}` : "Flagged for Home"}
          style={{ position: "absolute", top: -8, left: "calc(50% + 9px)", width: 15, height: 15, borderRadius: "50%", background: "#E8564A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, boxShadow: "0 3px 4px rgba(0,0,0,.5)" }}>
          <Icn d={I.flag} size={8} stroke={2.4} />
        </div>
      )}
      {showTools && (
        <div style={{ position: "absolute", top: -11, right: -11, display: "flex", gap: 5, zIndex: 3 }} data-nodrag>
          <button onClick={() => selection.setSettingsFor(settingsOpen ? null : m.id)} title="Module settings"
            style={{ width: btn, height: btn, borderRadius: "50%", border: "none", background: settingsOpen ? C.gold : "#3A3F4A", color: settingsOpen ? C.ink : C.dim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icn d={I.gear} size={12} />
          </button>
          <button onClick={ops.remove} title="Remove"
            style={{ width: btn, height: btn, borderRadius: "50%", border: "none", background: "#3A3F4A", color: C.dim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icn d={I.x} size={10} stroke={2} />
          </button>
        </div>
      )}

      <div style={{ borderRadius: 3, overflow: "hidden" }}>
        {m.attachment && (
          isImage ? (
            <img src={m.attachment.dataUrl} data-nodrag onClick={() => setShowAttachment(true)}
              style={{ width: "100%", height: 76, objectFit: "cover", cursor: "pointer", display: "block" }} />
          ) : (
            <button data-nodrag onClick={() => setShowAttachment(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "#20242D", border: "none", borderBottom: `1px solid ${C.line}`, color: C.dim, fontSize: 10.5, padding: "7px 9px", cursor: "pointer", fontFamily: SANS, textAlign: "left" }}>
              <Icn d={I.paperclip} size={11} stroke={1.8} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m.attachment.name}</span>
            </button>
          )
        )}
        <Body m={m} onData={ops.data} />
      </div>

      {/* resize handle — bottom-right corner, drag to change width */}
      {showTools && (
        <div data-nodrag onPointerDown={resizeDown} onPointerMove={resizeMove} onPointerUp={resizeUp}
          title="Drag to resize"
          style={{ position: "absolute", bottom: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: "#3A3F4A", cursor: "nwse-resize", zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}>
          <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 7L7 1M4 7L7 4" stroke={C.dim} strokeWidth="1.3" strokeLinecap="round" /></svg>
        </div>
      )}

      {showAttachment && <AttachmentPopup m={m} onClose={() => setShowAttachment(false)} />}

      {/* instance settings: plugin panel + core controls */}
      {settingsOpen && (
        <div data-nodrag onPointerDown={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 210, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 13, zIndex: 20, boxShadow: "0 14px 30px rgba(0,0,0,.55)", cursor: "default", transform: `rotate(${-m.rot}deg)` }}>
          <div style={{ fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: C.faint, fontFamily: MONO, marginBottom: 11 }}>
            {def.label} settings
          </div>
          {Settings && <div style={{ marginBottom: 12 }}><Settings m={m} onData={ops.data} onPatch={ops.patch} /></div>}
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 9 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: C.text }}>
              <input type="checkbox" checked={!!m.locked} onChange={() => ops.patch({ locked: !m.locked })} style={{ accentColor: C.gold }} />
              Lock position
            </label>
            <button onClick={() => ops.patch({ rot: 0 })}
              style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontSize: 11.5, padding: "6px 11px", borderRadius: 6, cursor: "pointer", alignSelf: "flex-start" }}>
              Straighten
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: C.text }}>
              <input type="checkbox" checked={!!m.flag} onChange={() => ops.patch({ flag: !m.flag })} style={{ accentColor: "#E8564A" }} />
              Remind me on Home
            </label>
            {m.flag && (
              <input type="date" data-nodrag value={m.due ?? ""} onChange={(e) => ops.patch({ due: e.target.value })}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontSize: 12, padding: "6px 8px", borderRadius: 6, fontFamily: SANS, colorScheme: "dark" }} />
            )}
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
              <input ref={fileInputRef} type="file" data-nodrag onChange={onFileChosen} style={{ display: "none" }} />
              <button onClick={pickFile}
                style={{ display: "flex", alignItems: "center", gap: 6, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontSize: 11.5, padding: "6px 11px", borderRadius: 6, cursor: "pointer", alignSelf: "flex-start" }}>
                <Icn d={I.paperclip} size={11} stroke={1.8} />
                {m.attachment ? "Replace attachment" : "Attach file / photo"}
              </button>
              {m.attachment && (
                <button onClick={() => ops.patch({ attachment: null })}
                  style={{ background: "none", border: "none", color: C.faint, fontSize: 11, padding: "2px 0", cursor: "pointer", alignSelf: "flex-start" }}>
                  Remove attachment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- floating toolbar: string-connect toggle ---------- */
function BoardOverlay() {
  const connect = useConnect();
  return (
    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 30, display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 12px", boxShadow: "0 8px 22px rgba(0,0,0,.45)" }}>
      <button onClick={() => setConnect(connect.active ? { active: false, from: null } : { active: true, from: null })}
        title="Connect two pins with a string"
        style={{ display: "flex", alignItems: "center", gap: 7, background: connect.active ? "#E8564A" : "none", color: connect.active ? "#fff" : C.dim, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: SANS, fontWeight: 600 }}>
        <Icn d={I.pin} size={13} stroke={2} />
        {connect.active ? (connect.from ? "click a second pin…" : "click a pin to start…") : "connect pins"}
      </button>
    </div>
  );
}

/* helpers other parts of the app use (menus, drops) */
export const makeModule = (type, x, y) => ({
  id: uid("m"), type, x, y,
  rot: Math.random() * 4 - 2,
  tint: Math.floor(Math.random() * 4),
  locked: false,
  flag: false, // "remind me" — surfaced by the Home dashboard's Reminders widget
  due: "",
  w: null, // per-instance width override; null = use the module type's default
  attachment: null, // { name, type, size, dataUrl } | null
  data: MODULE_TYPES[type].create(),
});

function BoardView({ file, onChange, ctx }) {
  const connectVal = useConnect();
  const connections = file.connections ?? [];

  const ops = (mid) => ({
    move: (x, y) => onChange({ ...file, modules: file.modules.map((m) => (m.id === mid ? { ...m, x, y } : m)) }),
    toFront: () => onChange({ ...file, modules: [...file.modules.filter((m) => m.id !== mid), file.modules.find((m) => m.id === mid)] }),
    data: (patch) => onChange({ ...file, modules: file.modules.map((m) => (m.id === mid ? { ...m, data: { ...m.data, ...patch } } : m)) }),
    patch: (patch) => onChange({ ...file, modules: file.modules.map((m) => (m.id === mid ? { ...m, ...patch } : m)) }),
    remove: () => {
      onChange({ ...file, modules: file.modules.filter((m) => m.id !== mid), connections: connections.filter((c) => c.a !== mid && c.b !== mid) });
      if (ctx.selection.settingsFor === mid) ctx.selection.setSettingsFor(null);
      if (ctx.selection.selectedMod === mid) ctx.selection.setSelectedMod(null);
    },
  });

  const onConnectClick = (mid) => {
    if (!connectVal.from) { setConnect({ from: mid }); return; }
    if (connectVal.from === mid) { setConnect({ active: false, from: null }); return; } // clicked the same pin twice — cancel
    const bothExist = file.modules.some((m) => m.id === connectVal.from) && file.modules.some((m) => m.id === mid);
    if (bothExist) onChange({ ...file, connections: [...connections, { id: uid("s"), a: connectVal.from, b: mid }] });
    setConnect({ active: false, from: null }); // one string per toggle, then exit connect mode
  };

  const pinOf = (mid) => {
    const m = file.modules.find((x) => x.id === mid);
    if (!m) return null;
    const def = MODULE_TYPES[m.type];
    const w = m.w ?? def?.w ?? 200;
    return { x: m.x + w / 2, y: m.y };
  };

  return (
    <>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
        {connections.map((c) => {
          const p1 = pinOf(c.a), p2 = pinOf(c.b);
          if (!p1 || !p2) return null;
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2 + 18; // slight sag, like real string
          const d = `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
          return (
            <g key={c.id}>
              <path d={d} stroke="transparent" strokeWidth={14} fill="none" pointerEvents="stroke" style={{ cursor: "pointer" }}
                onPointerDown={(e) => { e.stopPropagation(); onChange({ ...file, connections: connections.filter((x) => x.id !== c.id) }); }} />
              <path d={d} stroke="#C0392B" strokeWidth={1.6} fill="none" opacity={0.85} />
            </g>
          );
        })}
      </svg>

      {file.modules.length === 0 && (
        <div style={{ position: "absolute", top: 90, left: 40, fontFamily: HAND, fontSize: 26, color: C.faint, transform: "rotate(-2deg)", pointerEvents: "none" }}>
          {ctx.isMobile ? "open the menu ☰ and tap a module to pin it here" : "drag a module from the left and pin it here →"}
        </div>
      )}
      {file.modules.map((m) => (
        <ModuleCard key={m.id} m={m} ctx={ctx} ops={ops(m.id)} connect={{ active: connectVal.active, from: connectVal.from, onClick: onConnectClick }} />
      ))}
    </>
  );
}

registerView("core:board", {
  label: "board",
  icon: I.board,
  color: "#E8C87A",
  zoomable: true,
  canvas: true,
  modules: true,
  version: 4,
  migrate: (data, fromVersion) => {
    // migrations.js calls this once per version step (fromVersion -> +1),
    // not cumulatively — each branch must return, not fall through.
    if (fromVersion === 1) return { ...data, settings: { ...data.settings, pan: data.settings.pan ?? { x: 0, y: 0 } } };
    if (fromVersion === 2) return { ...data, settings: { ...data.settings, canvasW: data.settings.canvasW ?? CANVAS_W, canvasH: data.settings.canvasH ?? CANVAS_H } };
    if (fromVersion === 3) return { ...data, connections: data.connections ?? [] };
    return data;
  },
  create: () => ({ settings: { grid: true, tone: "slate", zoom: 1, pan: { x: 0, y: 0 }, canvasW: CANVAS_W, canvasH: CANVAS_H }, modules: [], connections: [] }),
  Component: BoardView,
  Overlay: BoardOverlay,
});
