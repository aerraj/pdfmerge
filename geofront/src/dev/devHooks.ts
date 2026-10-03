import { framesRendered } from '../core/frameStats';
import { useGeoStore } from '../core/store';

/** Read-only handles for end-to-end tests. Dev builds only. */
export interface DevHooks {
  getState: typeof useGeoStore.getState;
  framesRendered: typeof framesRendered;
}

export const DEV_HOOKS_GLOBAL = '__GEOFRONT__';

export function installDevHooks(): void {
  const hooks: DevHooks = { getState: useGeoStore.getState, framesRendered };
  Object.assign(window, { [DEV_HOOKS_GLOBAL]: hooks });
}
