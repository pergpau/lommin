type PageHeaderProps = { title: string; subtitle?: string }

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text">{title}</h1>
      {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
    </div>
  )
}
