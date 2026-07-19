import { useState } from "react";
import { registerView } from "../core/registry.js";
import { I } from "../core/icons.jsx";
import { C, MONO, SANS } from "../core/theme.js";

/* ---------- tiny, safe formula engine ----------
   Supports numbers, + - * / ( ), cell refs (A1), and
   SUM(A1:B3). Anything else evaluates to #ERR. The
   character whitelist before eval is the safety gate. */
const cellNum = (cells, k, depth) => {
  const v = evalCell(cells, k, depth + 1);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
export const evalCell = (cells, key, depth = 0) => {
  const raw = (cells[key] ?? "").toString().trim();
  if (!raw.startsWith("=")) return raw;
  if (depth > 12) return "#LOOP";
  let expr = raw.slice(1).toUpperCase();
  expr = expr.replace(/SUM\(([A-Z])(\d+):([A-Z])(\d+)\)/g, (_, c1, r1, c2, r2) => {
    const cs = [c1.charCodeAt(0), c2.charCodeAt(0)].sort((a, b) => a - b);
    const rs = [+r1, +r2].sort((a, b) => a - b);
    const parts = [];
    for (let c = cs[0]; c <= cs[1]; c++)
      for (let r = rs[0]; r <= rs[1]; r++)
        parts.push(cellNum(cells, String.fromCharCode(c) + r, depth));
    return "(" + parts.join("+") + ")";
  });
  expr = expr.replace(/([A-Z])(\d+)/g, (_, c, r) => cellNum(cells, c + r, depth));
  if (!/^[\d+\-*/().\s]*$/.test(expr) || !expr.trim()) return "#ERR";
  try {
    const v = Function(`"use strict";return (${expr})`)();
    return Number.isFinite(v) ? String(+v.toFixed(2)) : "#ERR";
  } catch {
    return "#ERR";
  }
};

const COLS = 6, ROWS = 16;

function SheetView({ file, onChange, ctx }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const cells = file.cells;
  const colW = ctx.isMobile ? 84 : 108;

  const commit = () => {
    if (editing) {
      const next = { ...cells };
      if (draft.trim() === "") delete next[editing];
      else next[editing] = draft;
      onChange({ ...file, cells: next });
    }
    setEditing(null);
  };

  return (
    <div style={{ padding: ctx.isMobile ? 10 : 18, minHeight: "100%" }}>
      <div style={{ display: "inline-block", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", background: C.panel }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ width: 34, background: C.panel2, borderBottom: `1px solid ${C.line}` }} />
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c} style={{ width: colW, padding: "6px 0", background: C.panel2, borderBottom: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}`, fontSize: 10.5, fontWeight: 500, color: C.dim, fontFamily: MONO }}>
                  {String.fromCharCode(65 + c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r}>
                <td style={{ background: C.panel2, borderTop: `1px solid ${C.line}`, textAlign: "center", fontSize: 10, color: C.faint, fontFamily: MONO }}>{r + 1}</td>
                {Array.from({ length: COLS }, (_, c) => {
                  const key = String.fromCharCode(65 + c) + (r + 1);
                  const raw = cells[key] ?? "";
                  const isEd = editing === key;
                  const val = evalCell(cells, key);
                  const isNum = raw && !isEd && /^[\d.]+$/.test(val);
                  const isFormula = raw.toString().startsWith("=");
                  return (
                    <td key={c}
                      onClick={() => { commit(); setEditing(key); setDraft(raw.toString()); }}
                      style={{ borderTop: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}`, padding: 0, height: 30, background: isEd ? C.panel2 : "transparent" }}>
                      {isEd ? (
                        <input autoFocus value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }}
                          style={{ width: "100%", height: "100%", background: "transparent", border: "none", outline: "1.5px solid #A8D8B0", outlineOffset: -1, color: C.text, fontSize: 12, padding: "0 7px", fontFamily: MONO }} />
                      ) : (
                        <div style={{ padding: "0 7px", fontSize: 12, lineHeight: "30px", color: isFormula ? "#A8D8B0" : C.text, textAlign: isNum ? "right" : "left", fontFamily: isNum || isFormula ? MONO : SANS, fontWeight: r === 0 && raw ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: colW }}>
                          {val}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10.5, color: C.faint, marginTop: 10, fontFamily: MONO }}>
        start a cell with = for formulas — try =B2*C2 or =SUM(D2:D5)
      </div>
    </div>
  );
}

registerView("sheet", {
  label: "sheet",
  icon: I.sheet,
  color: "#A8D8B0",
  zoomable: false,
  canvas: false,
  create: () => ({ settings: {}, cells: {} }),
  Component: SheetView,
});
