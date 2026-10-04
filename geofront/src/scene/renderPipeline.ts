import { renderOutput, texture } from 'three/tsl';
import {
  DepthTexture,
  FloatType,
  HalfFloatType,
  RenderPipeline,
  RenderTarget,
  SRGBColorSpace,
  UnsignedIntType,
  Vector2,
  type Camera,
  type LOD,
  type Object3D,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { RENDERER } from '../config/render';
import { TONE_MAPPINGS } from './createRenderer';

/**
 * Frame structure: the scene renders at the top level into `sceneTarget` (half-float
 * colour, float32 depth whenever reversed-Z is on — on both backends that is what keeps
 * 0.1 m to 10 km free of z-fighting), then the post pipeline reads it: tone mapping and
 * sRGB output now, bloom/SMAA/grain in T5.2.
 *
 * Rendering the scene ourselves, rather than through a TSL pass() node, matters for
 * smoothness: three keys render objects by render-call depth, and a pass node renders
 * the scene nested inside the output quad, a depth `compileAsync` can never match. Here
 * the scene renders at the same depth precompile uses, so precompiled zones draw their
 * first frame without building anything (DECISIONS D-024).
 */
export class FramePipeline {
  readonly sceneTarget: RenderTarget;
  private readonly post: RenderPipeline;
  private readonly renderer: WebGPURenderer;
  private readonly size = new Vector2();

  constructor(renderer: WebGPURenderer) {
    this.renderer = renderer;
    renderer.getDrawingBufferSize(this.size);
    this.sceneTarget = new RenderTarget(this.size.x, this.size.y, { type: HalfFloatType, samples: RENDERER.msaaSamples, depthBuffer: true });
    this.sceneTarget.depthTexture = new DepthTexture(this.size.x, this.size.y, renderer.reversedDepthBuffer ? FloatType : UnsignedIntType);
    this.post = new RenderPipeline(renderer);
    this.post.outputColorTransform = false;
    this.post.outputNode = renderOutput(texture(this.sceneTarget.texture), TONE_MAPPINGS[RENDERER.toneMapping], SRGBColorSpace);
  }

  render(scene: Scene, camera: Camera): void {
    const { renderer, size, sceneTarget } = this;
    renderer.getDrawingBufferSize(size);
    if (size.x !== sceneTarget.width || size.y !== sceneTarget.height) sceneTarget.setSize(size.x, size.y);
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(sceneTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    this.post.render();
  }

  dispose(): void {
    this.post.dispose();
    this.sceneTarget.dispose();
  }
}

let active: FramePipeline | null = null;

export function setActivePipeline(pipeline: FramePipeline | null): void {
  active = pipeline;
}

/**
 * Makes everything under `object` reachable by the compiler: no frustum culling and every
 * LOD level visible. Returns a function that restores the original state.
 */
function exposeAll(object: Object3D): () => void {
  const undo: (() => void)[] = [];
  object.traverse((o) => {
    if (o.frustumCulled) {
      o.frustumCulled = false;
      undo.push(() => {
        o.frustumCulled = true;
      });
    }
    const lod = o as Partial<LOD>;
    if (lod.isLOD && lod.levels) {
      const auto = lod.autoUpdate ?? true;
      lod.autoUpdate = false;
      undo.push(() => {
        lod.autoUpdate = auto;
      });
      for (const level of lod.levels) {
        const visible = level.object.visible;
        level.object.visible = true;
        undo.push(() => {
          level.object.visible = visible;
        });
      }
    }
  });
  return () => {
    for (const fn of undo) fn();
  };
}

/**
 * Compiles every pipeline an object needs (and uploads its geometry) before it is shown,
 * wherever the camera points and whichever LOD is active then, so it never stutters on
 * first sight. Compilation targets the scene target, where frames are drawn (pipelines
 * are keyed by render-target format). three.js gathers the work synchronously, so state
 * is restored straight after the call, then compiles object by object, yielding between.
 */
export async function precompile(renderer: WebGPURenderer, object: Object3D, camera: Camera, scene: Scene): Promise<void> {
  const previous = renderer.getRenderTarget();
  const restore = exposeAll(object);
  renderer.setRenderTarget(active?.sceneTarget ?? null);
  const done = renderer.compileAsync(object, camera, scene);
  renderer.setRenderTarget(previous);
  restore();
  await done;
}
