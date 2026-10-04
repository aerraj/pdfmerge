import type * as RapierNs from '@dimforge/rapier3d-compat';

export type Rapier = typeof RapierNs;

let loading: Promise<Rapier> | null = null;

/** Loads and initialises Rapier once (WASM inlined in the compat build), on demand. */
export function loadRapier(): Promise<Rapier> {
  loading ??= import('@dimforge/rapier3d-compat').then(async (m) => {
    await m.init();
    return m;
  });
  return loading;
}
