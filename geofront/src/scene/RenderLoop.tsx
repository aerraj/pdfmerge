import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { RenderPipeline } from 'three/webgpu';
import { publishFrame } from '../core/frameStats';
import { getRenderer } from './createRenderer';
import { buildRenderPipeline } from './renderPipeline';

/**
 * Time of the current animation frame, ms. Inside a requestAnimationFrame callback the
 * document timeline reads the frame's vsync-aligned start time (the value rAF passes),
 * so intervals measure frames actually presented, not callback scheduling jitter.
 */
function frameTime(): number {
  const t = document.timeline.currentTime;
  return typeof t === 'number' ? t : performance.now();
}

/** Render priority above zero tells R3F this component owns rendering. */
const RENDER_PRIORITY = 1;

/** Renders each frame through the render pipeline and publishes frame statistics. */
export function RenderLoop() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const pipeline = useRef<RenderPipeline | null>(null);
  const lastFrame = useRef<number | null>(null);

  useEffect(() => {
    const p = buildRenderPipeline(getRenderer(), scene, camera);
    pipeline.current = p;
    return () => {
      pipeline.current = null;
      p.dispose();
    };
  }, [scene, camera]);

  useFrame(() => {
    const p = pipeline.current;
    if (!p) return;
    const now = frameTime();
    const renderer = getRenderer();
    renderer.info.reset();
    p.render();
    const previous = lastFrame.current;
    lastFrame.current = now;
    if (previous === null) return;
    publishFrame({
      timeMs: now,
      deltaMs: now - previous,
      drawCalls: renderer.info.render.drawCalls,
      triangles: renderer.info.render.triangles,
    });
  }, RENDER_PRIORITY);

  return null;
}
