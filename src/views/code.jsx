import { useState, useRef } from "react";
import { registerView } from "../core/registry.js";
import { I, Icn } from "../core/icons.jsx";
import { C, MONO, SANS, fileExt, RUNNABLE } from "../core/theme.js";

/* Build a preview document, inlining <link href> and
   <script src> that match sibling code files by name.
   The real app would resolve full relative paths through
   the folder tree; name-matching covers the common case. */
export const buildSrcdoc = (files, fileId) => {
  const codeFiles = Object.values(files).filter((f) => f.view === "code");
  let html = files[fileId]?.code ?? "";
  html = html.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (mt, href) => {
    const f = codeFiles.find((cf) => cf.name === href || cf.name === href.split("/").pop());
    return f ? `<style>\n${f.code}\n</style>` : mt;
  });
  html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (mt, src) => {
    const f = codeFiles.find((cf) => cf.name === src || cf.name === src.split("/").pop());
    return f ? `<script>\n${f.code}\n</script>` : mt;
  });
  return html;
};

export const runFile = (files, id, openFile, say) => {
  const f = files[id];
  const e = fileExt(f.name);
  if (RUNNABLE.includes(e)) return openFile("pv:" + id);
  if (e === "php")
    return say("PHP needs a runtime — the real app would bundle php-wasm or a local server. HTML runs right now.");
  say("Only .html files are runnable — link your .css and .js from an html file and run that.");
};

/* ---------- editor ---------- */
function CodeView({ file, onChange }) {
  const gutterRef = useRef(null);
  const lines = file.code.split("\n").length;
  const onKey = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const t = e.target, s = t.selectionStart, en = t.selectionEnd;
      onChange({ ...file, code: file.code.slice(0, s) + "  " + file.code.slice(en) });
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
    }
  };
  return (
    <div style={{ display: "flex", height: "100%", background: "#15171C" }}>
      <div ref={gutterRef}
        style={{ width: 44, overflow: "hidden", padding: "14px 0", textAlign: "right", background: C.panel, borderRight: `1px solid ${C.line}`, flexShrink: 0, userSelect: "none" }}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} style={{ fontSize: 12, lineHeight: "20px", color: C.faint, fontFamily: MONO, paddingRight: 10 }}>{i + 1}</div>
        ))}
      </div>
      <textarea value={file.code}
        onChange={(e) => onChange({ ...file, code: e.target.value })}
        onKeyDown={onKey}
        onScroll={(e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; }}
        spellCheck={false} placeholder="write some code…"
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: C.text, fontSize: 12.5, lineHeight: "20px", fontFamily: MONO, padding: "14px 16px", whiteSpace: "pre", overflowWrap: "normal", overflowX: "auto" }} />
    </div>
  );
}

/* ---------- browser-chrome preview (rendered for pv: tabs) ---------- */
export function PreviewView({ files, fileId }) {
  const [gen, setGen] = useState(0);
  const f = files[fileId];
  if (!f) return null;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#E8564A", "#F2D06B", "#A8D8B0"].map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.85 }} />
          ))}
        </div>
        <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 16, padding: "5px 14px", fontSize: 11.5, color: C.dim, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          devboard://preview/{f.name}
        </div>
        <button onClick={() => setGen((g) => g + 1)} title="Reload"
          style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex", padding: 5 }}>
          <Icn d={I.reload} size={14} />
        </button>
      </div>
      <iframe key={gen} title={`preview-${fileId}`} srcDoc={buildSrcdoc(files, fileId)} sandbox="allow-scripts"
        style={{ flex: 1, border: "none", width: "100%", background: "#fff" }} />
    </div>
  );
}

/* ---------- Run button, injected into the file header by the core ---------- */
function RunButton({ file, ctx }) {
  const ext = fileExt(file.name);
  const runnable = RUNNABLE.includes(ext);
  return (
    <button onClick={() => runFile(ctx.files, ctx.activeId, ctx.openFile, ctx.say)}
      style={{ display: "flex", alignItems: "center", gap: 6, background: runnable ? "#A8D8B0" : C.panel2, color: runnable ? C.ink : C.faint, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: SANS, flexShrink: 0 }}>
      <Icn d={I.play} size={10} stroke={2.2} /> Run
    </button>
  );
}

registerView("code", {
  label: "code",
  icon: I.code,
  color: "#C9B0E8",
  zoomable: false,
  canvas: false,
  fixed: true,
  newName: "untitled.html",
  create: () => ({ settings: {}, code: "" }),
  Component: CodeView,
  headerAction: RunButton,
});
