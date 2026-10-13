import { create } from "zustand";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import {
  appendTrafficSample,
  type TrafficSample,
} from "~/domain/traffic-history";

type TrafficSession = {
  histories: Map<string, TrafficSample[]>;
  observe: (aircraft: TrafficAircraft[]) => void;
};
/** Observation history outlives map mounts; it is never restored as live traffic after a reload. */
export const useTrafficSession = create<TrafficSession>()((set) => ({
  histories: new Map(),
  observe: (aircraft) =>
    set((state) => {
      const histories = new Map(state.histories);
      for (const a of aircraft) {
        const sampledAt = Date.parse(a.position_time);
        if (!Number.isFinite(sampledAt)) continue;
        histories.set(
          a.hex,
          appendTrafficSample(histories.get(a.hex) ?? [], {
            lat: a.lat,
            lon: a.lon,
            sampledAt,
            callsign:
              a.callsign?.trim().toUpperCase().replace(/\s+/g, "") ?? "",
          }),
        );
      }
      for (const [hex, history] of histories)
        if ((history.at(-1)?.sampledAt ?? 0) < Date.now() - 6 * 3600000)
          histories.delete(hex);
      return { histories };
    }),
}));
