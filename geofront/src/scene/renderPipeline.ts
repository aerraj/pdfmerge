import { pass, renderOutput } from 'three/tsl';
import { RenderPipeline, SRGBColorSpace, type Camera, type Scene, type WebGPURenderer } from 'three/webgpu';
import { RENDERER } from '../config/render';
import { TONE_MAPPINGS } from './createRenderer';

/**
 * Scene pass → tone mapping → sRGB output. The scene pass renders into a target whose
 * depth texture is float32 whenever reversed-Z is on, on both backends, which is what
 * keeps 0.1 m to 10 km free of z-fighting. Post effects slot in here in T5.2.
 */
export function buildRenderPipeline(renderer: WebGPURenderer, scene: Scene, camera: Camera): RenderPipeline {
  const scenePass = pass(scene, camera, { samples: RENDERER.msaaSamples });
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = renderOutput(scenePass, TONE_MAPPINGS[RENDERER.toneMapping], SRGBColorSpace);
  return pipeline;
}
