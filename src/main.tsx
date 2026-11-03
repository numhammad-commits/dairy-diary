import React from 'react';
import {createRoot} from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import './index.css';

// Catches render-time crashes and shows the actual error instead of a silent
// frozen/blank screen. Does not catch a true synchronous infinite-loop hang
// (the thread never returns to React) or unhandled Promise rejections.
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Dairy Diary crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, background: '#2a0a0a', color: '#ffb4b4', minHeight: '100vh', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2 style={{ color: '#ff6b6b' }}>Dairy Diary crashed</h2>
          <p>{this.state.error.message}</p>
          <pre style={{ fontSize: 11, opacity: 0.8 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// OAuth Client IDs are public identifiers, safe to embed in client-side code.
const GOOGLE_CLIENT_ID = '1093948980818-h60lvmd8n3pasu6nql28q7cqhsh91nor.apps.googleusercontent.com';

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </ErrorBoundary>
);
