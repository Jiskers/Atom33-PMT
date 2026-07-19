import { useRef, useState } from "react";
import { registerView } from "../core/registry.js";
import { I, Icn } from "../core/icons.jsx";
import { C, STICKY, MONO, uid } from "../core/theme.js";

const TAGS = ["design", "code", "art", "ui", "audio"];
const tagColor = (tag) => STICKY[Math.max(0, TAGS.indexOf(tag)) % 4];

function KanbanView({ file, onChange, ctx }) {
  const { isMobile } = ctx;
  const dragCard = useRef(null);
  const [drafts, setDrafts] = useState({});
  const cols = file.columns;

  const moveTo = (card, toIdx) => {
    if (toIdx < 0 || toIdx >= cols.length) return;
    const n = cols.map((c) => ({ ...c, cards: c.cards.filter((k) => k.id !== card.id) }));
    n[toIdx].cards.push(card);
    onChange({ ...file, columns: n });
  };
  const addCard = (ci) => {
    const t = (drafts[ci] ?? "").trim();
    if (!t) return;
    const n = cols.map((c, i) => (i === ci ? { ...c, cards: [...c.cards, { id: uid("k"), t, tag: "design" }] } : c));
    onChange({ ...file, columns: n });
    setDrafts((d) => ({ ...d, [ci]: "" }));
  };
  const cycleTag = (card, ci) => {
    const next = TAGS[(TAGS.indexOf(card.tag) + 1) % TAGS.length];
    const n = cols.map((c, i) => (i === ci ? { ...c, cards: c.cards.map((k) => (k.id === card.id ? { ...k, tag: next } : k)) } : c));
    onChange({ ...file, columns: n });
  };
  const removeCard = (card, ci) => {
    const n = cols.map((c, i) => (i === ci ? { ...c, cards: c.cards.filter((k) => k.id !== card.id) } : c));
    onChange({ ...file, columns: n });
  };

  return (
    <div style={{ display: "flex", gap: 14, padding: isMobile ? 12 : 20, alignItems: "flex-start", minHeight: "100%" }}>
      {cols.map((col, ci) => (
        <div key={col.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { const d = dragCard.current; if (d) { moveTo(d.card, ci); dragCard.current = null; } }}
          style={{ width: isMobile ? 230 : 250, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "2px 4px 10px" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{col.name}</span>
            <span style={{ fontSize: 10.5, color: C.faint, fontFamily: MONO }}>{col.cards.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {col.cards.map((k) => (
              <div key={k.id} draggable={!isMobile}
                onDragStart={() => (dragCard.current = { card: k })}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "9px 10px", fontSize: 12.5, cursor: isMobile ? "default" : "grab", position: "relative" }}>
                {k.t}
                <div style={{ marginTop: 7, display: "flex", alignItems: "center" }}>
                  <button onClick={() => cycleTag(k, ci)} title="Cycle tag"
                    style={{ fontSize: 9.5, fontFamily: MONO, color: C.ink, background: tagColor(k.tag), padding: "1px 7px", borderRadius: 10, border: "none", cursor: "pointer" }}>
                    {k.tag}
                  </button>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button onClick={() => moveTo(k, ci - 1)} disabled={ci === 0} title="Move left"
                      style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 5, color: ci === 0 ? C.line : C.dim, cursor: ci === 0 ? "default" : "pointer", display: "flex", padding: "3px 6px" }}>
                      <Icn d={I.left} size={9} stroke={2} />
                    </button>
                    <button onClick={() => moveTo(k, ci + 1)} disabled={ci === cols.length - 1} title="Move right"
                      style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 5, color: ci === cols.length - 1 ? C.line : C.dim, cursor: ci === cols.length - 1 ? "default" : "pointer", display: "flex", padding: "3px 6px" }}>
                      <Icn d={I.right} size={9} stroke={2} />
                    </button>
                    <button onClick={() => removeCard(k, ci)} title="Delete card"
                      style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: "3px 2px" }}>
                      <Icn d={I.x} size={8} stroke={2.2} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <input
              value={drafts[ci] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [ci]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addCard(ci)}
              placeholder="+ add card"
              style={{ background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 6, color: C.text, fontSize: 12, padding: "8px 10px", outline: "none" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

registerView("core:kanban", {
  label: "kanban",
  icon: I.kanban,
  color: "#93C5E8",
  zoomable: false,
  canvas: false,
  version: 1,
  create: () => ({
    settings: {},
    columns: [
      { id: uid("c"), name: "Backlog", cards: [] },
      { id: uid("c"), name: "In progress", cards: [] },
      { id: uid("c"), name: "Done", cards: [] },
    ],
  }),
  Component: KanbanView,
});
