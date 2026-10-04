import { GREYBOX_LIGHTS } from '../config/render';

const KEY_DISTANCE_M = 100;

/** Flat greybox lighting until per-zone environments exist. */
export function GreyboxLights() {
  const [x, y, z] = GREYBOX_LIGHTS.keyDirection;
  return (
    <>
      <color attach="background" args={[GREYBOX_LIGHTS.background]} />
      <hemisphereLight args={[GREYBOX_LIGHTS.skyColor, GREYBOX_LIGHTS.groundColor, GREYBOX_LIGHTS.hemisphereIntensity]} />
      <directionalLight position={[x * KEY_DISTANCE_M, y * KEY_DISTANCE_M, z * KEY_DISTANCE_M]} intensity={GREYBOX_LIGHTS.keyIntensity} />
    </>
  );
}
