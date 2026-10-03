import { FRAME_STATS } from '../config/budgets';
import { onFrame, summarizeFrames } from '../core/frameStats';

/**
 * Developer overlay, toggled with the backtick key. Dev builds only: main.tsx
 * imports this module behind import.meta.env.DEV, so production bundles never
 * contain it (scripts/check-prod-build.ts verifies the marker below is absent).
 */
export const DEV_OVERLAY_MARKER = 'geofront-dev-overlay';

const TOGGLE_CODE = 'Backquote';
const MS_PER_SEC = 1000;

export function installDevOverlay(): void {
  const panel = document.createElement('pre');
  panel.dataset.geofront = DEV_OVERLAY_MARKER;
  Object.assign(panel.style, {
    position: 'fixed',
    top: '8px',
    left: '8px',
    margin: '0',
    padding: '6px 8px',
    font: '11px/1.35 ui-monospace, monospace',
    color: '#9cff9c',
    background: 'rgba(0, 0, 0, 0.72)',
    pointerEvents: 'none',
    zIndex: '10',
    display: 'none',
    whiteSpace: 'pre',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(panel);

  const window_: number[] = [];
  let drawCalls = 0;
  let triangles = 0;
  onFrame((sample) => {
    window_.push(sample.deltaMs);
    if (window_.length > FRAME_STATS.rollingWindowFrames) window_.shift();
    drawCalls = sample.drawCalls;
    triangles = sample.triangles;
  });

  const render = () => {
    const s = summarizeFrames(window_);
    const fps = s.meanMs > 0 ? MS_PER_SEC / s.meanMs : 0;
    panel.textContent = [
      `fps ${fps.toFixed(1)}  mean ${s.meanMs.toFixed(2)} ms`,
      `p50 ${s.p50Ms.toFixed(2)}  p99 ${s.p99Ms.toFixed(2)}  max ${s.maxMs.toFixed(2)} ms`,
      `hitches ${s.hitches}  draws ${drawCalls}  tris ${triangles}`,
    ].join('\n');
  };
  let timer: number | undefined;

  window.addEventListener('keydown', (event) => {
    if (event.code !== TOGGLE_CODE || event.repeat) return;
    const visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (visible) {
      window.clearInterval(timer);
      timer = undefined;
    } else {
      render();
      timer = window.setInterval(render, FRAME_STATS.overlayRefreshMs);
    }
  });
}
