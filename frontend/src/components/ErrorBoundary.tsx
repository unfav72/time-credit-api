import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { ClayCard } from './clay/ClayCard';
import { ClayButton } from './clay/ClayButton';

interface Props {
  children: ReactNode;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled React error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
    } else {
      window.location.hash = '';
      window.location.reload();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1rem',
          }}
        >
          <ClayCard
            variant="raised"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: '2.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
              border: '2px solid rgba(239, 68, 68, 0.25)',
              background: 'linear-gradient(145deg, #ffffff, #fff5f5)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--clay-shadow-btn)',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <div>
              <h2
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.02em',
                }}
              >
                Page Render Glitch Intercepted
              </h2>
              <p
                style={{
                  color: '#64748b',
                  fontSize: '0.875rem',
                  marginTop: '0.5rem',
                  lineHeight: 1.5,
                }}
              >
                A component error was safely caught to prevent a blank white screen. You can return
                to the main dashboard or reload the page.
              </p>
            </div>

            {this.state.error?.message && (
              <div
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.75rem',
                  color: '#dc2626',
                  textAlign: 'left',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  wordBreak: 'break-all',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: '0.5rem',
              }}
            >
              <ClayButton
                variant="primary"
                onClick={this.handleReset}
                icon={<LayoutDashboard size={16} />}
              >
                Back to Dashboard
              </ClayButton>

              <ClayButton
                variant="secondary"
                onClick={this.handleReload}
                icon={<RefreshCw size={16} />}
              >
                Reload Platform
              </ClayButton>
            </div>
          </ClayCard>
        </div>
      );
    }

    return this.props.children;
  }
}
