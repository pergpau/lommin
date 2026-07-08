type BadgeTone = "positive" | "accent" | "warning";
type BadgeSize = "xs" | "sm";

type BadgeProps = {
  tone: BadgeTone;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
};

const toneStyles: Record<BadgeTone, string> = {
  positive: "text-positive bg-positive/10 border-positive/20",
  accent: "text-accent/80 bg-accent/8 border-accent/20",
  warning: "text-warning/80 bg-warning/8 border-warning/20",
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: "text-[10px] font-medium",
  sm: "text-xs",
};

export default function Badge({ tone, size = "sm", children, className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 leading-none ${sizeStyles[size]} ${toneStyles[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
