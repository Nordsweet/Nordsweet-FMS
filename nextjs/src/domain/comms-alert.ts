import { type CommsEstimate } from "./comms";
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
  const rowsKey = (rows: CommsEstimate["next"]) =>
    rows
      .map((r) => [r.frequencyMhz, r.callsign, r.sector ?? ""].join("|"))
      .sort()
      .join(";");
  const key = rowsKey(estimate.current) + "→" + rowsKey(estimate.next);
  if (
    dismissed.has(key) ||
    rowsKey(estimate.current) === rowsKey(estimate.next)
  )
    return null;
  return { key, rows: estimate.next };
}
