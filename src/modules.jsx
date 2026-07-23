/* ============================================================
   BUILT-IN MODULES
   Each module below is written exactly the way a community
   plugin would be: import registerModule, define Body and
   (optionally) Settings, register. Nothing here is special-
   cased by the core.
   ============================================================ */
import { useState } from "react";
import { registerModule } from "./core/registry.js";
import { C, STICKY, STATUS, STATUS_COLOR, MONO, SANS, HAND, uid } from "./core/theme.js";

const sLabel = { fontSize: 11, color: C.dim, marginBottom: 6 };

/* ---------- sticky note ---------- */
registerModule("core:note", {
  label: "Sticky note",
  desc: "Quick thought, pinned to the board",
  w: 200,
  version: 1,
  create: () => ({ text: "" }),
  Body: ({ m, onData }) => (
    <div style={{ background: STICKY[m.tint ?? 0], padding: "14px 12px 16px", minHeight: 120 }}>
      <textarea
        data-nodrag value={m.data.text}
        onChange={(e) => onData({ text: e.target.value })}
        placeholder="jot it down…"
        style={{ width: "100%", height: 96, background: "transparent", border: "none", outline: "none", resize: "none", color: C.ink, fontFamily: HAND, fontSize: 19, lineHeight: 1.25 }}
      />
    </div>
  ),
  Settings: ({ m, onPatch }) => (
    <div>
      <div style={sLabel}>Paper color</div>
      <div style={{ display: "flex", gap: 7 }}>
        {STICKY.map((c, i) => (
          <button key={i} onClick={() => onPatch({ tint: i })}
            style={{ width: 28, height: 24, borderRadius: 4, background: c, cursor: "pointer", border: (m.tint ?? 0) === i ? "2px solid #E9E6DC" : "1px solid rgba(0,0,0,.3)" }} />
        ))}
      </div>
    </div>
  ),
});

/* ---------- checklist ---------- */
function ChecklistBody({ m, onData }) {
  const [draft, setDraft] = useState("");
  const items = m.data.items;
  return (
    <div style={{ background: C.paper, padding: "12px 12px 10px", color: C.ink }}>
      <input data-nodrag value={m.data.title} onChange={(e) => onData({ title: e.target.value })}
        style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: C.ink, fontWeight: 700, fontSize: 13, fontFamily: SANS, marginBottom: 8 }} />
      {items.map((it, i) => (m.data.hideDone && it.done ? null : (
        <label key={i} data-nodrag
          style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12.5, padding: "4px 0", cursor: "pointer", opacity: it.done ? 0.5 : 1, textDecoration: it.done ? "line-through" : "none" }}>
          <input type="checkbox" checked={it.done}
            onChange={() => onData({ items: items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
            style={{ marginTop: 2, accentColor: "#2E6E6A", width: 15, height: 15 }} />
          {it.t}
        </label>
      )))}
      <input data-nodrag value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            onData({ items: [...items, { t: draft.trim(), done: false }] });
            setDraft("");
          }
        }}
        placeholder="+ add item"
        style={{ width: "100%", background: "transparent", border: "none", borderTop: `1px dashed ${C.ink}33`, outline: "none", color: C.ink, fontSize: 12, padding: "6px 0 2px", marginTop: 6 }} />
    </div>
  );
}
registerModule("core:checklist", {
  label: "Checklist",
  desc: "Small task list with checkboxes",
  w: 230,
  version: 1,
  create: () => ({ title: "New checklist", items: [], hideDone: false }),
  Body: ChecklistBody,
  Settings: ({ m, onData }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: C.text }}>
      <input type="checkbox" checked={!!m.data.hideDone}
        onChange={() => onData({ hideDone: !m.data.hideDone })}
        style={{ accentColor: C.gold }} />
      Hide completed items
    </label>
  ),
});

