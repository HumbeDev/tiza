const PATHS = {
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  slideAdd: "M3 5h18v12H3zM12 8v6M9 11h6",
  text: "M5 6V4h14v2M12 4v16M9 20h6",
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
  front: "M8 8h12v12H8zM4 4h12v12",
  back: "M4 4h12v12H4zM8 16v4h12V8h-4",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
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
