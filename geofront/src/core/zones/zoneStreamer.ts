import type { ZoneId } from '../../contracts/manifest';
import { planResidency } from './residency';
import type { ZoneContent } from './zoneContent';

export type ZoneLoader = (id: ZoneId, signal: AbortSignal) => Promise<ZoneContent>;

export interface StreamerHooks {
  /** Runs after a zone loads and before it counts as ready (shader precompile, physics). */
  prepare?: (zone: ZoneContent, signal: AbortSignal) => Promise<void>;
  onReady?: (zone: ZoneContent) => void;
  /** Called before the streamer releases a zone; the hook detaches it from the scene. */
  onEvict?: (zone: ZoneContent) => void;
  onError?: (id: ZoneId, error: unknown) => void;
}

type Entry =
  | { state: 'loading'; controller: AbortController; promise: Promise<ZoneContent | null> }
  | { state: 'ready'; content: ZoneContent };

/**
 * Keeps the zones around the visitor in memory (see planResidency): loads the current zone
 * first, then prefetches the next, aborts loads that are no longer wanted and disposes
 * zones that fall out of the window. Framework-free so it can be unit tested.
 */
export class ZoneStreamer {
  private readonly entries = new Map<ZoneId, Entry>();
  private readonly route: readonly ZoneId[];
  private readonly loader: ZoneLoader;
  private readonly hooks: StreamerHooks;
  private currentId: ZoneId | null = null;
  private disposed = false;

  constructor(route: readonly ZoneId[], loader: ZoneLoader, hooks: StreamerHooks = {}) {
    this.route = route;
    this.loader = loader;
    this.hooks = hooks;
  }

  get current(): ZoneId | null {
    return this.currentId;
  }

  /** Moves the visitor to a zone and updates what is loaded. */
  setCurrent(id: ZoneId): void {
    if (this.disposed) return;
    this.currentId = id;
    const plan = planResidency(this.route, id);
    for (const zoneId of [...this.entries.keys()]) if (!plan.keep.has(zoneId)) this.evict(zoneId);
    // Sequential: the current zone gets the bandwidth, then the next one is prefetched.
    void plan.load.reduce<Promise<unknown>>((chain, zoneId) => chain.then(() => this.ensure(zoneId)), Promise.resolve());
  }

  /** Loads a zone if it is not already loaded or loading. Resolves null if evicted first. */
  ensure(id: ZoneId): Promise<ZoneContent | null> {
    const existing = this.entries.get(id);
    if (existing) return existing.state === 'ready' ? Promise.resolve(existing.content) : existing.promise;
    const controller = new AbortController();
    const promise = this.load(id, controller);
    this.entries.set(id, { state: 'loading', controller, promise });
    return promise;
  }

  get(id: ZoneId): ZoneContent | undefined {
    const e = this.entries.get(id);
    return e?.state === 'ready' ? e.content : undefined;
  }

  ready(): ZoneContent[] {
    return [...this.entries.values()].flatMap((e) => (e.state === 'ready' ? [e.content] : []));
  }

  status(): Partial<Record<ZoneId, 'loading' | 'ready'>> {
    return Object.fromEntries([...this.entries].map(([id, e]) => [id, e.state]));
  }

  dispose(): void {
    this.disposed = true;
    for (const id of [...this.entries.keys()]) this.evict(id);
  }

  private async load(id: ZoneId, controller: AbortController): Promise<ZoneContent | null> {
    let content: ZoneContent | null = null;
    // A function, so TypeScript does not narrow the flag across awaits.
    const aborted = () => controller.signal.aborted;
    try {
      content = await this.loader(id, controller.signal);
      if (aborted()) {
        content.dispose();
        return null;
      }
      await this.hooks.prepare?.(content, controller.signal);
      if (aborted()) {
        this.hooks.onEvict?.(content);
        content.dispose();
        return null;
      }
      this.entries.set(id, { state: 'ready', content });
      this.hooks.onReady?.(content);
      return content;
    } catch (error) {
      if (!controller.signal.aborted) {
        this.entries.delete(id);
        this.hooks.onError?.(id, error);
      }
      content?.dispose();
      return null;
    }
  }

  private evict(id: ZoneId): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.entries.delete(id);
    if (e.state === 'loading') {
      e.controller.abort();
      return;
    }
    this.hooks.onEvict?.(e.content);
    e.content.dispose();
  }
}
