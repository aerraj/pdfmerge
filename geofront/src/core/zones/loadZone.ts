import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { STREAMING_BUDGET } from '../../config/budgets';
import { ZoneManifestSchema, type ZoneId, type ZoneManifest } from '../../contracts/manifest';
import { buildZoneContent, type ZoneContent } from './zoneContent';

let loader: GLTFLoader | null = null;

function gltfLoader(): GLTFLoader {
  if (!loader) {
    // Not a React hook: the decoder's API happens to start with "use".
    // eslint-disable-next-line react-hooks/rules-of-hooks
    MeshoptDecoder.useWorkers(STREAMING_BUDGET.decoderWorkers);
    loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

export function zoneFileUrl(id: ZoneId, file: string): string {
  return `${import.meta.env.BASE_URL}zones/${id}/${file}`;
}

async function fetchOk(url: string, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`GeoFront: ${url} → HTTP ${res.status}`);
  return res;
}

export async function loadManifest(id: ZoneId, signal?: AbortSignal): Promise<ZoneManifest> {
  const res = await fetchOk(zoneFileUrl(id, 'manifest.json'), signal);
  return ZoneManifestSchema.parse(await res.json());
}

/** Fetches a zone's manifest and GLB and builds its runtime content. */
export async function loadZone(id: ZoneId, signal?: AbortSignal): Promise<ZoneContent> {
  const manifest = await loadManifest(id, signal);
  const glbUrl = zoneFileUrl(id, manifest.glb);
  const buffer = await (await fetchOk(glbUrl, signal)).arrayBuffer();
  signal?.throwIfAborted();
  // performance.measure entries make each streaming phase visible in profiles and tests.
  const parseStart = performance.now();
  const gltf = await gltfLoader().parseAsync(buffer, glbUrl.slice(0, glbUrl.lastIndexOf('/') + 1));
  performance.measure(`zone:parse:${id}`, { start: parseStart });
  signal?.throwIfAborted();
  const buildStart = performance.now();
  const content = buildZoneContent(id, manifest, gltf.scene);
  performance.measure(`zone:build:${id}`, { start: buildStart });
  return content;
}
