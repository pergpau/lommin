import { Component, type ErrorInfo, type ReactNode } from 'react'
import Button from './ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// Catches render-time errors anywhere below it so one broken page doesn't blank
// the whole SPA. "Try again" clears the error and re-renders the same route;
// "Reload" does a full reload as a last resort.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Local-only log; no telemetry is sent off-device by design.
    console.error('Uventet feil i grensesnittet:', error, info.componentStack)
  }

  handleReset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-text mb-2">Noe gikk galt</h1>
          <p className="text-sm text-muted mb-6">
            En uventet feil oppsto. Dataene dine er trygge lokalt — prøv igjen, eller last siden på nytt.
          </p>
          <p className="text-xs text-muted/80 mono mb-6 break-words">{this.state.error.message}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.handleReset}>Prøv igjen</Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>Last på nytt</Button>
          </div>
        </div>
      </div>
    )
  }
}
