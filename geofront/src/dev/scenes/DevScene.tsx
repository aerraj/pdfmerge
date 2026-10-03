import { DepthTestScene } from './DepthTestScene';
import { DEV_SCENE_MARKER } from './depthTestLayout';

/** Developer test scenes, selected with ?devScene=<name> in dev builds. */
export default function DevScene({ name }: { name: string }) {
  switch (name) {
    case 'depth':
      return (
        <group name={DEV_SCENE_MARKER}>
          <DepthTestScene />
        </group>
      );
    default:
      return null;
  }
}
