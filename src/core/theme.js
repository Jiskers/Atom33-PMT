/* Design tokens + tiny shared utilities. */

export const C = {
  bg: "#131519",
  panel: "#191C22",
  panel2: "#20242D",
  line: "#2A2F39",
  text: "#E9E6DC",
  dim: "#9AA0AC",
  faint: "#697080",
  ink: "#2A2620",
  paper: "#EFE8D8",
  gold: "#E8C87A",
};

export const STICKY = ["#F2D06B", "#A8D8B0", "#93C5E8", "#EDA6AD"];
export const TONES = { slate: "#1D2027", cork: "#372D24", ink: "#14161A" };

export const STATUS = ["idea", "prototyping", "it's fun", "cut"];
export const STATUS_COLOR = ["#93C5E8", "#F2D06B", "#A8D8B0", "#EDA6AD"];

// Default workspace size for board/draw — overridable per file via
// settings.canvasW/canvasH (see CANVAS_SIZES). Resizing is non-destructive:
// modules/strokes outside the new bounds just render without the toned
// backdrop behind them, nothing is clipped or lost.
export const CANVAS_W = 1800;
export const CANVAS_H = 1300;
export const CANVAS_SIZES = {
  Compact: { w: 1200, h: 900 },
  Default: { w: CANVAS_W, h: CANVAS_H },
  Large: { w: 2600, h: 1800 },
  Huge: { w: 4000, h: 2800 },
};

export const ZMIN = 0.4;
export const ZMAX = 2.5;
export const clampZ = (z) => Math.min(ZMAX, Math.max(ZMIN, z));

let _uid = Date.now() % 100000;
export const uid = (p) => p + _uid++;

export const fileExt = (name = "") =>
  name.includes(".") ? name.split(".").pop().toLowerCase() : "";

export const KNOWN_EXTS = {
  html: "#E8956B", htm: "#E8956B", css: "#93C5E8", js: "#F2D06B",
  php: "#C9B0E8", json: "#A8D8B0", md: "#E9E6DC", txt: "#9AA0AC",
};

export const RUNNABLE = ["html", "htm"];

export const MONO = "'IBM Plex Mono', monospace";
export const SANS = "'Sora', sans-serif";
export const HAND = "'Caveat', cursive";
