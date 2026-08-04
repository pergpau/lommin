type TabsProps<T extends string> = {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  label: (tab: T) => string;
  /** Spread the tabs across the full width on mobile, as the dashboard does. */
  fill?: boolean;
  className?: string;
};

/** Underlined tab bar. Presentational — the active tab lives in the caller. */
export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  fill,
  className,
}: TabsProps<T>) {
  return (
    <div
      className={`flex gap-1 border-b border-border ${
        fill ? "justify-between sm:justify-start" : ""
      } ${className ?? ""}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            fill ? "flex-1 sm:flex-none text-center" : ""
          } ${
            tab === active
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-text"
          }`}
          onClick={() => onChange(tab)}
        >
          {label(tab)}
        </button>
      ))}
    </div>
  );
}
