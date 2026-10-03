import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('GeoFront: #root element missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Developer tooling is loaded only in dev and bench builds. Vite replaces these
// constants at build time, so production bundles contain neither module.
if (import.meta.env.DEV) {
  void import('./dev/devOverlay').then((m) => {
    m.installDevOverlay();
  });
}
if (import.meta.env.MODE === 'bench') {
  void import('./dev/bench/benchRunner').then((m) => {
    m.installBenchRunner();
  });
}
