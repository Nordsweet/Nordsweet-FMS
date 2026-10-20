import type { FlightPhase } from "./flight-phase";
import type { Timer } from "./flight-timers";

export type FredaFuel = { fuelL: number; airElapsedMs: number };
export const airElapsedMs = (timer: Timer, now: number) =>
  timer.startedAt === null
    ? 0
    : Math.max(0, (timer.stoppedAt ?? now) - timer.startedAt);

/** A new physical fuel reading replaces the baseline, never the flight's original block fuel. */
export function fredaFuelRemaining(
  blockL: number,
  flowLph: number | null,
  air: Timer,
  now: number,
  reading: FredaFuel | null,
) {
  if (flowLph === null || !Number.isFinite(flowLph) || flowLph < 0)
    return reading?.fuelL ?? null;
  const elapsed = Math.max(
    0,
    airElapsedMs(air, now) - (reading?.airElapsedMs ?? 0),
  );
  return Math.max(
    0,
    (reading?.fuelL ?? blockL) - (flowLph * elapsed) / 3_600_000,
  );
}

/** During descent/arrival require both half the planned cruise altitude and more than 2000 ft AGL. */
export function fredaAvailable(
  phase: FlightPhase,
  altitudeMslFt: number | null,
  aglFt: number | null,
  cruiseFt: number,
) {
  if (!["descent", "landing", "taxiin"].includes(phase)) return true;
  return (
    altitudeMslFt !== null &&
    aglFt !== null &&
    Number.isFinite(altitudeMslFt) &&
    Number.isFinite(aglFt) &&
    altitudeMslFt > cruiseFt / 2 &&
    aglFt > 2000
  );
}
