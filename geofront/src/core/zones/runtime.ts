import type { ZoneContent } from './zoneContent';
import type { ZoneStreamer } from './zoneStreamer';

let active: ZoneStreamer | null = null;

/** The streamer owned by the World component, for systems that read zone content. */
export function activeStreamer(): ZoneStreamer | null {
  return active;
}

export function setActiveStreamer(streamer: ZoneStreamer | null): void {
  active = streamer;
}

type ZoneListener = (zone: ZoneContent) => void;
const readyListeners = new Set<ZoneListener>();
const evictListeners = new Set<ZoneListener>();

/** Called when a zone is loaded, precompiled and attached (physics adds its colliders). */
export function onZoneReady(listener: ZoneListener): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

/** Called just before a zone is released. */
export function onZoneEvicted(listener: ZoneListener): () => void {
  evictListeners.add(listener);
  return () => evictListeners.delete(listener);
}

export function emitZoneReady(zone: ZoneContent): void {
  for (const l of readyListeners) l(zone);
}

export function emitZoneEvicted(zone: ZoneContent): void {
  for (const l of evictListeners) l(zone);
}
