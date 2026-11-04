const PATHS = {
  fileNew: "M14 3H6v18h12V7zM14 3v4h4M12 11v6M9 14h6",
  folderOpen: "M3 7V5h6l2 2h8v3M3 7v12h15l3-9H6l-3 9",
  save: "M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  check: "M5 12l5 5 9-10",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  shapes: "M3 13h8v8H3zM17 3l4 7h-8zM17 21a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  cut: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.5-2",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c7 0 11 7 11 7a18 18 0 0 1-3.2 4.1M6.6 6.6A18 18 0 0 0 1 12s4 7 11 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  selectAll: "M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4M9 9h6v6H9z",
  fxAppear: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  fxFade: "M12 4a8 8 0 1 0 0 16zM12 4a8 8 0 0 1 0 16",
  fxRise: "M5 20h14M12 16V5M7 9l5-5 5 5",
  fxFromLeft: "M4 4v16M8 12h12M15 7l5 5-5 5",
  fxFromRight: "M20 4v16M16 12H4M9 7l-5 5 5 5",
  fxZoom: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-6-6M10 7v6M7 10h6",
  fxWipe: "M4 5h16v14H4zM10 5v14M14 9l-2 3 2 3",
  trNone: "M4 5h16v14H4zM5 19 19 5",
  trSlide: "M3 6h10v12H3zM15 8h6M15 12h6M15 16h6",
  paste: "M16 4h2v17H6V4h2M9 2h6v4H9z",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  slideAdd: "M3 5h18v12H3zM12 8v6M9 11h6",
  text: "M5 6V4h14v2M12 4v16M9 20h6",
  math: "M18 5H6l6 7-6 7h12",
  html: "M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  import: "M12 3v12M7 10l5 5 5-5M4 17v3h16v-3",
  exportFile: "M12 15V3M7 8l5-5 5 5M4 17v3h16v-3",
  video: "M3 6h13v12H3zM16 10l5-3v10l-5-3",
  globe:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
  youtube: "M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM10 9v6l5-3z",
  xPost: "M4 4h4.5L20 20h-4.5zM20 4l-6.6 7.5M4 20l6.6-7.5",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14",
  build: "M4 18h4v-4H4zM10 18h4V9h-4zM16 18h4V4h-4z",
  play: "M7 4v16l13-8z",
  reload: "M20 12a8 8 0 1 1-3-6.2M20 4v5h-5",
  inlineMath: "M4 18 9 6M15 6l5 12M9 13h6",
  bulletList: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  orderedList: "M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 14.5c.5-1 2-1 2 0s-2 1.5-2 3h2",
  rect: "M4 6h16v12H4z",
  ellipse: "M12 5c5 0 9 3.1 9 7s-4 7-9 7-9-3.1-9-7 4-7 9-7z",
  line: "M4 20 20 4",
  arrow: "M4 20 20 4M11 4h9v9",
  copy: "M8 8h12v12H8zM4 16V4h12",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  alignLeft: "M4 3v18M8 7h12v4H8zM8 14h7v4H8z",
  alignCenterX: "M12 3v18M6 7h12v4H6zM8.5 14h7v4h-7z",
  alignRight: "M20 3v18M4 7h12v4H4zM9 14h7v4H9z",
  alignTop: "M3 4h18M7 8h4v12H7zM14 8h4v7h-4z",
  alignCenterY: "M3 12h18M7 6h4v12H7zM14 8.5h4v7h-4z",
  alignBottom: "M3 20h18M7 4h4v12H7zM14 9h4v7h-4z",
  group: "M3 3h4M3 3v4M21 3h-4M21 3v4M3 21h4M3 21v-4M21 21h-4M21 21v-4M7 7h6v6H7zM11 11h6v6h-6z",
  ungroup: "M4 4h7v7H4zM13 13h7v7h-7z",
  textLeft: "M4 6h16M4 10h10M4 14h16M4 18h10",
  textCenter: "M4 6h16M7 10h10M4 14h16M7 18h10",
  textRight: "M4 6h16M10 10h10M4 14h16M10 18h10",
  textJustify: "M4 6h16M4 10h16M4 14h16M4 18h16",
  eraser: "M7 21h13M5.5 15.5 14 7l5 5-8.5 8.5H7.5l-2-2a1.4 1.4 0 0 1 0-2zM10 11l5 5",
  master: "M3 4h18v13H3zM3 14h18M6 17v3h12v-3M6 7h4",
  front: "M8 8h12v12H8zM4 4h12v12",
  back: "M4 4h12v12H4zM8 16v4h12V8h-4",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, small }: { name: IconName; small?: boolean }) {
  const size = small ? 14 : 18;
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
