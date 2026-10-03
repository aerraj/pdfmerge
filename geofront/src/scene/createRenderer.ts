import { AgXToneMapping, ACESFilmicToneMapping, NeutralToneMapping, WebGPURenderer, type ToneMapping } from 'three/webgpu';
import { IMAGE, type RENDERER } from '../config/render';
import type { BackendChoice, DepthChoice } from '../core/launchOptions';
import { useGeoStore, type RendererStatus } from '../core/store';
import { applyWebGpuCompat } from './webgpuCompat';

let current: WebGPURenderer | null = null;

/** The live renderer. R3F types its `gl` as WebGLRenderer, so code reads it from here. */
export function getRenderer(): WebGPURenderer {
  if (!current) throw new Error('GeoFront: renderer used before it was created');
  return current;
}

export const TONE_MAPPINGS: Record<(typeof RENDERER)['toneMapping'], ToneMapping> = {
  agx: AgXToneMapping,
  aces: ACESFilmicToneMapping,
  neutral: NeutralToneMapping,
};

interface DebugRendererInfo {
  UNMASKED_RENDERER_WEBGL: number;
}

function describeGpu(renderer: WebGPURenderer, device: GPUDevice | undefined): string {
  try {
    if (device) {
      const info = device.adapterInfo;
      return [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') || 'unknown';
    }
    const gl = (renderer.backend as unknown as { gl?: WebGL2RenderingContext }).gl;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info') as DebugRendererInfo | null | undefined;
    return gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Creates the WebGPU renderer (falling back to WebGL 2 automatically) with the depth
 * strategy from config, and records which backend actually came up.
 */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options: { backend: BackendChoice; depth: DepthChoice },
): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    canvas,
    forceWebGL: options.backend === 'webgl',
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    reversedDepthBuffer: options.depth === 'reversed',
    logarithmicDepthBuffer: options.depth === 'logarithmic',
  });
  await renderer.init();
  // R3F drives its own loop, so frame counters are reset by RenderLoop each frame.
  renderer.info.autoReset = false;
  renderer.toneMappingExposure = IMAGE.exposure;

  const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean; device?: GPUDevice };
  const webgpu = backend.isWebGPUBackend === true;
  const shims = webgpu && backend.device ? applyWebGpuCompat(backend.device) : [];
  const status: RendererStatus = {
    backend: webgpu ? 'webgpu' : 'webgl2',
    gpu: describeGpu(renderer, webgpu ? backend.device : undefined),
    depth: renderer.reversedDepthBuffer ? 'reversed-float' : renderer.logarithmicDepthBuffer ? 'logarithmic' : 'standard',
    shims,
  };
  current = renderer;
  useGeoStore.getState().setRenderer(status);
  return renderer;
}
