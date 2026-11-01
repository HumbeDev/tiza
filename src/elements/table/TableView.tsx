import type { KeyboardEvent } from "react";
import type { Element, TableElement } from "../../document";
import type { RenderMode } from "../../render/SlideRenderer";
import { setTableRows } from "../../store/editor";
import { isNumeric } from "./csv";

type Props = { el: Element & { kind: "table" } & TableElement; mode: RenderMode; editing: boolean };

/** Spreadsheet-like table. Scrolls inside its box (header row stays visible). */
export default function TableView({ el, mode, editing }: Props) {
  const width = Math.max(1, ...el.rows.map((r) => r.length));
  const rows = el.rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  const header = el.headerRow ? rows[0] : null;
  const body = el.headerRow ? rows.slice(1) : rows;
  const offset = el.headerRow ? 1 : 0;

  function edit(row: number, col: number, value: string) {
    const next = rows.map((r) => [...r]);
    next[row][col] = value;
    setTableRows(el.id, next, `table:${el.id}`);
  }

  // Enter moves down like a spreadsheet (Tab already moves right).
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const target = document.querySelector<HTMLInputElement>(
      `[data-cell="${el.id}:${row + (e.shiftKey ? -1 : 1)}:${col}"]`,
    );
    target?.focus();
    target?.select();
  }

  const cell = (value: string, row: number, col: number) =>
    editing ? (
      <input
        value={value}
        data-cell={`${el.id}:${row}:${col}`}
        onChange={(e) => edit(row, col, e.target.value)}
        onKeyDown={(e) => onKeyDown(e, row, col)}
        onPointerDown={(e) => e.stopPropagation()}
      />
    ) : (
      value
    );

  return (
    <div
      className={`table-view theme-${el.theme}${el.striped ? " striped" : ""}${editing ? " editing" : ""}`}
      style={{ fontSize: el.fontSize }}
      data-interactive={mode === "present" ? "" : undefined}
    >
      <table>
        {header && (
          <thead>
            <tr>
              {header.map((v, c) => (
                <th key={c} className={isNumeric(v) ? "num" : undefined}>
                  {cell(v, 0, c)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>
              {r.map((v, c) => (
                <td key={c} className={isNumeric(v) ? "num" : undefined}>
                  {cell(v, i + offset, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
