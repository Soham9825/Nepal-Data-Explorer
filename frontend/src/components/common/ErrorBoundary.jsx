import { Component } from "react";

// Without this, any render-time throw in any page unmounts the entire React
// tree and the user just gets a blank white screen with no way back. The
// boundary turns an unexpected exception into a readable message plus a reload,
// and surfaces the stack to the console so the failing line is still findable.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-snow">
        <div className="bg-white rounded shadow p-6 max-w-lg text-center">
          <h3 className="text-lg font-bold mb-2 text-onSurface">Something went wrong</h3>
          <p className="text-sm text-gray-600 mb-4">
            The page hit an unexpected error and stopped rendering. Reloading
            usually clears it.
          </p>
          <pre className="text-left text-xs bg-surface-container-highest rounded p-3 mb-4 overflow-auto max-h-40 whitespace-pre-wrap break-words text-danger">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded font-bold"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
