import { type Aircraft } from "~/data/aircraft";
import { type AircraftDraft, buildAircraft } from "~/domain/custom-aircraft";

import { loadDataset } from "./datasets";

const KEY = "nordsweet.customAircraft.v1";

/** Aircraft the pilot entered, as form drafts (the profile is rebuilt from them on every load). */
export function readCustomDrafts(): AircraftDraft[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? (value as AircraftDraft[]) : [];
  } catch {
    return [];
  }
}

export function writeCustomDrafts(drafts: AircraftDraft[]) {
  localStorage.setItem(KEY, JSON.stringify(drafts));
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
