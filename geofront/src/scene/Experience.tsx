import { GreyboxLights } from './GreyboxLights';
import { SpawnCamera } from './SpawnCamera';
import { World } from './World';

/** Everything the visitor experiences inside the canvas. */
export function Experience() {
  return (
    <>
      <GreyboxLights />
      <World />
      <SpawnCamera />
    </>
  );
}
