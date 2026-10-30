import { type Aircraft } from "~/data/aircraft";
import {
  type AircraftDraft,
  buildAircraft,
  emptyDraft,
} from "~/domain/custom-aircraft";

import { loadDataset } from "./datasets";

const KEY = "nordsweet.customAircraft.v1";

/** Aircraft the pilot entered, as form drafts (the profile is rebuilt from them on every load). */
export function readCustomDrafts(): AircraftDraft[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Drafts saved before a field existed get its empty default.
    const drafts = Array.isArray(value)
      ? (value as AircraftDraft[]).map((d) => ({
          ...emptyDraft(),
          ...d,
          // The first flap-speed layout was an object of two tables.
          ...(Array.isArray(d.flapSpeeds)
            ? {}
            : { flapSpeeds: emptyDraft().flapSpeeds }),
        }))
      : [];
    // Drafts predating the server's per-aircraft rows get their id now, so it never changes later.
    if (drafts.some((d) => !d.id)) {
      const identified = withIds(drafts);
      localStorage.setItem(KEY, JSON.stringify(identified));
      return identified;
    }
    return drafts;
  } catch {
    return [];
  }
}

/** The id the server stores a draft under; minted once, kept beside the draft. */
const withIds = (drafts: AircraftDraft[]) =>
  drafts.map((d) => (d.id ? d : { ...d, id: crypto.randomUUID() }));

const listeners = new Set<() => void>();
/** Called after the drafts change, here or in another tab of the same browser. */
export function subscribeCustomDrafts(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeCustomDrafts(drafts: AircraftDraft[]) {
  localStorage.setItem(KEY, JSON.stringify(withIds(drafts)));
  listeners.forEach((l) => l());
}

/** Bundled profiles (with the pilot's edits applied by id) plus the pilot's own: the one list every planner component reads. */
export async function loadAircraft(): Promise<Aircraft[]> {
  const drafts = readCustomDrafts();
  const overrides = new Map(
    drafts.flatMap((d) => (d.baseId ? [[d.baseId, d] as const] : [])),
  );
  const builtIn = (await loadDataset("aircraft")).map((a) => {
    const override = overrides.get(a.id);
    const built = override && buildAircraft(override, [], a);
    return built?.ok ? built.aircraft : a;
  });
  const own = drafts.flatMap((d) => {
    const built = d.baseId ? null : buildAircraft(d, []);
    return built?.ok ? [built.aircraft] : [];
  });
  return [...builtIn, ...own];
}
