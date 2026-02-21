import { Component, ComponentChildren } from "preact";

interface Props {
  children: ComponentChildren;
  fallback?: ComponentChildren;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div class="flex items-center justify-center min-h-screen bg-gray-50 text-gray-800">
          <div class="max-w-md p-8 bg-white shadow-lg rounded-lg border border-red-200">
            <h2 class="text-2xl font-bold mb-4 text-red-600">Something went wrong</h2>
            <p class="mb-6">The application encountered an unexpected error. This might be due to a data processing issue or a temporary glitch.</p>
            <button 
              onClick={() => window.location.reload()}
              class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
