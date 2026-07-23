export const Icn = ({ d, size = 13, stroke = 1.6 }) => (
  <svg
    width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

export const I = {
  chev: "M5 3l5 5-5 5",
  folder: "M1.5 4.5h4l1.5 2h7.5v6.5h-13z",
  board: "M2 2h5v5H2zM9 2h5v7H9zM2 9h5v5H2zM9 11h5v3H9z",
  home: "M2 8L8 2.5L14 8M3.5 6.5V13.5H12.5V6.5M6.5 13.5V9.5H9.5V13.5",
  kanban: "M2 2h3.5v12H2zM6.5 2H10v8H6.5zM11 2h3.5v10H11z",
  sheet: "M2 2.5h12v11H2zM2 6h12M2 9.5h12M6.5 2.5v11M10.5 2.5v11",
  pencil: "M3 13.5v-2.6L10.9 3l2.6 2.6-7.9 7.9zM9.4 4.5L12 7",
  code: "M5 4L2 8l3 4M11 4l3 4-3 4",
  play: "M4.5 3l8 5-8 5z",
  reload: "M13 8a5 5 0 11-1.5-3.5M13 2.5v2.8h-2.8",
  plus: "M8 3v10M3 8h10",
  minus: "M3 8h10",
  x: "M4 4l8 8M12 4l-8 8",
  gear: "M8 5.5A2.5 2.5 0 108 10.5 2.5 2.5 0 008 5.5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4",
  check: "M3 8.5l3.5 3.5L13 4.5",
  burger: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11",
  left: "M10 3L5 8l5 5",
  right: "M6 3l5 5-5 5",
  undo: "M3 7h7a3 3 0 013 3v0a3 3 0 01-3 3H6M3 7l3-3M3 7l3 3",
  eraser: "M5.5 13h8M2.5 10.5L8 5l3.5 3.5-4 4h-2z",
  trash: "M3.5 4.5h9M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9",
};
