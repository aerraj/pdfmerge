import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { MathUtils, type PerspectiveCamera } from 'three';
import { DEPTH_GAP, DEPTH_TEST_DISTANCES, STRIP_LAYOUT } from './depthTestLayout';

/**
 * T1.1 acceptance scene. Seven strips at 0.15 m to 10 km; each strip is a green quad with
 * a red quad a relative DEPTH_GAP behind it. The red quad draws second, so wherever depth
 * precision runs out it wins the tie and shows through: any red pixel is z-fighting.
 * A lit sphere below the strips checks that lighting and tone mapping match across
 * backends.
 */
export function DepthTestScene() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    camera.updateMatrixWorld();
  }, [camera]);

  const tanV = Math.tan(MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * (size.width / size.height);
  const centreY = (STRIP_LAYOUT.bottomY + STRIP_LAYOUT.topY) / 2;
  const heightNdc = STRIP_LAYOUT.topY - STRIP_LAYOUT.bottomY;

  return (
    <>
      <color attach="background" args={['#101418']} />
      <hemisphereLight args={['#d99a62', '#2c3036', 0.6]} />
      <directionalLight position={[3, 4, 2]} intensity={2.5} />
      {DEPTH_TEST_DISTANCES.map((d, i) => {
        const x = (STRIP_LAYOUT.firstX + i * STRIP_LAYOUT.stepX) * tanH;
        const w = STRIP_LAYOUT.width * tanH;
        const h = heightNdc * tanV;
        const y = centreY * tanV;
        const back = d * (1 + DEPTH_GAP);
        return (
          <group key={d}>
            <mesh position={[x * d, y * d, -d]} renderOrder={0}>
              <planeGeometry args={[w * d, h * d]} />
              <meshBasicMaterial color="#00ff00" />
            </mesh>
            <mesh position={[x * back, y * back, -back]} renderOrder={1}>
              <planeGeometry args={[w * back, h * back]} />
              <meshBasicMaterial color="#ff0000" />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, -1.1, -4]}>
        <sphereGeometry args={[0.8, 48, 24]} />
        <meshStandardMaterial color="#e8743b" roughness={0.45} metalness={0.1} />
      </mesh>
    </>
  );
}
