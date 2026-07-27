import React from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { reportError } from '../services/errorReporting.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) console.error('Error caught by boundary:', error, errorInfo);
    reportError(error, { source: `ErrorBoundary:${errorInfo?.componentStack?.split('\n')[1]?.trim() || 'unknown'}` });
  }

  handleCopy = async () => {
    const { error } = this.state;
    if (!error) return;
    const text = `${error.name}: ${error.message}\n${error.stack || ''}`;
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, copied } = this.state;
      const errorDetails = error
        ? `${error.name}: ${error.message}`
        : 'Unknown error';
      const stackTrace = error?.stack || '';

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Something went wrong</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The application encountered an unexpected error. Details are shown below to help with debugging.
            </p>

            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Error</p>
              <p className="text-sm font-mono text-red-800 dark:text-red-200 break-words">{errorDetails}</p>
            </div>

            {stackTrace && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Stack trace</p>
                  <button
                    onClick={this.handleCopy}
                    className="flex items-center text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold"
                  >
                    {copied ? (
                      <> <Check className="w-3 h-3 mr-1" /> Copied </>
                    ) : (
                      <> <Copy className="w-3 h-3 mr-1" /> Copy </>
                    )}
                  </button>
                </div>
                <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
                  {stackTrace}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
