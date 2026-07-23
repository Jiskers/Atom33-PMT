/* ============================================================
   Shared "flagged items" scan — pulled out of the Reminders widget
   so the Calendar section can plot the same data without duplicating
   the walk over every file's modules/kanban cards. Not a plugin
   contract, just a helper both consume.
   ============================================================ */
import { MODULE_TYPES } from "./registry.js";

function moduleLabel(m) {
  const d = m.data || {};
  return d.title || d.name || d.caption || (d.text && d.text.slice(0, 40)) || MODULE_TYPES[m.type]?.label || "Untitled";
}

// Local calendar date as YYYY-MM-DD — NOT toISOString().slice(0,10), which
// is UTC and can land on the wrong day depending on the browser's timezone,
// disagreeing with the local Y/M/D <input type="date"> and grid cells use.
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function collectFlaggedItems(files) {
  const items = [];
  for (const [fid, f] of Object.entries(files)) {
    for (const m of f.modules ?? []) {
      if (m.flag) items.push({ id: m.id, fileId: fid, fileName: f.name, label: moduleLabel(m), due: m.due || "" });
    }
    for (const col of f.columns ?? []) {
      for (const card of col.cards ?? []) {
        if (card.flag) items.push({ id: card.id, fileId: fid, fileName: f.name, label: card.t, due: card.due || "" });
      }
    }
  }
  return items;
}
