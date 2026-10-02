import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200/90 shadow-lg p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-gray-900">
                Une petite erreur est survenue
              </h2>
              <p className="text-sm text-gray-600">
                L'affichage a rencontré un problème inattendu. Vos données sont bien conservées.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left text-xs bg-gray-50 text-gray-600 rounded-lg p-3 cursor-pointer">
                <summary className="font-semibold text-gray-700 select-none">
                  Détails techniques
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11px] text-red-600">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recharger la page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
