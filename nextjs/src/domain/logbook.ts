import { type Debrief } from "~/data/debrief";
import { type LogbookEntry } from "~/data/logbook";
import { type PendingFlight } from "~/data/flight-session";

/** Unknown event times stay unknown; closing Fly is never a fabricated landing or on-block. */
export function logbookDuration(start: number | null, end: number | null) {
  return start !== null && end !== null && end >= start ? end - start : null;
}

/** Reuse the immutable departure/debrief snapshot, including accepted postflight corrections. */
export function logbookFromDebrief(
  record: Debrief,
  fallback: {
    id: string;
    startedAt: string;
    departure: string;
    arrival: string;
    pic: string;
  },
): LogbookEntry {
  return {
    id: record.sessionId?.length ? record.sessionId : fallback.id,
    startedAt: record.startedAt?.length ? record.startedAt : fallback.startedAt,
    endedAt: record.endedAt,
    aircraftType: record.aircraftType ?? "",
    registration: record.registration,
    departure: record.departure?.length ? record.departure : fallback.departure,
    arrival: record.arrival?.length ? record.arrival : fallback.arrival,
    pic: record.pic?.length ? record.pic : fallback.pic,
    ...record.times,
    mthBefore: record.mthBefore,
    mthAfter: record.accepted?.mthAfter ?? null,
    fuelBeforeL: record.fuelBeforeL,
    fuelAfterL: record.accepted?.fuelAfterL ?? null,
  };
}

/** Old private browser checkpoints can be imported without downloading their GPS tracks. */
export function logbookFromCheckpoint(
  flight: Pick<PendingFlight, "id" | "startedAt" | "snapshot">,
  pic: string,
) {
  const { flight: plan, inflight } = flight.snapshot;
  if (!inflight.debrief) return null;
  return logbookFromDebrief(inflight.debrief, {
    id: flight.id,
    startedAt: flight.startedAt,
    departure: plan.departure?.ident ?? "",
    arrival: inflight.divertAirport ?? plan.destination?.ident ?? "",
    pic,
  });
}
