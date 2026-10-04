import type { ZoneStreamer } from './zoneStreamer';

let active: ZoneStreamer | null = null;

/** The streamer owned by the World component, for systems that read zone content. */
export function activeStreamer(): ZoneStreamer | null {
  return active;
}

export function setActiveStreamer(streamer: ZoneStreamer | null): void {
  active = streamer;
}
