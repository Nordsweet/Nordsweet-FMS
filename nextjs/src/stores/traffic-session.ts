import { create } from "zustand";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import {
  appendTrafficSample,
  type TrafficSample,
} from "~/domain/traffic-history";

/** At most this many aircraft keep a history (each can hold 1440 samples); the longest unseen go first. */
export const MAX_TRACKED_AIRCRAFT = 300;
const MAX_AGE_MS = 6 * 3600000;

/** The histories after one poll: new samples appended, stale aircraft dropped, the count capped. */
export function observeTraffic(
  previous: Map<string, TrafficSample[]>,
  aircraft: TrafficAircraft[],
  now = Date.now(),
) {
  const histories = new Map(previous);
  for (const a of aircraft) {
    const sampledAt = Date.parse(a.position_time);
    if (!Number.isFinite(sampledAt)) continue;
    histories.set(
      a.hex,
      appendTrafficSample(histories.get(a.hex) ?? [], {
        lat: a.lat,
        lon: a.lon,
        sampledAt,
        callsign: a.callsign?.trim().toUpperCase().replace(/\s+/g, "") ?? "",
      }),
    );
  }
  const seen = (history: TrafficSample[]) => history.at(-1)?.sampledAt ?? 0;
  for (const [hex, history] of histories)
    if (seen(history) < now - MAX_AGE_MS) histories.delete(hex);
  if (histories.size > MAX_TRACKED_AIRCRAFT)
    [...histories]
      .sort((a, b) => seen(a[1]) - seen(b[1]))
      .slice(0, histories.size - MAX_TRACKED_AIRCRAFT)
      .forEach(([hex]) => histories.delete(hex));
  return histories;
}

type TrafficSession = {
  histories: Map<string, TrafficSample[]>;
  observe: (aircraft: TrafficAircraft[]) => void;
};
/** Observation history outlives map mounts; it is never restored as live traffic after a reload. */
export const useTrafficSession = create<TrafficSession>()((set) => ({
  histories: new Map(),
  observe: (aircraft) =>
    set((state) => ({ histories: observeTraffic(state.histories, aircraft) })),
}));
