import { useState, useRef, useEffect } from "react";
import { registerView } from "../core/registry.js";
import { I, Icn } from "../core/icons.jsx";
import { C, CANVAS_W, CANVAS_H, HAND } from "../core/theme.js";

const PEN_COLORS = ["#E9E6DC", "#F2D06B", "#A8D8B0", "#93C5E8", "#EDA6AD"];
const PEN_SIZES = [2.5, 5, 9];

/* Pen state lives at module scope so the toolbar Overlay and
   the canvas Component share it without threading through App.
   (Per-file pen state wasn't worth it — pens are a hand tool,
   not document data.) */
let penState = { color: "#E9E6DC", size: 5, eraser: false };
const penListeners = new Set();
const setPen = (patch) => {
  penState = { ...penState, ...patch };
  penListeners.forEach((fn) => fn(penState));
};
const usePen = () => {
  const [p, setP] = useState(penState);
  useEffect(() => {
    const fn = (n) => setP(n);
    penListeners.add(fn);
    return () => penListeners.delete(fn);
  }, []);
  return p;
};

function DrawView({ file, onChange, ctx }) {
  const pen = usePen();
  const { canvasRef, zoom, pan, cameraActive } = ctx;
  const [current, setCurrent] = useState(null);
  const drawing = useRef(false);

  const pt = (e) => {
    const el = canvasRef.current;
    const r = el.getBoundingClientRect();
    return [(e.clientX - r.left - pan.x) / zoom, (e.clientY - r.top - pan.y) / zoom];
  };
  const eraseAt = (p) => {
    const keep = file.strokes.filter((s) => !s.points.some(([x, y]) => (x - p[0]) ** 2 + (y - p[1]) ** 2 < 14 ** 2));
    if (keep.length !== file.strokes.length) onChange({ ...file, strokes: keep });
  };
  const down = (e) => {
    if (cameraActive?.current) return; // a pinch just took over — don't start a stroke
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pt(e);
    if (pen.eraser) eraseAt(p);
    else setCurrent({ color: pen.color, size: pen.size, points: [p] });
  };
  const move = (e) => {
    if (cameraActive?.current) { drawing.current = false; setCurrent(null); return; } // pinch took over mid-stroke
    if (!drawing.current) return;
    const p = pt(e);
    if (pen.eraser) eraseAt(p);
    else setCurrent((c) => (c ? { ...c, points: [...c.points, p] } : c));
  };
  const up = () => {
    drawing.current = false;
    if (current && current.points.length > 1) onChange({ ...file, strokes: [...file.strokes, current] });
    setCurrent(null);
  };
  const toPts = (s) => s.points.map((p) => p.join(",")).join(" ");

  return (
    <svg width={file.settings.canvasW ?? CANVAS_W} height={file.settings.canvasH ?? CANVAS_H}
      style={{ display: "block", touchAction: "none", cursor: "crosshair" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      {file.strokes.length === 0 && !current && (
        <text x={80} y={140} fill={C.faint} fontFamily={HAND} fontSize="26" transform="rotate(-2 80 140)">
          pick a pen and sketch — level layouts, UI wireframes, anything
        </text>
      )}
      {file.strokes.map((s, i) => (
        <polyline key={i} points={toPts(s)} fill="none" stroke={s.color} strokeWidth={s.size} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {current && (
        <polyline points={toPts(current)} fill="none" stroke={current.color} strokeWidth={current.size} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function DrawToolbar({ file, onChange }) {
  const pen = usePen();
  const canUndo = file.strokes.length > 0;
  return (
    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 30, display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 12px", boxShadow: "0 8px 22px rgba(0,0,0,.45)", flexWrap: "wrap", maxWidth: "calc(100% - 20px)" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {PEN_COLORS.map((c) => (
          <button key={c} onClick={() => setPen({ color: c, eraser: false })}
            style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: pen.color === c && !pen.eraser ? "2px solid #E9E6DC" : "2px solid transparent", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.35)" }} />
        ))}
      </div>
      <div style={{ width: 1, height: 20, background: C.line }} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {PEN_SIZES.map((s) => (
          <button key={s} onClick={() => setPen({ size: s, eraser: false })}
            style={{ width: 24, height: 24, borderRadius: 6, background: pen.size === s && !pen.eraser ? C.panel2 : "none", border: `1px solid ${pen.size === s && !pen.eraser ? "#E8C87A55" : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: s * 1.6, height: s * 1.6, borderRadius: "50%", background: C.text }} />
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 20, background: C.line }} />
      <button onClick={() => setPen({ eraser: !pen.eraser })} title="Eraser"
        style={{ background: pen.eraser ? C.gold : "none", border: "none", color: pen.eraser ? C.ink : C.dim, cursor: "pointer", display: "flex", padding: 5, borderRadius: 6 }}>
        <Icn d={I.eraser} size={14} />
      </button>
      <button onClick={() => onChange({ ...file, strokes: file.strokes.slice(0, -1) })} disabled={!canUndo} title="Undo stroke"
        style={{ background: "none", border: "none", color: canUndo ? C.dim : C.line, cursor: canUndo ? "pointer" : "default", display: "flex", padding: 5 }}>
        <Icn d={I.undo} size={14} />
      </button>
      <button onClick={() => onChange({ ...file, strokes: [] })} disabled={!canUndo} title="Clear drawing"
        style={{ background: "none", border: "none", color: canUndo ? C.dim : C.line, cursor: canUndo ? "pointer" : "default", display: "flex", padding: 5 }}>
        <Icn d={I.trash} size={14} />
      </button>
    </div>
  );
}

registerView("core:draw", {
  label: "draw",
  icon: I.pencil,
  color: "#EDA6AD",
  zoomable: true,
  canvas: true,
  version: 3,
  migrate: (data, fromVersion) => {
    // one call per version step (fromVersion -> +1), not cumulative.
    if (fromVersion === 1) return { ...data, settings: { ...data.settings, pan: data.settings.pan ?? { x: 0, y: 0 } } };
    if (fromVersion === 2) return { ...data, settings: { ...data.settings, canvasW: data.settings.canvasW ?? CANVAS_W, canvasH: data.settings.canvasH ?? CANVAS_H } };
    return data;
  },
  create: () => ({ settings: { tone: "ink", grid: false, zoom: 1, pan: { x: 0, y: 0 }, canvasW: CANVAS_W, canvasH: CANVAS_H }, strokes: [] }),
  Component: DrawView,
  Overlay: DrawToolbar,
});
