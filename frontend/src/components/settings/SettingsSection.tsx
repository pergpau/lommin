import Card from "../ui/Card";

type SettingsSectionProps = {
  title: string;
  description?: string;
  /** Anchor id; combined with highlightedHash to flash the ring on deep-link. */
  id?: string;
  highlightedHash?: string | null;
  className?: string;
  children: React.ReactNode;
};

export default function SettingsSection({
  title,
  description,
  id,
  highlightedHash,
  className,
  children,
}: SettingsSectionProps) {
  const highlighted = !!id && highlightedHash === `#${id}`;
  return (
    <Card
      id={id}
      className={`p-5 mb-4 transition-shadow duration-300${
        highlighted ? " ring-2 ring-accent" : ""
      }${className ? ` ${className}` : ""}`}
    >
      <h2 className={`text-sm font-semibold text-text ${description ? "mb-1" : "mb-3"}`}>
        {title}
      </h2>
      {description && <p className="text-xs text-muted mb-3">{description}</p>}
      {children}
    </Card>
  );
}
