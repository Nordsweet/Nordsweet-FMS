import { z } from "zod";

import { type Flight, flightSchema } from "~/data/flight";
import { flightSnapshotSchema, trackPointSchema } from "~/data/flight-session";
import { type AircraftDraft } from "~/domain/custom-aircraft";
import { useAircraftState } from "~/stores/aircraft-state";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import {
  settingsDefaults,
  settingsSchema,
  useSettings,
} from "~/stores/settings";

import {
  readCustomDrafts,
  subscribeCustomDrafts,
  writeCustomDrafts,
} from "../aircraft";
import { flightIds, getFlight, putFlight, subscribeFlights } from "../flights";
import { removeFlight } from "../flights";
import { deviceLabel } from "./device";
import { type Adapter } from "./engine";
import { mergeFields, mergeRecords, type Obj } from "./merge";

const MAIN = "main";
const MAIN_IDS = [MAIN];
/** Newest GPS fixes sent along with the flight in progress; the full track stays on the device. */
const LIVE_TRACK_POINTS = 60;

// Voice URIs name voices installed on one device, so they never leave it.
const syncedSettings = settingsSchema.omit({ checklistVoiceUris: true });

const settings: Adapter = {
  collection: "settings",
  version: 1,
  minIntervalMs: 2000,
  ids: async () => MAIN_IDS,
  get: async () => {
    const {
      language,
      pilotSurname,
      homeAirportIcao,
      pilotWeightKg,
      atisAutoscroll,
      checklistAutoscroll,
      checklistVoiceGender,
    } = useSettings.getState();
    return {
      language,
      pilotSurname,
      homeAirportIcao,
      pilotWeightKg,
      atisAutoscroll,
      checklistAutoscroll,
      checklistVoiceGender,
    };
  },
  put: async (_, data) => useSettings.setState(data),
  remove: async () => undefined, // settings are never deleted
  parse: (data) => {
    const parsed = syncedSettings.partial().safeParse(data);
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

const airframeSchema = z.object({
  fuelIndicationMode: z.enum(["exact", "estimated"]).nullable(),
  mth: z.string(),
  fuelRemainingL: z.number().nullable(),
  fuelAddedL: z.number().nullable(),
  fuelUsedL: z.number().nullable(),
  updatedAt: z.number().nullable(),
});
type Airframe = z.infer<typeof airframeSchema>;
const aircraftStateSchema = z.object({
  states: z.record(z.string(), airframeSchema),
});

const aircraftState: Adapter = {
  collection: "aircraft-state",
  version: 1,
  minIntervalMs: 2000,
  ids: async () =>
    Object.keys(useAircraftState.getState().states).length ? MAIN_IDS : [],
  get: async () => ({ states: useAircraftState.getState().states }),
  put: async (_, data) =>
    useAircraftState.setState({
      states: (data as { states: Record<string, Airframe> }).states,
    }),
  remove: async () => useAircraftState.setState({ states: {} }),
  parse: (data) => {
    const parsed = aircraftStateSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
  // Per airframe; when both devices changed one, the later recorded reading wins (a tie goes to the server's).
  merge: (base, local, remote) => ({
    states: mergeRecords(
      (base as { states: Record<string, Airframe> } | null)?.states ?? null,
      (local as { states: Record<string, Airframe> }).states,
      (remote as { states: Record<string, Airframe> }).states,
      (l, r) => ((l.updatedAt ?? 0) > (r.updatedAt ?? 0) ? l : r),
    ),
  }),
  subscribe: (onChange) => useAircraftState.subscribe(onChange),
  clear: async () => useAircraftState.setState({ states: {} }),
};

const draftKey = (draft: AircraftDraft, taken: Set<string>) => {
  const base = draft.baseId ?? `own:${draft.type}`;
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}#${n}`;
  taken.add(key);
  return key;
};
const draftsByKey = (data: Obj | null) => {
  const taken = new Set<string>();
  return Object.fromEntries(
    ((data?.drafts ?? []) as AircraftDraft[]).map((d) => [
      draftKey(d, taken),
      d,
    ]),
  );
};
const customAircraft: Adapter = {
  collection: "custom-aircraft",
  version: 1,
  minIntervalMs: 2000,
  ids: async () => (readCustomDrafts().length ? MAIN_IDS : []),
  get: async () => ({ drafts: readCustomDrafts() }),
  put: async (_, data) =>
    writeCustomDrafts((data as { drafts: AircraftDraft[] }).drafts),
  remove: async () => writeCustomDrafts([]),
  parse: (data) => {
    const parsed = z
      .object({ drafts: z.array(z.looseObject({ type: z.string() })) })
      .safeParse(data);
    return parsed.success ? parsed.data : null;
  },
  // Per aircraft (the built-in it overrides, else its type); a draft edited on both devices keeps the local one.
  merge: (base, local, remote) => ({
    drafts: Object.values(
      mergeRecords(
        base ? draftsByKey(base) : null,
        draftsByKey(local),
        draftsByKey(remote),
        (l) => l,
      ),
    ),
  }),
  subscribe: (onChange) => subscribeCustomDrafts(onChange),
  clear: async () => writeCustomDrafts([]),
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

const flights: Adapter = {
  collection: "flights",
  version: 1,
  minIntervalMs: 500,
  ids: flightIds,
  get: async (id) => getFlight(id),
  put: async (_, data) => putFlight(data as Flight),
  remove: async (id) => removeFlight(id),
  parse: (data) => {
    const parsed = flightSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
  // One item per flight, so conflicts are rare: take both sides' edits, the local one on the same field.
  merge: (base, local, remote) => mergeFields(base, local, remote, "local"),
  subscribe: (onChange) => subscribeFlights(onChange),
  clear: async () => {
    for (const id of await flightIds()) await removeFlight(id);
  },
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
  "aircraft-state": aircraftState,
  "custom-aircraft": customAircraft,
  draft,
  flights,
  "live-flight": liveFlight,
};
export const syncAdapters: Adapter[] = Object.values(adaptersByName);
