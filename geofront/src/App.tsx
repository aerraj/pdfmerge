import { Canvas } from '@react-three/fiber';
import { FrameProbe } from './scene/FrameProbe';

export function App() {
  return (
    <Canvas>
      <FrameProbe />
    </Canvas>
  );
}
