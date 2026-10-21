import { type PendingFlight, type ServerFlight } from "~/data/flight-session";

/** The label is local departure date/time; the unambiguous ISO instant and UUID are stored separately. */
export function flightTrackName(registration: string, startedAt: string) {
  const at = new Date(startedAt);
  const two = (n: number) => String(n).padStart(2, "0");
  const registrationPart =
    registration
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 24) || "UNKNOWN";
  return `${registrationPart}${two(at.getDate())}${two(at.getMonth() + 1)}${two(at.getFullYear() % 100)}${two(at.getHours())}${two(at.getMinutes())}`;
}

/** Prefer the downloaded prefix, retaining any locally recorded tail not yet acknowledged by the server. */
export function recoveredFlight(
  remote: ServerFlight,
  local?: PendingFlight,
): PendingFlight {
  if (
    local?.id === remote.id &&
    !remote.ended &&
    remote.revision <= local.revision + 1
  ) {
    const agrees = remote.track.every((p, i) => {
      const l = local.track[i];
      return (
        p.time === l?.time &&
        p.lat === l.lat &&
        p.lon === l.lon &&
        p.altitudeFt === l.altitudeFt
      );
    });
    if (agrees && local.track.length >= remote.track.length)
      return {
        ...local,
        revision: remote.revision,
        trackCount: remote.track.length,
        track: [...remote.track, ...local.track.slice(remote.track.length)],
      };
  }
  return { ...remote, trackCount: remote.track.length };
}
