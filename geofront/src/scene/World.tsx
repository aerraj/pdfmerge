import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ZONE_ROUTE } from '../config/world';
import type { ZoneId } from '../contracts/manifest';
import { useGeoStore } from '../core/store';
import { loadZone } from '../core/zones/loadZone';
import { planVisibility } from '../core/zones/residency';
import { setActiveStreamer } from '../core/zones/runtime';
import { ZoneStreamer } from '../core/zones/zoneStreamer';
import { getRenderer } from './createRenderer';
import { precompile } from './renderPipeline';

/**
 * Streams zones around the current one into the scene. Zones are precompiled before they
 * are attached, attached hidden, and shown only while they are the current zone or one
 * of its `alsoVisible` neighbours.
 */
export function World() {
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);

  useEffect(() => {
    const store = useGeoStore.getState;
    let s: ZoneStreamer | null = null;
    const refresh = () => {
      if (!s) return;
      store().setZoneStatus(s.status());
      const current = s.current;
      if (!current) return;
      const ready = new Set<ZoneId>(s.ready().map((z) => z.id));
      const visible = planVisibility(current, s.get(current)?.manifest.alsoVisible ?? [], ready);
      for (const z of s.ready()) z.root.visible = visible.has(z.id);
    };
    s = new ZoneStreamer(ZONE_ROUTE, loadZone, {
      prepare: async (content) => {
        const start = performance.now();
        await precompile(getRenderer(), content.root, get().camera, scene);
        performance.measure(`zone:compile:${content.id}`, { start });
        content.root.visible = false;
        scene.add(content.root);
      },
      onReady: refresh,
      onEvict: (content) => {
        scene.remove(content.root);
        queueMicrotask(refresh);
      },
      onError: (id, error) => {
        store().setZoneError({ id, message: error instanceof Error ? error.message : String(error) });
        refresh();
      },
    });
    setActiveStreamer(s);
    s.setCurrent(store().zone);
    const unsubscribe = useGeoStore.subscribe((state, previous) => {
      if (state.zone !== previous.zone) {
        s?.setCurrent(state.zone);
        refresh();
      }
    });
    return () => {
      unsubscribe();
      setActiveStreamer(null);
      s?.dispose();
      s = null;
    };
  }, [scene, get]);

  return null;
}
