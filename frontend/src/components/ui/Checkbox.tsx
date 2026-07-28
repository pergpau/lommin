type CheckboxProps = {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Multi-line labels want "start" so the box stays level with the first line. */
  align?: "center" | "start";
  labelClassName?: string;
  textClassName?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export default function Checkbox({
  label,
  hint,
  align = "center",
  labelClassName,
  textClassName = "text-xs text-text",
  className,
  type = "checkbox",
  disabled,
  ...props
}: CheckboxProps) {
  const start = align === "start";
  return (
    <label
      className={`flex ${start ? "items-start" : "items-center"} gap-2 cursor-pointer select-none${
        disabled ? " opacity-50" : ""
      }${labelClassName ? ` ${labelClassName}` : ""}`}
    >
      <input
        type={type}
        disabled={disabled}
        className={`w-4 h-4 accent-accent${start ? " mt-0.5 shrink-0" : ""}${
          className ? ` ${className}` : ""
        }`}
        {...props}
      />
      <span className={`${textClassName}${start ? " leading-snug" : ""}`}>
        {label}
        {hint && <span className="block text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}
