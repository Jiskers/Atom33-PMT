import { useRef, useState } from "react";
import { registerView } from "../core/registry.js";
import { I, Icn } from "../core/icons.jsx";
import { C, STICKY, MONO, SANS, uid } from "../core/theme.js";

const TAGS = ["design", "code", "art", "ui", "audio"];
const tagColor = (tag) => STICKY[Math.max(0, TAGS.indexOf(tag)) % 4];

/* ---------- Trello-style card detail: description, checklist, images ---------- */
function CardDetail({ file, onChange, colIdx, cardId, onClose }) {
  const [draftItem, setDraftItem] = useState("");
  const [draftImg, setDraftImg] = useState("");
  const col = file.columns[colIdx];
  const card = col?.cards.find((k) => k.id === cardId);
  if (!card) return null;

  const patch = (p) => onChange({
    ...file,
    columns: file.columns.map((c, i) => (i !== colIdx ? c : { ...c, cards: c.cards.map((k) => (k.id === cardId ? { ...k, ...p } : k)) })),
  });
  const checklist = card.checklist ?? [];
  const images = card.images ?? [];
  const labelStyle = { fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint, fontFamily: MONO, margin: "16px 0 6px" };
  const draftInputStyle = { width: "100%", background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 6, color: C.text, fontSize: 12, padding: "7px 9px", outline: "none", boxSizing: "border-box" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 120 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(560px, 92vw)", maxHeight: "85vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 20, boxShadow: "0 24px 60px rgba(0,0,0,.6)", zIndex: 121, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <input value={card.t} onChange={(e) => patch({ t: e.target.value })}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 16, fontWeight: 700, fontFamily: SANS, minWidth: 0 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 }}>
            <Icn d={I.x} size={14} stroke={2} />
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: C.faint, fontFamily: MONO, marginTop: 2 }}>in {col.name}</div>

        <div style={labelStyle}>Description</div>
        <textarea value={card.desc ?? ""} onChange={(e) => patch({ desc: e.target.value })}
          placeholder="Add a description…"
          style={{ width: "100%", minHeight: 80, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, color: C.text, fontSize: 12.5, padding: 10, outline: "none", resize: "vertical", fontFamily: SANS, boxSizing: "border-box" }} />

        <div style={labelStyle}>Checklist{checklist.length > 0 && ` (${checklist.filter((i) => i.done).length}/${checklist.length})`}</div>
        {checklist.map((it) => (
          <label key={it.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "5px 2px", cursor: "pointer", opacity: it.done ? 0.5 : 1, textDecoration: it.done ? "line-through" : "none" }}>
            <input type="checkbox" checked={it.done}
              onChange={() => patch({ checklist: checklist.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)) })}
              style={{ accentColor: "#A8D8B0", width: 14, height: 14, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{it.text}</span>
            <button onClick={() => patch({ checklist: checklist.filter((x) => x.id !== it.id) })}
              style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: 2, flexShrink: 0 }}>
              <Icn d={I.x} size={8} stroke={2.2} />
            </button>
          </label>
        ))}
        <input value={draftItem} onChange={(e) => setDraftItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && draftItem.trim()) { patch({ checklist: [...checklist, { id: uid("i"), text: draftItem.trim(), done: false }] }); setDraftItem(""); } }}
          placeholder="+ add item" style={{ ...draftInputStyle, marginTop: 4 }} />

        <div style={labelStyle}>Images</div>
        {images.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={url} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.line}`, display: "block" }} />
                <button onClick={() => patch({ images: images.filter((_, j) => j !== i) })}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.panel, border: `1px solid ${C.line}`, color: C.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <Icn d={I.x} size={8} stroke={2.2} />
                </button>
              </div>
            ))}
          </div>
        )}
        <input value={draftImg} onChange={(e) => setDraftImg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && draftImg.trim()) { patch({ images: [...images, draftImg.trim()] }); setDraftImg(""); } }}
          placeholder="paste an image URL, press Enter" style={draftInputStyle} />
      </div>
    </>
  );
}

function KanbanView({ file, onChange, ctx }) {
  const { isMobile } = ctx;
  const dragCard = useRef(null);
  const dragCol = useRef(null);
  const [drafts, setDrafts] = useState({});
  const [renamingCol, setRenamingCol] = useState(null);
  const [openCard, setOpenCard] = useState(null); // { ci, id } | null
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
    const n = cols.map((c, i) => (i === ci ? { ...c, cards: [...c.cards, { id: uid("k"), t, tag: "design", desc: "", checklist: [], images: [] }] } : c));
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

  const addColumn = () => {
    const id = uid("c");
    onChange({ ...file, columns: [...cols, { id, name: "New column", cards: [] }] });
    setRenamingCol(id);
  };
  const removeColumn = (ci) => {
    const col = cols[ci];
    if (col.cards.length && !window.confirm(`Delete "${col.name}" and its ${col.cards.length} card${col.cards.length === 1 ? "" : "s"}?`)) return;
    onChange({ ...file, columns: cols.filter((_, i) => i !== ci) });
  };
  const commitRenameCol = (id, name) => {
    setRenamingCol(null);
    if (!name.trim()) return;
    onChange({ ...file, columns: cols.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) });
  };
  const moveColumn = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= cols.length) return;
    const n = [...cols];
    const [moved] = n.splice(fromIdx, 1);
    n.splice(toIdx, 0, moved);
    onChange({ ...file, columns: n });
  };

  return (
    <div style={{ display: "flex", gap: 14, padding: isMobile ? 12 : 20, alignItems: "flex-start", minHeight: "100%" }}>
      {cols.map((col, ci) => (
        <div key={col.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { const d = dragCard.current; if (d) { moveTo(d.card, ci); dragCard.current = null; } }}
          style={{ width: isMobile ? 230 : 250, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, flexShrink: 0 }}>
          <div draggable={!isMobile} onDragStart={() => (dragCol.current = ci)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.stopPropagation(); if (dragCol.current !== null) { moveColumn(dragCol.current, ci); dragCol.current = null; } }}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 4px 10px", cursor: isMobile ? "default" : "grab" }}>
            {renamingCol === col.id ? (
              <input autoFocus defaultValue={col.name} onClick={(e) => e.stopPropagation()}
                onBlur={(e) => commitRenameCol(col.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setRenamingCol(null); }}
                style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.gold}`, borderRadius: 4, color: C.text, fontSize: 12, fontWeight: 700, fontFamily: SANS, padding: "2px 4px", outline: "none" }} />
            ) : (
              <span onDoubleClick={() => setRenamingCol(col.id)}
                style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {col.name}
              </span>
            )}
            <span style={{ fontSize: 10.5, color: C.faint, fontFamily: MONO, flexShrink: 0 }}>{col.cards.length}</span>
            <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
              <button onClick={() => moveColumn(ci, ci - 1)} disabled={ci === 0} title="Move column left"
                style={{ background: "none", border: "none", color: ci === 0 ? C.line : C.dim, cursor: ci === 0 ? "default" : "pointer", display: "flex", padding: 2 }}>
                <Icn d={I.left} size={9} stroke={2} />
              </button>
              <button onClick={() => moveColumn(ci, ci + 1)} disabled={ci === cols.length - 1} title="Move column right"
                style={{ background: "none", border: "none", color: ci === cols.length - 1 ? C.line : C.dim, cursor: ci === cols.length - 1 ? "default" : "pointer", display: "flex", padding: 2 }}>
                <Icn d={I.right} size={9} stroke={2} />
              </button>
              <button onClick={() => removeColumn(ci)} title="Delete column"
                style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", display: "flex", padding: 2 }}>
                <Icn d={I.x} size={9} stroke={2.2} />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {col.cards.map((k) => (
              <div key={k.id} draggable={!isMobile}
                onDragStart={() => (dragCard.current = { card: k })}
                onClick={() => setOpenCard({ ci, id: k.id })}
                style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, padding: "9px 10px", fontSize: 12.5, cursor: isMobile ? "pointer" : "grab", position: "relative" }}>
                {k.t}
                {(k.checklist?.length > 0 || k.desc || k.images?.length > 0) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 5, fontSize: 10, color: C.faint, fontFamily: MONO }}>
                    {k.checklist?.length > 0 && <span>☑ {k.checklist.filter((i) => i.done).length}/{k.checklist.length}</span>}
                    {k.desc && <span title="Has a description">≡</span>}
                    {k.images?.length > 0 && <span>▣ {k.images.length}</span>}
                  </div>
                )}
                <div style={{ marginTop: 7, display: "flex", alignItems: "center" }}>
                  <button onClick={(e) => { e.stopPropagation(); cycleTag(k, ci); }} title="Cycle tag"
                    style={{ fontSize: 9.5, fontFamily: MONO, color: C.ink, background: tagColor(k.tag), padding: "1px 7px", borderRadius: 10, border: "none", cursor: "pointer" }}>
                    {k.tag}
                  </button>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); moveTo(k, ci - 1); }} disabled={ci === 0} title="Move left"
                      style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 5, color: ci === 0 ? C.line : C.dim, cursor: ci === 0 ? "default" : "pointer", display: "flex", padding: "3px 6px" }}>
                      <Icn d={I.left} size={9} stroke={2} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveTo(k, ci + 1); }} disabled={ci === cols.length - 1} title="Move right"
                      style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 5, color: ci === cols.length - 1 ? C.line : C.dim, cursor: ci === cols.length - 1 ? "default" : "pointer", display: "flex", padding: "3px 6px" }}>
                      <Icn d={I.right} size={9} stroke={2} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeCard(k, ci); }} title="Delete card"
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
      <button onClick={addColumn}
        style={{ width: isMobile ? 230 : 250, flexShrink: 0, background: "none", border: `1px dashed ${C.line}`, borderRadius: 8, color: C.faint, fontSize: 12.5, padding: 12, cursor: "pointer", fontFamily: SANS, textAlign: "left" }}>
        + Add column
      </button>
      {openCard && (
        <CardDetail file={file} onChange={onChange} colIdx={openCard.ci} cardId={openCard.id} onClose={() => setOpenCard(null)} />
      )}
    </div>
  );
}

registerView("core:kanban", {
  label: "kanban",
  icon: I.kanban,
  color: "#93C5E8",
  zoomable: false,
  canvas: false,
  version: 2,
  migrate: (data, fromVersion) => {
    // v1 cards had no desc/checklist/images — default them in rather than
    // leaving every render site to guess with `?? []` forever.
    if (fromVersion === 1) {
      return { ...data, columns: data.columns.map((c) => ({ ...c, cards: c.cards.map((k) => ({ desc: "", checklist: [], images: [], ...k })) })) };
    }
    return data;
  },
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
