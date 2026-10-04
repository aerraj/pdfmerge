import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { MathUtils } from 'three';
import { SHINJI } from '../config/scale';
import { useGeoStore } from '../core/store';
import { activeStreamer } from '../core/zones/runtime';

/**
 * Puts the camera at the current zone's spawn, at Shinji's eye height, once the zone is
 * ready. Stands in for the free-roam controller until T1.4.
 */
export function SpawnCamera() {
  const get = useThree((s) => s.get);
  const zone = useGeoStore((s) => s.zone);
  const ready = useGeoStore((s) => s.zoneStatus[s.zone] === 'ready');

  useEffect(() => {
    if (!ready) return;
    const content = activeStreamer()?.get(zone);
    if (!content) return;
    const camera = get().camera;
    const [x, y, z] = content.manifest.spawn.position;
    camera.position.set(x, y + SHINJI.eyeHeightM, z);
    camera.rotation.set(0, MathUtils.degToRad(content.manifest.spawn.yawDeg), 0, 'YXZ');
    camera.updateMatrixWorld();
  }, [zone, ready, get]);

  return null;
}