/* ---------- mechanic card ---------- */
registerModule("core:mechanic", {
  label: "Mechanic card",
  desc: "Game mechanic: idea → prototype → fun",
  w: 240,
  version: 1,
  create: () => ({ name: "New mechanic", hook: "", status: 0 }),
  Body: ({ m, onData }) => {
    const s = m.data.status;
    return (
      <div style={{ background: C.paper, padding: 12, color: C.ink }}>
        <div style={{ fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: "#8A7F6B", fontFamily: MONO, marginBottom: 5 }}>mechanic</div>
        <input data-nodrag value={m.data.name} onChange={(e) => onData({ name: e.target.value })}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontWeight: 700, fontSize: 14, fontFamily: SANS, color: C.ink }} />
        <textarea data-nodrag value={m.data.hook} onChange={(e) => onData({ hook: e.target.value })}
          placeholder="what's the hook?"
          style={{ width: "100%", height: 52, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 12, lineHeight: 1.4, color: "#4A4438", marginTop: 4 }} />
        <button data-nodrag onClick={() => onData({ status: (s + 1) % STATUS.length })}
          style={{ border: "none", cursor: "pointer", background: STATUS_COLOR[s], color: C.ink, fontSize: 10.5, fontWeight: 600, padding: "4px 12px", borderRadius: 20, fontFamily: MONO }}>
          {STATUS[s]}
        </button>
      </div>
    );
  },
  Settings: ({ m, onData }) => (
    <div>
      <div style={sLabel}>Status</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {STATUS.map((s, i) => (
          <button key={s} onClick={() => onData({ status: i })}
            style={{ border: "none", cursor: "pointer", background: m.data.status === i ? STATUS_COLOR[i] : C.panel2, color: m.data.status === i ? C.ink : C.dim, fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20, fontFamily: MONO }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  ),
});

/* ---------- reference pin ---------- */
registerModule("core:ref", {
  label: "Reference pin",
  desc: "Palette / mood / image placeholder",
  w: 200,
  version: 1,
  create: () => ({ caption: "reference", colors: ["#B34233", "#2E6E6A", "#E8C87A"] }),
  Body: ({ m, onData }) => (
    <div style={{ background: "#23262E", padding: 8 }}>
      <div style={{ display: "flex", height: 84, borderRadius: 2, overflow: "hidden" }}>
        {m.data.colors.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
      </div>
      <input data-nodrag value={m.data.caption} onChange={(e) => onData({ caption: e.target.value })}
        style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: C.dim, fontSize: 11.5, fontFamily: MONO, marginTop: 7, textAlign: "center" }} />
    </div>
  ),
  Settings: ({ m, onData }) => (
    <div>
      <div style={sLabel}>Swatch colors</div>
      <div style={{ display: "flex", gap: 7 }}>
        {m.data.colors.map((c, i) => (
          <input key={i} type="color" value={c} data-nodrag
            onChange={(e) => onData({ colors: m.data.colors.map((x, j) => (j === i ? e.target.value : x)) })}
            style={{ width: 34, height: 28, border: `1px solid ${C.line}`, borderRadius: 4, background: "none", padding: 1, cursor: "pointer" }} />
        ))}
      </div>
    </div>
  ),
});

/* ---------- game-dev module pack ---------- */

/* GDD outline: a running list of design-doc sections, each with a
   heading and free-form notes — sketch a doc's structure in place. */
function GddBody({ m, onData }) {
  const [draft, setDraft] = useState("");
  const sections = m.data.sections;
  return (
    <div style={{ background: C.paper, padding: "12px 12px 10px", color: C.ink }}>
      <input data-nodrag value={m.data.title} onChange={(e) => onData({ title: e.target.value })}
        style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: C.ink, fontWeight: 700, fontSize: 13, fontFamily: SANS, marginBottom: 8 }} />
      {sections.map((s, i) => (
        <div key={s.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < sections.length - 1 ? `1px dashed ${C.ink}22` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input data-nodrag value={s.heading}
              onChange={(e) => onData({ sections: sections.map((x) => (x.id === s.id ? { ...x, heading: e.target.value } : x)) })}
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.ink, fontWeight: 600, fontSize: 12, fontFamily: SANS }} />
            <button data-nodrag onClick={() => onData({ sections: sections.filter((x) => x.id !== s.id) })}
              style={{ background: "none", border: "none", color: "#8A7F6B", cursor: "pointer", fontSize: 12, padding: "0 2px", flexShrink: 0 }}>×</button>
          </div>
          <textarea data-nodrag value={s.notes}
            onChange={(e) => onData({ sections: sections.map((x) => (x.id === s.id ? { ...x, notes: e.target.value } : x)) })}
            placeholder="notes…"
            style={{ width: "100%", height: 40, background: "transparent", border: "none", outline: "none", resize: "none", color: "#4A4438", fontSize: 11.5, fontFamily: SANS, marginTop: 2 }} />
        </div>
      ))}
      <input data-nodrag value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            onData({ sections: [...sections, { id: uid("s"), heading: draft.trim(), notes: "" }] });
            setDraft("");
          }
        }}
        placeholder="+ add section"
        style={{ width: "100%", background: "transparent", border: "none", borderTop: `1px dashed ${C.ink}33`, outline: "none", color: C.ink, fontSize: 12, padding: "6px 0 2px", marginTop: 2 }} />
    </div>
  );
}
registerModule("core:gdd", {
  label: "GDD outline",
  desc: "Design doc sections: heading + notes",
  w: 260,
  version: 1,
  create: () => ({ title: "Game Design Doc", sections: [] }),
  Body: GddBody,
});

