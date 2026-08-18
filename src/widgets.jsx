/* ============================================================
   BUILT-IN HOME DASHBOARD WIDGETS
   Same idea as modules.jsx, but for the Home section's grid —
   see registerWidget's contract in core/registry.js. Widgets get
   ctx (same shape handed to views), so they can read/open project
   files instead of only holding their own self-contained data.
   ============================================================ */
import { useState } from "react";
import { registerWidget, FILE_VIEWS } from "./core/registry.js";
import { Icn, I } from "./core/icons.jsx";
import { C, MONO, SANS, uid } from "./core/theme.js";
import { collectFlaggedItems, localDateStr } from "./core/reminders.js";

/* ---------- quick jump: list of project files, click to open ---------- */
registerWidget("core:jump", {
  label: "Quick jump",
  desc: "List of project files — click to open one",
  w: 2,
  create: () => ({}),
  Body: ({ ctx }) => {
    const entries = Object.entries(ctx.files);
    return (
      <div style={{ padding: 4 }}>
        {entries.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>No files in this project yet.</div>}
        {entries.map(([id, f]) => {
          const v = FILE_VIEWS[f.view];
          if (!v) return null;
          return (
            <button key={id} onClick={() => ctx.openFile(id)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: C.text, fontSize: 12.5, padding: "7px 6px", borderRadius: 6, cursor: "pointer", fontFamily: SANS }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <span style={{ color: v.color, display: "flex", flexShrink: 0 }}><Icn d={v.icon} size={12} /></span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </button>
          );
        })}
      </div>
    );
  },
});

/* ---------- reminders: flagged board modules + kanban cards, across
   every file in the project, soonest due date first ---------- */
registerWidget("core:reminders", {
  label: "Reminders",
  desc: "Flagged modules + kanban cards, by due date",
  w: 2,
  create: () => ({}),
  Body: ({ ctx }) => {
    const items = collectFlaggedItems(ctx.files);
    items.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    });
    const today = localDateStr();
    return (
      <div style={{ padding: 4 }}>
        {items.length === 0 && (
          <div style={{ fontSize: 12, color: C.faint }}>Nothing flagged yet — flag a module or kanban card ("Remind me on Home") to see it here.</div>
        )}
        {items.map((it) => {
          const overdue = it.due && it.due < today;
          return (
            <button key={it.id} onClick={() => ctx.openFile(it.fileId)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: C.text, fontSize: 12.5, padding: "7px 6px", borderRadius: 6, cursor: "pointer", fontFamily: SANS }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <span style={{ color: "#E8564A", display: "flex", flexShrink: 0 }}><Icn d={I.flag} size={11} /></span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ fontSize: 9.5, color: C.faint, fontFamily: MONO, flexShrink: 0, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.fileName}</span>
              <span style={{ fontSize: 10.5, color: overdue ? "#E8564A" : C.faint, fontFamily: MONO, flexShrink: 0 }}>{it.due || "—"}</span>
            </button>
          );
        })}
      </div>
    );
  },
});

/* ---------- dash note: a freeform sticky note, sized for the grid ---------- */
registerWidget("core:note", {
  label: "Note",
  desc: "Freeform sticky note for the dashboard",
  w: 1,
  create: () => ({ text: "" }),
  Body: ({ m, onData }) => (
    <textarea value={m.data.text} onChange={(e) => onData({ text: e.target.value })}
      placeholder="Jot something down…"
      style={{ width: "100%", height: 96, background: "transparent", border: "none", outline: "none", resize: "none", color: C.text, fontSize: 12.5, fontFamily: SANS, lineHeight: 1.5 }} />
  ),
});

/* ---------- pinned files: hand-picked project files, optionally
   grouped into freeform folders (a name you type, not a tree) ---------- */
function PinnedFilesBody({ m, onData, ctx }) {
  const [fileId, setFileId] = useState("");
  const [folder, setFolder] = useState("");
  const pins = m.data.pins ?? [];
  const entries = Object.entries(ctx.files);

  const addPin = () => {
    if (!fileId) return;
    onData({ pins: [...pins, { id: uid("p"), fileId, folder: folder.trim() }] });
    setFileId("");
    setFolder("");
  };
  const removePin = (id) => onData({ pins: pins.filter((p) => p.id !== id) });

  const groups = {};
  for (const p of pins) (groups[p.folder || ""] ??= []).push(p);
  const folderNames = Object.keys(groups).filter((k) => k).sort();

  const renderPin = (p) => {
    const f = ctx.files[p.fileId];
    if (!f) return null; // file was deleted since pinning
    const v = FILE_VIEWS[f.view];
    return (
      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => ctx.openFile(p.fileId)}
          style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0, background: "none", border: "none", color: C.text, fontSize: 12, padding: "5px 6px", borderRadius: 5, cursor: "pointer", textAlign: "left" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
          {v && <span style={{ color: v.color, display: "flex", flexShrink: 0 }}><Icn d={v.icon} size={11} /></span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
        </button>
        <button onClick={() => removePin(p.id)} title="Unpin"
          style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 }}>
          <Icn d={I.x} size={9} stroke={2.2} />
        </button>
      </div>
    );
  };

  return (
    <div>
      {pins.length === 0 && <div style={{ fontSize: 12, color: C.faint, marginBottom: 6 }}>Pin project files here — optionally grouped into folders you name below.</div>}
      {(groups[""] ?? []).map(renderPin)}
      {folderNames.map((fname) => (
        <div key={fname} style={{ marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint, fontFamily: MONO, padding: "4px 6px" }}>
            <Icn d={I.folder} size={10} /> {fname}
          </div>
          {groups[fname].map(renderPin)}
        </div>
      ))}
      <div style={{ display: "flex", gap: 5, marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
        <select value={fileId} onChange={(e) => setFileId(e.target.value)}
          style={{ flex: 1, minWidth: 0, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontSize: 11, borderRadius: 5, padding: "5px 6px" }}>
          <option value="">pick a file…</option>
          {entries.map(([id, f]) => <option key={id} value={id}>{f.name}</option>)}
        </select>
        <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="folder"
          style={{ width: 80, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontSize: 11, borderRadius: 5, padding: "5px 6px" }} />
        <button onClick={addPin} disabled={!fileId}
          style={{ background: fileId ? C.gold : C.panel2, color: fileId ? C.ink : C.faint, border: "none", borderRadius: 5, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: fileId ? "pointer" : "default", flexShrink: 0 }}>
          + pin
        </button>
      </div>
    </div>
  );
}
registerWidget("core:pinned", {
  label: "Pinned files",
  desc: "Hand-pick files, group them into folders you name",
  w: 2,
  create: () => ({ pins: [] }),
  Body: PinnedFilesBody,
});
