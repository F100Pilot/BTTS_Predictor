import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@/services/logger';
import { Button } from '@/components/ui/button';

const log = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('Render error captured', { error: error.message, info: info.componentStack });
  }

  private reset = (): void => this.setState({ hasError: false, message: undefined });

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-xl font-semibold">Algo correu mal</h2>
        <p className="max-w-md text-sm text-muted-foreground">{this.state.message}</p>
        <Button onClick={this.reset}>Tentar novamente</Button>
      </div>
    );
  }
}
