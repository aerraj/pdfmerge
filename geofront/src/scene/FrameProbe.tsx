import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { publishFrame } from '../core/frameStats';

/**
 * Publishes one FrameSample per rendered frame. Runs after the default render
 * priority so the renderer counters describe the frame that was just drawn.
 */
export function FrameProbe() {
  const last = useRef<number | null>(null);
  useFrame(({ gl }) => {
    const now = performance.now();
    const previous = last.current;
    last.current = now;
    if (previous === null) return;
    publishFrame({
      timeMs: now,
      deltaMs: now - previous,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    });
  });
  return null;
}
