type AlertType = 'ok' | 'error' | 'info'

type AlertProps = {
  type: AlertType
  message: string
  children?: React.ReactNode
  className?: string
}

const styles: Record<AlertType, string> = {
  ok: 'border-positive/20 bg-positive/5 text-positive',
  error: 'border-negative/20 bg-negative/5 text-negative',
  info: 'border-warning/20 bg-warning/5 text-muted',
}

export default function Alert({ type, message, children, className }: AlertProps) {
  return (
    <div className={`border rounded-lg p-3 text-sm ${styles[type]} ${className ?? ''}`}>
      {message}
      {children}
    </div>
  )
}
