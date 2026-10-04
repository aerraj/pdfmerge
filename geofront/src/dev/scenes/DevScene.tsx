import { DepthTestScene } from './DepthTestScene';
import { DEV_SCENE_MARKER } from './depthTestLayout';
import { ZoneViewer } from './ZoneViewer';

/** Developer test scenes, selected with ?devScene=<name> in dev builds. */
export default function DevScene({ name }: { name: string }) {
  switch (name) {
    case 'depth':
      return (
        <group name={DEV_SCENE_MARKER}>
          <DepthTestScene />
        </group>
      );
    case 'zone':
      return (
        <group name={DEV_SCENE_MARKER}>
          <ZoneViewer />
        </group>
      );
    default:
      return null;
  }
}
