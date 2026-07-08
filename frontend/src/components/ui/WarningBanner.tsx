type WarningBannerProps = {
  message: string;
  children?: React.ReactNode;
  className?: string;
};

export default function WarningBanner({ message, children, className }: WarningBannerProps) {
  return (
    <div
      className={`bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-6 ${className ?? ""}`}
    >
      <span className="text-sm text-warning font-medium">{message}</span>
      {children && <div className="flex items-center gap-1 shrink-0">{children}</div>}
    </div>
  );
}
