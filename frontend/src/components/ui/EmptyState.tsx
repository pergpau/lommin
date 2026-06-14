type EmptyStateProps = { message: string; children?: React.ReactNode; className?: string };

export default function EmptyState({ message, children, className }: EmptyStateProps) {
  return (
    <div className={`card p-10 text-center${className ? ` ${className}` : ""}`}>
      <div className="text-muted text-sm mb-3">{message}</div>
      {children}
    </div>
  );
}
