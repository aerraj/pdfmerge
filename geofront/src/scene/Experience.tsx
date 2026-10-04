import { PlayerRig } from '../camera/PlayerRig';
import { GreyboxLights } from './GreyboxLights';
import { World } from './World';

/** Everything the visitor experiences inside the canvas. */
export function Experience() {
  return (
    <>
      <GreyboxLights />
      <World />
      <PlayerRig />
    </>
  );
}
