import Icon, { type IconName } from "./Icon";

interface ToolButtonProps {
  icon: IconName;
  label: string;
  onClick: () => unknown;
  shortcut?: string;
  disabled?: boolean;
  showLabel?: boolean;
  /** Small dot, e.g. for unsaved changes. */
  badge?: boolean;
}

export function ToolButton({
  icon,
  label,
  onClick,
  shortcut,
  disabled,
  showLabel,
  badge,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className="tool-button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
      {badge && <span className="badge" aria-hidden="true" />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
