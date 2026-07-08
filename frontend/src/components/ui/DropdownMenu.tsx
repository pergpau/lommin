import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useDropdown } from "../../hooks/useDropdown";
import { XIcon } from "./icons";

export const dropdownItemClass =
  "flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-40 transition-colors text-left";

export default function DropdownMenu({
  icon,
  ariaLabel,
  menuClassName = "w-48",
  children,
}: {
  icon: ReactNode;
  ariaLabel: string;
  menuClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const { open, toggle, close, ref } = useDropdown<HTMLDivElement>();

  return (
    <div className="relative" ref={ref}>
      <button
        className="p-1.5 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors flex items-center justify-center"
        onClick={toggle}
        aria-label={ariaLabel}
      >
        {open ? <XIcon size={18} /> : icon}
      </button>
      {open && (
        <div className={`absolute right-0 top-full mt-1 card py-1 z-30 shadow-lg ${menuClassName}`}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  danger,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button className={`${dropdownItemClass} ${danger ? "text-danger" : "text-text"}`} {...props}>
      {children}
    </button>
  );
}
