import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { Toaster } from './components/ui/toaster';
import { initializeGlobalErrorHandlers } from './lib/errorHandler';

// Initialize global error handlers
initializeGlobalErrorHandlers();

// Disable React development tools in production
if (process.env.NODE_ENV === 'production') {
  // Use type assertion to avoid TypeScript errors with the DevTools hook
  const windowWithDevTools = window as any;
  if (typeof windowWithDevTools.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object') {
    for (let [key, value] of Object.entries(windowWithDevTools.__REACT_DEVTOOLS_GLOBAL_HOOK__)) {
      windowWithDevTools.__REACT_DEVTOOLS_GLOBAL_HOOK__[key] = typeof value === 'function' ? () => {} : null;
    }
  }
}

// Register service worker for enhanced WebRTC resilience
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}

// Render without StrictMode to avoid double rendering issues with WebRTC
ReactDOM.createRoot(document.getElementById('root')!).render(
  // Remove StrictMode in production to avoid double-rendering issues
  process.env.NODE_ENV === 'development' ? (
    <React.StrictMode>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </React.StrictMode>
  ) : (
    <BrowserRouter>
      <App />
      <Toaster />
    </BrowserRouter>
  )
);
