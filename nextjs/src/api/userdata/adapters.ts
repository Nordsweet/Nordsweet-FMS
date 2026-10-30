import { z } from "zod";

import { type Flight, flightSchema } from "~/data/flight";
import { type AircraftDraft } from "~/domain/custom-aircraft";

import {
  readCustomDrafts,
  subscribeCustomDrafts,
  writeCustomDrafts,
} from "../aircraft";
import {
  flightIds,
  getFlight,
  putFlight,
  removeFlight,
  subscribeFlights,
} from "../flights";
import { type Adapter } from "../sync/engine";
import { mergeFields } from "../sync/merge";

/**
 * Local working copies of the two document collections. A device that never synced an item adopts
 * the server's copy (the server is the system of record); after that, fields changed on both sides
 * keep the local value.
 */
export const flights: Adapter = {
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
  merge: (base, local, remote) =>
    mergeFields(base, local, remote, "local", true),
  subscribe: (onChange) => subscribeFlights(onChange),
  clear: async () => {
    for (const id of await flightIds()) await removeFlight(id);
  },
};

const draftSchema = z.looseObject({ type: z.string() });
const drafts = () => readCustomDrafts().filter((d) => d.id);

export const customAircraft: Adapter = {
  collection: "custom-aircraft",
  version: 1,
  minIntervalMs: 500,
  ids: async () => drafts().map((d) => d.id!),
  get: async (id) => drafts().find((d) => d.id === id),
  put: async (id, data) => {
    const draft = { ...data, id } as unknown as AircraftDraft;
    const all = readCustomDrafts();
    const at = all.findIndex((d) => d.id === id);
    writeCustomDrafts(
      at < 0 ? [...all, draft] : all.map((d, i) => (i === at ? draft : d)),
    );
  },
  remove: async (id) =>
    writeCustomDrafts(readCustomDrafts().filter((d) => d.id !== id)),
  parse: (data) => {
    const parsed = draftSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
  merge: (base, local, remote) =>
    mergeFields(base, local, remote, "local", true),
  subscribe: (onChange) => subscribeCustomDrafts(onChange),
  clear: async () => writeCustomDrafts([]),
};

export const adaptersByCollection = {
  flights,
  "custom-aircraft": customAircraft,
} as const;
export const documentAdapters: Adapter[] = Object.values(adaptersByCollection);
