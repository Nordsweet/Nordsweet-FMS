import { z } from "zod";

import { type Flight, flightSchema } from "~/data/flight";
import { flightSnapshotSchema, trackPointSchema } from "~/data/flight-session";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import {
  settingsDefaults,
  settingsSchema,
  useSettings,
} from "~/stores/settings";

import { deviceLabel } from "./device";
import { type Adapter } from "./engine";
import { mergeFields } from "./merge";

const MAIN = "main";
const MAIN_IDS = [MAIN];
/** Newest GPS fixes sent along with the flight in progress; the full track stays on the device. */
const LIVE_TRACK_POINTS = 60;

// The typed `/me/settings` route (api/userdata) carries everything else. It has no field for the
// pilot's surname yet, so that one value still travels through the `settings` item.
const syncedSettings = settingsSchema.pick({ pilotSurname: true }).partial();

const settings: Adapter = {
  collection: "settings",
  version: 1,
  minIntervalMs: 2000,
  ids: async () => MAIN_IDS,
  get: async () => ({ pilotSurname: useSettings.getState().pilotSurname }),
  put: async (_, data) => useSettings.setState(data),
  remove: async () => undefined, // settings are never deleted
  parse: (data) => {
    const parsed = syncedSettings.safeParse(data);
    if (!parsed.success) return null;
    // Only what the item holds: a missing key keeps this device's value.
    return Object.fromEntries(
      Object.entries(parsed.data).filter(([key]) => Object.hasOwn(data, key)),
    );
  },
  merge: (base, local, remote) =>
    mergeFields(base, local, remote, "local", true),
  subscribe: (onChange) => useSettings.subscribe(onChange),
  clear: async () => useSettings.setState(settingsDefaults),
};

const draft: Adapter = {
  collection: "draft",
  version: 1,
  minIntervalMs: 3000,
  ids: async () => MAIN_IDS,
  get: async () => useFlight.getState().flight,
  put: async (_, data) => useFlight.getState().load(data as Flight),
  remove: async () => useFlight.getState().reset(),
  parse: (data) => {
    const parsed = flightSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
  merge: (base, local, remote) =>
    mergeFields(base, local, remote, "local", true),
  subscribe: (onChange) => useFlight.subscribe(onChange),
  clear: async () => useFlight.getState().reset(),
};

const liveSchema = flightSnapshotSchema.extend({
  track: z.array(trackPointSchema).default([]),
  deviceName: z.string().default(""),
});
export type LiveFlight = z.infer<typeof liveSchema>;

const liveFlight: Adapter = {
  collection: "live-flight",
  version: 1,
  ask: true,
  minIntervalMs: 10_000,
  ids: async () => (useInFlight.getState().startedAt ? ["current"] : []),
  get: async () => {
    const live = useInFlight.getState();
    const parsed = liveSchema.safeParse({
      flight: useFlight.getState().flight,
      inflight: live,
      track: live.track.slice(-LIVE_TRACK_POINTS),
      deviceName: deviceLabel(),
    });
    return live.startedAt && parsed.success ? parsed.data : undefined;
  },
  // Taking the flight over: same restore as continuing a flight after an interruption.
  put: async (_, data) => {
    const { flight, inflight, track } = data as LiveFlight;
    useFlight.getState().load(flight);
    useInFlight.setState({
      ...inflight,
      track,
      patternNotice:
        inflight.patternNotice && inflight.patternNotice.expiresAt > Date.now()
          ? inflight.patternNotice
          : null,
      patternPreviousFix: null,
    });
  },
  // The flight was finished on another device, which owns its debrief: just stop flying here.
  remove: async () =>
    useInFlight.setState({
      startedAt: null,
      holding: null,
      divertAirport: null,
      trafficPattern: null,
      departurePattern: null,
      patternNotice: null,
      patternPreviousFix: null,
    }),
  deleteWins: (base, local) =>
    (base as LiveFlight | null)?.inflight.startedAt ===
    (local as LiveFlight).inflight.startedAt,
  parse: (data) => {
    const parsed = liveSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
  merge: (_base, local) => local, // never merged: the pilot chooses
  subscribe: (onChange) => useInFlight.subscribe(onChange),
  clear: async () => adaptersByName["live-flight"].remove("current"),
};

const adaptersByName = {
  settings,
  draft,
  "live-flight": liveFlight,
};
export const syncAdapters: Adapter[] = Object.values(adaptersByName);
