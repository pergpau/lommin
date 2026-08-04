type SelectProps = {
  /** "sm" is the inline picker used in the importers; "md" matches form Inputs. */
  size?: "sm" | "md";
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;

const SIZES = {
  sm: "text-xs border border-border rounded px-2 py-1.5 bg-surface text-text",
  md: "input bg-surface-2",
} as const;

export default function Select({ size = "sm", className, children, ...props }: SelectProps) {
  return (
    <select className={`${SIZES[size]} ${className ?? ""}`.trim()} {...props}>
      {children}
    </select>
  );
}
