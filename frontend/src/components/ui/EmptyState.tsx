type EmptyStateProps = {
  message: string;
  children?: React.ReactNode;
  /** Drop the card chrome when already rendering inside one. */
  bare?: boolean;
  className?: string;
};

export default function EmptyState({ message, children, bare, className }: EmptyStateProps) {
  return (
    <div className={`${bare ? "" : "card "}p-10 text-center${className ? ` ${className}` : ""}`}>
      <div className={`text-muted text-sm${children ? " mb-3" : ""}`}>{message}</div>
      {children}
    </div>
  );
}
