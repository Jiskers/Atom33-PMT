/* ============================================================
   BUILT-IN HOME DASHBOARD WIDGETS
   Same idea as modules.jsx, but for the Home section's grid —
   see registerWidget's contract in core/registry.js. Widgets get
   ctx (same shape handed to views), so they can read/open project
   files instead of only holding their own self-contained data.
   ============================================================ */
import { registerWidget, FILE_VIEWS, MODULE_TYPES } from "./core/registry.js";
import { Icn, I } from "./core/icons.jsx";
import { C, MONO, SANS } from "./core/theme.js";

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
function moduleLabel(m) {
  const d = m.data || {};
  return d.title || d.name || d.caption || (d.text && d.text.slice(0, 40)) || MODULE_TYPES[m.type]?.label || "Untitled";
}
registerWidget("core:reminders", {
  label: "Reminders",
  desc: "Flagged modules + kanban cards, by due date",
  w: 2,
  create: () => ({}),
  Body: ({ ctx }) => {
    const items = [];
    for (const [fid, f] of Object.entries(ctx.files)) {
      for (const m of f.modules ?? []) {
        if (m.flag) items.push({ id: m.id, fileId: fid, fileName: f.name, label: moduleLabel(m), due: m.due || "" });
      }
      for (const col of f.columns ?? []) {
        for (const card of col.cards ?? []) {
          if (card.flag) items.push({ id: card.id, fileId: fid, fileName: f.name, label: card.t, due: card.due || "" });
        }
      }
    }
    items.sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    });
    const today = new Date().toISOString().slice(0, 10);
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