/* Asset pipeline tracker: name + stage per row, cycling like the
   mechanic card's status pill but one row per asset. */
const ASSET_STAGES = ["concept", "wip", "final", "in-engine"];
const ASSET_STAGE_COLOR = ["#93C5E8", "#F2D06B", "#A8D8B0", "#C9B0E8"];
function AssetBody({ m, onData }) {
  const [draft, setDraft] = useState("");
  const assets = m.data.assets;
  return (
    <div style={{ background: C.paper, padding: "12px 12px 10px", color: C.ink }}>
      <input data-nodrag value={m.data.title} onChange={(e) => onData({ title: e.target.value })}
        style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: C.ink, fontWeight: 700, fontSize: 13, fontFamily: SANS, marginBottom: 8 }} />
      {assets.map((a) => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
          <input data-nodrag value={a.name}
            onChange={(e) => onData({ assets: assets.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)) })}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.ink, fontSize: 12, fontFamily: SANS }} />
          <button data-nodrag onClick={() => onData({ assets: assets.map((x) => (x.id === a.id ? { ...x, stage: (x.stage + 1) % ASSET_STAGES.length } : x)) })}
            title="Cycle stage"
            style={{ border: "none", cursor: "pointer", background: ASSET_STAGE_COLOR[a.stage], color: C.ink, fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 12, fontFamily: MONO, flexShrink: 0 }}>
            {ASSET_STAGES[a.stage]}
          </button>
          <button data-nodrag onClick={() => onData({ assets: assets.filter((x) => x.id !== a.id) })}
            style={{ background: "none", border: "none", color: "#8A7F6B", cursor: "pointer", fontSize: 12, padding: "0 2px", flexShrink: 0 }}>×</button>
        </div>
      ))}
      <input data-nodrag value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            onData({ assets: [...assets, { id: uid("a"), name: draft.trim(), stage: 0 }] });
            setDraft("");
          }
        }}
        placeholder="+ add asset"
        style={{ width: "100%", background: "transparent", border: "none", borderTop: `1px dashed ${C.ink}33`, outline: "none", color: C.ink, fontSize: 12, padding: "6px 0 2px", marginTop: 6 }} />
    </div>
  );
}
registerModule("core:assets", {
  label: "Asset pipeline",
  desc: "Track assets through concept → in-engine",
  w: 250,
  version: 1,
  create: () => ({ title: "Asset pipeline", assets: [] }),
  Body: AssetBody,
});

/* Bug board: one bug per card, same shape registry.js's own docs use
   as the example community-plugin module. */
