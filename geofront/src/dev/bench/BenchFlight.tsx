import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { stepCriticalSpring, nearestAngleDeg, type Spring } from '../../camera/springs';
import { BENCH } from '../../config/budgets';
import { SHINJI } from '../../config/scale';
import { ZONE_ROUTE } from '../../config/world';
import type { ZoneId } from '../../contracts/manifest';
import { simulation } from '../../core/simulation';
import { useGeoStore } from '../../core/store';
import { activeStreamer } from '../../core/zones/runtime';
import type { ZoneContent } from '../../core/zones/zoneContent';
import { ZONE_ROUTES } from '../routes';
import { benchRecorder } from './benchRunner';

const MS_PER_SEC = 1000;

interface ZoneFlight {
  curve: CatmullRomCurve3;
  length: number;
  speed: number;
  /** Pauses along the path: distance along the curve and duration. */
  lingers: { at: number; sec: number }[];
}

interface FlightState {
  phase: 'boot' | 'waiting' | 'flying' | 'done';
  zoneIndex: number;
  flight: ZoneFlight | null;
  distance: number;
  lingerLeft: number;
  nextLinger: number;
  phaseStart: number;
  yaw: Spring;
  pitch: Spring;
}

const eye = (p: Vector3) => p.setY(p.y + SHINJI.eyeHeightM);

/** Builds the flight through a zone: spawn → route waypoints, at Shinji's eye height. */
function planFlight(zone: ZoneContent): ZoneFlight {
  const [sx, sy, sz] = zone.manifest.spawn.position;
  const points = [eye(new Vector3(sx, sy, sz))];
  const lingerAfter: number[] = [0];
  for (const name of ZONE_ROUTES[zone.id]) {
    const trigger = zone.triggers.get(name);
    const poi = zone.pois.get(name);
    if (trigger) points.push(eye(new Vector3(trigger.centre.x, trigger.bottomY, trigger.centre.z)));
    else if (poi) points.push(eye(poi.getWorldPosition(new Vector3())));
    else continue;
    const listed = zone.manifest.pois.find((p) => p.node === name);
    lingerAfter.push(Math.min(listed?.lingerSec ?? 0, BENCH.flightMaxLingerSec));
  }
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const length = curve.getLength();
  const duration = MathUtils.clamp(length / BENCH.flightSpeedMps, BENCH.flightMinZoneSec, BENCH.flightMaxZoneSec);
  // Distance of each control point along the curve, for the pauses.
  const lengths = curve.getLengths(points.length * 64);
  const lingers = points
    .map((_, i) => ({ at: lengths[Math.round((i / (points.length - 1)) * (lengths.length - 1))] ?? 0, sec: lingerAfter[i] ?? 0 }))
    .filter((l) => l.sec > 0);
  return { curve, length, speed: length / duration, lingers };
}

/**
 * pnpm bench flight (bench builds only): boot segment at the first spawn, then one segment
 * per zone along the route, driving the real zone streamer through every transition.
 */
export function BenchFlight() {
  const get = useThree((s) => s.get);
  const state = useRef<FlightState>({
    phase: 'boot',
    zoneIndex: 0,
    flight: null,
    distance: 0,
    lingerLeft: 0,
    nextLinger: 0,
    phaseStart: 0,
    yaw: { x: 0, v: 0 },
    pitch: { x: 0, v: 0 },
  });
  const tangent = new Vector3();

  useFrame((_, delta) => {
    const s = state.current;
    const now = performance.now();
    const streamer = activeStreamer();
    const zoneId: ZoneId | undefined = ZONE_ROUTE[s.zoneIndex];
    if (!streamer || !zoneId || s.phase === 'done') return;

    if (s.phase === 'boot') {
      // The player rig spawns Shinji; once standing, measure the boot segment, then fly.
      if (s.phaseStart === 0) {
        if (streamer.get(zoneId) === undefined) return;
        s.phaseStart = now;
        benchRecorder.begin('boot');
        return;
      }
      if (now - s.phaseStart < BENCH.bootSegmentSec * MS_PER_SEC) return;
      simulation.cameraOwner = 'external';
      s.phase = 'waiting';
      s.phaseStart = now;
      benchRecorder.begin(zoneId);
      benchRecorder.annotate({ readyOnArrival: true, waitMs: 0 });
    }

    const zone = streamer.get(zoneId);
    if (s.phase === 'waiting') {
      if (!zone) return;
      s.flight = planFlight(zone);
      s.distance = 0;
      s.nextLinger = 0;
      s.lingerLeft = 0;
      s.phase = 'flying';
      benchRecorder.annotate({ waitMs: now - s.phaseStart });
      const start = s.flight.curve.getTangentAt(0, tangent);
      s.yaw = { x: MathUtils.radToDeg(Math.atan2(-start.x, -start.z)), v: 0 };
      s.pitch = { x: 0, v: 0 };
    }
    const f = s.flight;
    if (!f) return;

    // Advance along the path, pausing at points of interest.
    if (s.lingerLeft > 0) s.lingerLeft -= delta;
    else {
      s.distance = Math.min(f.length, s.distance + f.speed * delta);
      const pause = f.lingers[s.nextLinger];
      if (pause && s.distance >= pause.at) {
        s.distance = pause.at;
        s.lingerLeft = pause.sec;
        s.nextLinger += 1;
      }
    }
    const u = f.length > 0 ? s.distance / f.length : 1;
    const camera = get().camera;
    f.curve.getPointAt(u, camera.position);
    f.curve.getTangentAt(Math.min(u, 1), tangent);
    const targetYaw = MathUtils.radToDeg(Math.atan2(-tangent.x, -tangent.z));
    const targetPitch = MathUtils.clamp(MathUtils.radToDeg(Math.asin(MathUtils.clamp(tangent.y, -1, 1))), -BENCH.flightMaxPitchDeg, BENCH.flightMaxPitchDeg);
    stepCriticalSpring(s.yaw, nearestAngleDeg(s.yaw.x, targetYaw), BENCH.flightLookHalfLifeSec, delta);
    stepCriticalSpring(s.pitch, targetPitch, BENCH.flightLookHalfLifeSec, delta);
    camera.rotation.set(MathUtils.degToRad(s.pitch.x), MathUtils.degToRad(s.yaw.x), 0, 'YXZ');
    camera.updateMatrixWorld();

    if (s.distance < f.length || s.lingerLeft > 0) return;
    // End of the zone: hand over to the next one, as the transition trigger would.
    const next = ZONE_ROUTE[s.zoneIndex + 1];
    if (!next) {
      s.phase = 'done';
      benchRecorder.finish();
      return;
    }
    const ready = streamer.get(next) !== undefined;
    s.zoneIndex += 1;
    s.phase = 'waiting';
    s.phaseStart = now;
    s.flight = null;
    benchRecorder.begin(next);
    benchRecorder.annotate({ readyOnArrival: ready, waitMs: 0 });
    useGeoStore.getState().setZone(next);
  });

  return null;
}
