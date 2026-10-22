export type FuelReserveLevel = "alternate" | "final";

/** Actual fuel on board, in litres. Unknown data is distinct from a confirmed clear state. */
export function fuelReserveStatus(
  remainingL: number | null,
  alternateL: number | null,
  finalReserveL: number | null,
): { level: FuelReserveLevel | null } | null {
  const valid = (value: number | null): value is number =>
    value !== null && Number.isFinite(value) && value >= 0;
  if (!valid(remainingL) || !valid(finalReserveL)) return null;
  if (finalReserveL > 0 && remainingL < finalReserveL)
    return { level: "final" };
  if (!valid(alternateL)) return null;
  return {
    level:
      alternateL > 0 && remainingL < alternateL + finalReserveL
        ? "alternate"
        : null,
  };
}
