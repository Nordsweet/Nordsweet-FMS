import { type Debrief } from "~/data/debrief";

export type DebriefError =
  "mthRequired" | "fuelRequired" | "mthBefore" | "fuelBefore";
const decimal = (text: string) => {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text.trim())) return null;
  const value = Number(text.trim().replace(",", "."));
  return Number.isFinite(value) ? value : null;
};

/** Actual end readings are checked against the immutable departure snapshot, never elapsed-clock estimates. */
export function validateDebrief(
  record: Debrief,
  mthText: string,
  fuelText: string,
):
  | { ok: true; mthAfter: number; fuelAfterL: number }
  | { ok: false; error: DebriefError } {
  const mthAfter = decimal(mthText),
    fuelAfterL = decimal(fuelText);
  if (mthAfter === null || mthAfter > 99999.99)
    return { ok: false, error: "mthRequired" };
  if (fuelAfterL === null) return { ok: false, error: "fuelRequired" };
  if (record.mthBefore !== null && mthAfter < record.mthBefore)
    return { ok: false, error: "mthBefore" };
  if (record.fuelBeforeL !== null && fuelAfterL > record.fuelBeforeL)
    return { ok: false, error: "fuelBefore" };
  return { ok: true, mthAfter, fuelAfterL };
}

/** Keep genuine zero readings; a missing start/stop event is not synthesized from closing the app. */
export function debriefStatistics(record: Debrief) {
  const elapsed = (start: number | null, end: number | null) =>
    start === null || end === null || end < start ? null : end - start;
  return {
    mthUsed:
      record.accepted && record.mthBefore !== null
        ? Math.round((record.accepted.mthAfter - record.mthBefore) * 100) / 100
        : null,
    fuelUsedL:
      record.accepted && record.fuelBeforeL !== null
        ? Math.round((record.fuelBeforeL - record.accepted.fuelAfterL) * 100) /
          100
        : null,
    blockMs: elapsed(record.times.offBlockAt, record.times.onBlockAt),
    airMs: elapsed(record.times.takeoffAt, record.times.landingAt),
  };
}
