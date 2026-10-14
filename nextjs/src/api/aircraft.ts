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

export function readCustomAircraft(): Aircraft[] {
  return readCustomDrafts().flatMap((draft) => {
    const built = buildAircraft(draft, []);
    return built.ok ? [built.aircraft] : [];
  });
}

/** Bundled profiles plus the pilot's own: the one list every planner component reads. */
export async function loadAircraft(): Promise<Aircraft[]> {
  return [...(await loadDataset("aircraft")), ...readCustomAircraft()];
}
