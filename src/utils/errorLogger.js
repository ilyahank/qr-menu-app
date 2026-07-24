// Error Logging System
// Logs all errors to both console and Supabase for tracking

import { supabase } from '../supabase';

export const logError = async (error, context = {}) => {
  const errorData = {
    error_message: error.message || String(error),
    error_stack: error.stack || null,
    context: JSON.stringify(context),
    user_id: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')).id : null,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent
  };

  // Log to console
  console.error('Error logged:', errorData);

  // Log to Supabase error_logs table
  try {
    await supabase
      .from('error_logs')
      .insert([errorData]);
  } catch (logError) {
    console.error('Failed to log error to database:', logError);
  }
};

export const logInfo = async (message, context = {}) => {
  const logData = {
    log_type: 'info',
    message: message,
    context: JSON.stringify(context),
    user_id: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')).id : null,
    url: window.location.href,
    timestamp: new Date().toISOString()
  };

  console.log('Info logged:', logData);

  try {
    await supabase
      .from('error_logs')
      .insert([logData]);
  } catch (logError) {
    console.error('Failed to log info to database:', logError);
  }
};

// React Error Boundary wrapper
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>The error has been logged. Please try refreshing the page.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
