import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorService } from './services/ErrorService';

window.addEventListener('error', (event) => {
  void ErrorService.logUnexpected(event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  void ErrorService.logUnexpected(event.reason);
});

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);