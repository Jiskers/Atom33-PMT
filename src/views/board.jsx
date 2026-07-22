import { useState, useRef } from "react";
import { registerView, MODULE_TYPES } from "../core/registry.js";
import { I, Icn } from "../core/icons.jsx";
import { C, MONO, HAND, uid, CANVAS_W, CANVAS_H } from "../core/theme.js";

/* ---------- one pinned, draggable module instance ---------- */
function ModuleCard({ m, ctx, ops }) {
  const { canvasRef, zoom, pan, isMobile, selection, cameraActive } = ctx;
  const drag = useRef(null);
  const [hover, setHover] = useState(false);
  const def = MODULE_TYPES[m.type];
  if (!def) return null;
  const { Body, Settings } = def;
  const selected = selection.selectedMod === m.id;
  const settingsOpen = selection.settingsFor === m.id;
  const showTools = isMobile ? selected || settingsOpen : hover || settingsOpen;

  const ptr = (e) => {
    const el = canvasRef.current;
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
  };
  const down = (e) => {
    if (cameraActive?.current) return; // a pinch just took over — don't start a drag
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

  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute", left: m.x, top: m.y, width: def.w,
        transform: `rotate(${m.rot}deg)`, cursor: m.locked ? "default" : "grab",
        boxShadow: "0 10px 22px rgba(0,0,0,.45)", borderRadius: 3, touchAction: "none",
        outline: selected ? "1.5px solid rgba(232,200,122,.55)" : "none", outlineOffset: 3,
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
        <Body m={m} onData={ops.data} />
      </div>

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
          </div>
        </div>
      )}
    </div>
  );
}

/* helpers other parts of the app use (menus, drops) */
export const makeModule = (type, x, y) => ({
  id: uid("m"), type, x, y,
  rot: Math.random() * 4 - 2,
  tint: Math.floor(Math.random() * 4),
  locked: false,
  data: MODULE_TYPES[type].create(),
});

function BoardView({ file, onChange, ctx }) {
  const ops = (mid) => ({
    move: (x, y) => onChange({ ...file, modules: file.modules.map((m) => (m.id === mid ? { ...m, x, y } : m)) }),
    toFront: () => onChange({ ...file, modules: [...file.modules.filter((m) => m.id !== mid), file.modules.find((m) => m.id === mid)] }),
    data: (patch) => onChange({ ...file, modules: file.modules.map((m) => (m.id === mid ? { ...m, data: { ...m.data, ...patch } } : m)) }),
    patch: (patch) => onChange({ ...file, modules: file.modules.map((m) => (m.id === mid ? { ...m, ...patch } : m)) }),
    remove: () => {
      onChange({ ...file, modules: file.modules.filter((m) => m.id !== mid) });
      if (ctx.selection.settingsFor === mid) ctx.selection.setSettingsFor(null);
      if (ctx.selection.selectedMod === mid) ctx.selection.setSelectedMod(null);
    },
  });

  return (
    <>
      {file.modules.length === 0 && (
        <div style={{ position: "absolute", top: 90, left: 40, fontFamily: HAND, fontSize: 26, color: C.faint, transform: "rotate(-2deg)", pointerEvents: "none" }}>
          {ctx.isMobile ? "open the menu ☰ and tap a module to pin it here" : "drag a module from the left and pin it here →"}
        </div>
      )}
      {file.modules.map((m) => (
        <ModuleCard key={m.id} m={m} ctx={ctx} ops={ops(m.id)} />
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
  version: 3,
  migrate: (data, fromVersion) => {
    // migrations.js calls this once per version step (fromVersion -> +1),
    // not cumulatively — each branch must return, not fall through.
    if (fromVersion === 1) return { ...data, settings: { ...data.settings, pan: data.settings.pan ?? { x: 0, y: 0 } } };
    if (fromVersion === 2) return { ...data, settings: { ...data.settings, canvasW: data.settings.canvasW ?? CANVAS_W, canvasH: data.settings.canvasH ?? CANVAS_H } };
    return data;
  },
  create: () => ({ settings: { grid: true, tone: "slate", zoom: 1, pan: { x: 0, y: 0 }, canvasW: CANVAS_W, canvasH: CANVAS_H }, modules: [] }),
  Component: BoardView,
});
