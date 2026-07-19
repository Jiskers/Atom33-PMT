/* First-launch example project. Deleted state persists;
   Help → Reset project restores this. */

export const seedFiles = {
  f_ideas: {
    name: "quest ideas", view: "core:board",
    settings: { grid: true, tone: "cork", zoom: 1 },
    modules: [
      { id: "m1", type: "core:note", x: 90, y: 70, rot: -1.6, tint: 0, data: { text: "what if reloading costs HP? risk economy everywhere" } },
      { id: "m2", type: "core:mechanic", x: 360, y: 120, rot: 1.1, data: { name: "Dust storms", hook: "Storm rolls in every 8 min — visibility drops, loot doubles.", status: 1 } },
      { id: "m3", type: "core:checklist", x: 680, y: 80, rot: -0.8, data: { title: "vertical slice must-haves", hideDone: false, items: [
        { t: "one full quest chain", done: true },
        { t: "storm cycle working", done: false },
        { t: "save / load", done: false },
      ] } },
      { id: "m4", type: "core:ref", x: 140, y: 330, rot: 1.8, data: { caption: "mood: rust & teal", colors: ["#B34233", "#2E6E6A", "#E8C87A"] } },
      { id: "m5", type: "core:note", x: 420, y: 380, rot: 0.9, tint: 1, data: { text: "playtest note: tutorial is 4 min too long. cut the lore dump." } },
    ],
  },
  f_sprint: {
    name: "sprint 3", view: "core:kanban", settings: {},
    columns: [
      { id: "c1", name: "Backlog", cards: [
        { id: "k1", t: "Storm particle pass", tag: "art" },
        { id: "k2", t: "Vendor barter UI", tag: "ui" },
        { id: "k3", t: "Footstep audio set", tag: "audio" },
      ] },
      { id: "c2", name: "In progress", cards: [
        { id: "k4", t: "Quest chain: The Dry Well", tag: "design" },
        { id: "k5", t: "Save system rewrite", tag: "code" },
      ] },
      { id: "c3", name: "Done", cards: [{ id: "k6", t: "Dust storm timer loop", tag: "code" }] },
    ],
  },
  f_budget: {
    name: "scope budget", view: "core:sheet", settings: {},
    cells: {
      A1: "Task", B1: "Hours", C1: "Rate", D1: "Cost",
      A2: "Storm VFX", B2: "12", C2: "25", D2: "=B2*C2",
      A3: "Quest scripting", B3: "30", C3: "25", D3: "=B3*C3",
      A4: "Tileset pass", B4: "18", C4: "20", D4: "=B4*C4",
      A5: "SFX pack", B5: "6", C5: "15", D5: "=B5*C5",
      C6: "Total", D6: "=SUM(D2:D5)",
    },
  },
  f_sketch: {
    name: "level sketch", view: "core:draw",
    settings: { tone: "ink", grid: true, zoom: 1 },
    strokes: [
      { color: "#E9E6DC", size: 5, points: [[120, 200], [180, 160], [260, 150], [340, 180], [400, 240], [430, 320], [400, 400], [320, 440], [220, 430], [150, 370], [120, 280], [120, 200]] },
      { color: "#EDA6AD", size: 3, points: [[250, 280], [270, 300], [300, 290]] },
      { color: "#93C5E8", size: 3, points: [[460, 250], [560, 250], [545, 238]] },
    ],
  },
  f_html: {
    name: "index.html", view: "core:code", settings: {},
    code: `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Dustfall devlog</h1>
  <p>Week 12 — the storm system finally works.
     Visibility drops, loot doubles, players panic.
     Exactly as designed.</p>
  <button onclick="document.body.classList.toggle('storm')">
    toggle storm
  </button>
</body>
</html>`,
  },
  f_css: {
    name: "style.css", view: "core:code", settings: {},
    code: `body {
  font-family: Georgia, serif;
  background: #f4ead8;
  color: #3a2f26;
  padding: 48px;
  max-width: 560px;
  transition: background .5s, color .5s;
}
h1 { color: #b34233; }
button {
  background: #2e6e6a;
  color: #f4ead8;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 15px;
}
.storm {
  background: #2b2f38;
  color: #e9e6dc;
}`,
  },
  f_ref: {
    name: "palette refs", view: "core:board",
    settings: { grid: false, tone: "ink", zoom: 1 },
    modules: [
      { id: "m9", type: "core:ref", x: 100, y: 90, rot: -1.2, data: { caption: "desert dusk", colors: ["#5A2E3C", "#C46A4A", "#EFD9A7"] } },
    ],
  },
  f_devlog: { name: "devlog drafts", view: "core:board", settings: { grid: true, tone: "slate", zoom: 1 }, modules: [] },
};

export const seedTree = [
  { id: "d_root", kind: "folder", name: "Dustfall — vertical slice", children: [
    { id: "d_design", kind: "folder", name: "design", children: [
      { id: "f_ideas", kind: "file" },
      { id: "f_sprint", kind: "file" },
      { id: "f_budget", kind: "file" },
      { id: "f_sketch", kind: "file" },
    ] },
    { id: "d_web", kind: "folder", name: "web", children: [
      { id: "f_html", kind: "file" },
      { id: "f_css", kind: "file" },
    ] },
    { id: "d_art", kind: "folder", name: "art", children: [{ id: "f_ref", kind: "file" }] },
  ] },
  { id: "d_mkt", kind: "folder", name: "marketing", children: [{ id: "f_devlog", kind: "file" }] },
];

export const seedTabs = ["f_ideas", "f_html"];
export const seedExpanded = ["d_root", "d_design", "d_web"];
