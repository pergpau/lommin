import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../lib/i18n";
import Button from "./ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render-time errors anywhere below it so one broken page doesn't blank
// the whole SPA. "Try again" clears the error and re-renders the same route;
// "Reload" does a full reload as a last resort.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Local-only log; no telemetry is sent off-device by design.
    console.error(i18n.t("components:errorBoundary.consoleLabel"), error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    const { t } = i18n;
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-text mb-2">
            {t("components:errorBoundary.title")}
          </h1>
          <p className="text-sm text-muted mb-6">{t("components:errorBoundary.body")}</p>
          <p className="text-xs text-muted/80 mono mb-6 break-words">{this.state.error.message}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.handleReset}>{t("components:errorBoundary.retry")}</Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              {t("components:errorBoundary.reload")}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
