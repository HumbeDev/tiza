import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { create } from "zustand";
import Icon, { type IconName } from "../Icon";

export type MenuItem =
  | {
      kind?: "item";
      label: string;
      icon?: IconName;
      shortcut?: string;
      disabled?: boolean;
      checked?: boolean;
      danger?: boolean;
      onSelect: () => unknown;
    }
  | { kind: "separator" };

export const separator: MenuItem = { kind: "separator" };

/** A vertical list of actions. Arrow keys move, Enter/Space choose, Escape closes. */
export function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    const buttons = [
      ...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
    ];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") buttons[(i + 1) % buttons.length]?.focus();
    else if (e.key === "ArrowUp") buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="menu" role="menu" ref={ref} onKeyDown={onKeyDown}>
      {items.map((item, i) =>
        item.kind === "separator" ? (
          <div key={i} className="menu-separator" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={item.checked}
            className={item.danger ? "menu-item danger" : "menu-item"}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              void item.onSelect();
            }}
          >
            <span className="menu-icon">
              {item.checked ? <Icon name="check" /> : item.icon ? <Icon name={item.icon} /> : null}
            </span>
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

/** Closes when clicking outside `ref` or pressing Escape. */
function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
    };
  }, [ref, open, close]);
}

interface MenuButtonProps {
  label: string;
  icon?: IconName;
  /** Built when the menu opens, so labels and states are current. */
  items: () => MenuItem[];
  badge?: boolean;
  children?: ReactNode;
}

/** A toolbar button that opens a dropdown menu. */
export function MenuButton({ label, icon, items, badge, children }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDismiss(ref, open, close);

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        type="button"
        className={open ? "tool-button active" : "tool-button"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        {icon && <Icon name={icon} />}
        {children ?? <span>{label}</span>}
        <Icon name="chevronDown" small />
        {badge && <span className="badge" aria-hidden="true" />}
      </button>
      {open && (
        <div className="menu-dropdown">
          <MenuList items={items()} onClose={close} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- context menus

interface ContextMenuState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
}

const useContextMenu = create<ContextMenuState>(() => ({ menu: null }));

export function openContextMenu(e: { clientX: number; clientY: number }, items: MenuItem[]): void {
  useContextMenu.setState({ menu: { x: e.clientX, y: e.clientY, items } });
}

const closeContextMenu = () => useContextMenu.setState({ menu: null });

/** Renders the open context menu, kept inside the window. */
export function ContextMenuHost() {
  const menu = useContextMenu((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useDismiss(ref, menu !== null, closeContextMenu);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(menu.x, window.innerWidth - width - 4)),
      y: Math.max(4, Math.min(menu.y, window.innerHeight - height - 4)),
    });
  }, [menu]);

  if (!menu) return null;
  return (
    <div
      ref={ref}
      className="context-menu"
      style={{
        left: pos?.x ?? menu.x,
        top: pos?.y ?? menu.y,
        visibility: pos ? "visible" : "hidden",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuList key={`${menu.x},${menu.y}`} items={menu.items} onClose={closeContextMenu} />
    </div>
  );
}
