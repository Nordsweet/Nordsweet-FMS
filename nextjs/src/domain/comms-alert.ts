import { radioRowsKey, type CommsEstimate } from "./comms";
import { type FlightPhase } from "./flight-phase";

/** A sector hand-off is suggested during its last two minutes, once per dismissed transition. */
export function commsChangeSuggestion(
  phase: FlightPhase,
  estimate: CommsEstimate,
  dismissed: ReadonlySet<string>,
) {
  if (
    !["cruise", "climb", "descent"].includes(phase) ||
    estimate.seconds === null ||
    !Number.isFinite(estimate.seconds) ||
    estimate.seconds <= 0 ||
    estimate.seconds > 120 ||
    !estimate.next.length
  )
    return null;
  const rowsKey = radioRowsKey;
  const key = rowsKey(estimate.current) + "→" + rowsKey(estimate.next);
  if (
    dismissed.has(key) ||
    rowsKey(estimate.current) === rowsKey(estimate.next)
  )
    return null;
  return { key, rows: estimate.next };
}

export type RadioCrossing = {
  session: string | null;
  current: string;
  sequence: number;
  change: { key: string; rows: CommsEstimate["current"]; at: number } | null;
};

/** Each visit has its own handoff: returning to the same ATZ must prompt again. */
export function observeRadioCrossing(
  state: RadioCrossing,
  session: string | null,
  rows: CommsEstimate["current"],
  now: number,
): RadioCrossing {
  const previous =
    state.session === session
      ? state
      : { session, current: "", sequence: 0, change: null };
  const current = radioRowsKey(rows);
  if (!session || !current || current === previous.current) return previous;
  const sequence = previous.sequence + 1;
  return {
    session,
    current,
    sequence,
    change: {
      key: `${session}:${sequence}:${previous.current}→${current}`,
      rows,
      at: now,
    },
  };
}
