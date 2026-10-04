import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { MathUtils, type PerspectiveCamera } from 'three';
import { SHINJI } from '../../config/scale';
import { ZoneIdSchema } from '../../contracts/manifest';
import { loadZone } from '../../core/zones/loadZone';
import type { ZoneContent } from '../../core/zones/zoneContent';
import { GreyboxLights } from '../../scene/GreyboxLights';
import { reportZone } from '../devHooks';

/** Shows one zone from its spawn point: ?devScene=zone&zone=z3-cavern. */
export function ZoneViewer() {
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);
  const [zone, setZone] = useState<ZoneContent | null>(null);

  useEffect(() => {
    const id = ZoneIdSchema.parse(new URLSearchParams(window.location.search).get('zone') ?? 'z1-surface');
    const controller = new AbortController();
    let loaded: ZoneContent | null = null;
    loadZone(id, controller.signal)
      .then((content) => {
        loaded = content;
        setZone(content);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) reportZone({ id, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      controller.abort();
      loaded?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!zone) return;
    const camera = get().camera as PerspectiveCamera;
    scene.add(zone.root);
    const params = new URLSearchParams(window.location.search);
    const at = zone.pois.get(params.get('poi') ?? '');
    if (at) {
      at.getWorldPosition(camera.position);
      camera.position.y += SHINJI.eyeHeightM;
      at.getWorldQuaternion(camera.quaternion);
    } else {
      const [x, y, z] = zone.manifest.spawn.position;
      const pitch = Number(params.get('pitch') ?? 0);
      const yaw = Number(params.get('yaw') ?? zone.manifest.spawn.yawDeg);
      camera.position.set(x, y + SHINJI.eyeHeightM, z);
      camera.rotation.set(MathUtils.degToRad(pitch), MathUtils.degToRad(yaw), 0, 'YXZ');
    }
    camera.updateMatrixWorld();
    reportZone({
      id: zone.id,
      colliders: zone.colliders.map((c) => ({ name: c.name, triangles: c.indices.length / 3 })),
      pois: [...zone.pois.keys()],
      triggers: [...zone.triggers.keys()],
      screens: [...zone.screens.keys()],
      lights: [...zone.lights.keys()],
    });
    return () => {
      scene.remove(zone.root);
    };
  }, [zone, scene, get]);

  return <GreyboxLights />;
}
