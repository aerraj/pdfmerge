import { Canvas } from '@react-three/fiber';
import { lazy, Suspense } from 'react';
import { CAMERA, IMAGE } from './config/render';
import { SHINJI } from './config/scale';
import { readLaunchOptions } from './core/launchOptions';
import { useGeoStore } from './core/store';
import { createRenderer } from './scene/createRenderer';
import { Experience } from './scene/Experience';
import { RenderLoop } from './scene/RenderLoop';

const launch = readLaunchOptions();
if (launch.startZone) useGeoStore.getState().setZone(launch.startZone);
// Dev-only test scenes; the constant condition lets Vite drop them from production.
const DevScene = import.meta.env.DEV ? lazy(() => import('./dev/scenes/DevScene')) : null;

export function App() {
  return (
    <Canvas
      flat
      dpr={[1, IMAGE.maxDevicePixelRatio]}
      camera={{ fov: CAMERA.fovDeg, near: CAMERA.nearM, far: CAMERA.farM, position: [0, SHINJI.eyeHeightM, 0], rotation: [0, 0, 0] }}
      gl={(defaults) => createRenderer(defaults.canvas as HTMLCanvasElement, launch)}
    >
      <RenderLoop />
      {DevScene && launch.devScene ? (
        <Suspense fallback={null}>
          <DevScene name={launch.devScene} />
        </Suspense>
      ) : (
        <Experience />
      )}
    </Canvas>
  );
}