const SEVERITY = ["low", "medium", "high", "critical"];
const SEVERITY_COLOR = ["#A8D8B0", "#F2D06B", "#E8956B", "#E8564A"];
registerModule("core:bug", {
  label: "Bug report",
  desc: "Repro steps, severity, open/fixed",
  w: 240,
  version: 1,
  create: () => ({ title: "New bug", repro: "", severity: 0, fixed: false }),
  Body: ({ m, onData }) => (
    <div style={{ background: C.paper, padding: 12, color: C.ink, opacity: m.data.fixed ? 0.6 : 1 }}>
      <div style={{ fontSize: 9.5, letterSpacing: 1.4, textTransform: "uppercase", color: "#8A7F6B", fontFamily: MONO, marginBottom: 5 }}>bug</div>
      <input data-nodrag value={m.data.title} onChange={(e) => onData({ title: e.target.value })}
        style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontWeight: 700, fontSize: 14, fontFamily: SANS, color: C.ink, textDecoration: m.data.fixed ? "line-through" : "none" }} />
      <textarea data-nodrag value={m.data.repro} onChange={(e) => onData({ repro: e.target.value })}
        placeholder="repro steps…"
        style={{ width: "100%", height: 52, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 12, lineHeight: 1.4, color: "#4A4438", marginTop: 4 }} />
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button data-nodrag onClick={() => onData({ severity: (m.data.severity + 1) % SEVERITY.length })}
          style={{ border: "none", cursor: "pointer", background: SEVERITY_COLOR[m.data.severity], color: C.ink, fontSize: 10.5, fontWeight: 600, padding: "4px 12px", borderRadius: 20, fontFamily: MONO }}>
          {SEVERITY[m.data.severity]}
        </button>
        <button data-nodrag onClick={() => onData({ fixed: !m.data.fixed })}
          style={{ border: `1px solid ${C.ink}44`, cursor: "pointer", background: m.data.fixed ? "#A8D8B0" : "none", color: C.ink, fontSize: 10.5, fontWeight: 600, padding: "4px 12px", borderRadius: 20, fontFamily: MONO }}>
          {m.data.fixed ? "fixed" : "open"}
        </button>
      </div>
    </div>
  ),
  Settings: ({ m, onData }) => (
    <div>
      <div style={sLabel}>Severity</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {SEVERITY.map((s, i) => (
          <button key={s} onClick={() => onData({ severity: i })}
            style={{ border: "none", cursor: "pointer", background: m.data.severity === i ? SEVERITY_COLOR[i] : C.panel2, color: m.data.severity === i ? C.ink : C.dim, fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 20, fontFamily: MONO }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  ),
});

/* Playtest log: dated running notes from playtest sessions. */
function PlaytestBody({ m, onData }) {
  const [draft, setDraft] = useState("");
  const entries = m.data.entries;
  return (
    <div style={{ background: C.paper, padding: "12px 12px 10px", color: C.ink }}>
      <input data-nodrag value={m.data.title} onChange={(e) => onData({ title: e.target.value })}
        style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: C.ink, fontWeight: 700, fontSize: 13, fontFamily: SANS, marginBottom: 8 }} />
      <div style={{ maxHeight: 140, overflowY: "auto" }}>
        {entries.map((entry) => (
          <div key={entry.id} style={{ padding: "5px 0", borderBottom: `1px dashed ${C.ink}22` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 9.5, color: "#8A7F6B", fontFamily: MONO }}>{entry.date}</span>
              <button data-nodrag onClick={() => onData({ entries: entries.filter((x) => x.id !== entry.id) })}
                style={{ background: "none", border: "none", color: "#8A7F6B", cursor: "pointer", fontSize: 11, padding: "0 2px" }}>×</button>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>{entry.text}</div>
          </div>
        ))}
      </div>
      <input data-nodrag value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            onData({ entries: [...entries, { id: uid("p"), date: new Date().toLocaleDateString(), text: draft.trim() }] });
            setDraft("");
          }
        }}
        placeholder="+ log a note"
        style={{ width: "100%", background: "transparent", border: "none", borderTop: `1px dashed ${C.ink}33`, outline: "none", color: C.ink, fontSize: 12, padding: "6px 0 2px", marginTop: 6 }} />
    </div>
  );
}
registerModule("core:playtest", {
  label: "Playtest log",
  desc: "Dated notes from playtest sessions",
  w: 250,
  version: 1,
  create: () => ({ title: "Playtest log", entries: [] }),
  Body: PlaytestBody,
});
