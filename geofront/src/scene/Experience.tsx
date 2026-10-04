import { lazy, Suspense } from 'react';
import { PlayerRig } from '../camera/PlayerRig';
import { GreyboxLights } from './GreyboxLights';
import { World } from './World';

// Bench builds fly the route; the constant condition keeps it out of production bundles.
const BenchFlight = import.meta.env.MODE === 'bench' ? lazy(() => import('../dev/bench/BenchFlight').then((m) => ({ default: m.BenchFlight }))) : null;

/** Everything the visitor experiences inside the canvas. */
export function Experience() {
  return (
    <>
      <GreyboxLights />
      <World />
      <PlayerRig />
      {BenchFlight ? (
        <Suspense fallback={null}>
          <BenchFlight />
        </Suspense>
      ) : null}
    </>
  );
}
