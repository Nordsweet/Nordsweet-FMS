import type { Atis } from "~/api/aviation/schemas";
import type { Frequency } from "~/data/schemas";
import type { RadioRow } from "./comms";
import { atisHints, reliableAtis } from "./atis-consensus";

/** Resolve only an unambiguous aerodrome service; a FIS unit's reference airport is not its weather. */
export function commsAtisAirport(
  row: RadioRow,
  frequencies: readonly Frequency[],
) {
  if (row.serviceId === "fiss") return null;
  const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const airports = new Set(
    frequencies
      .filter(
        (f) =>
          f.service !== "fiss" &&
          f.frequencyMhz === row.frequencyMhz &&
          !!row.callsign &&
          normalize(f.callsign) === normalize(row.callsign),
      )
      .map((f) => f.airport),
  );
  return airports.size === 1 ? [...airports][0]! : null;
}

/** Never combine the letter of one broadcast with the pressure of another. */
export function commsAtisContext(
  reports: readonly Atis[],
  icao: string,
  now: number,
) {
  const latest = reports
    .map((report) => ({
      report,
      at: Date.parse(report.observed_at ?? report.received_at ?? ""),
    }))
    .filter(
      ({ report, at }) =>
        reliableAtis(report) &&
        !report.stale &&
        Number.isFinite(at) &&
        at <= now &&
        now - at <= 3_600_000,
    )
    .sort((a, b) => b.at - a.at)[0];
  if (!latest) return null;
  const hints = atisHints(latest.report, icao);
  const letter = hints.information?.trim().toUpperCase();
  const qnh =
    latest.report.qnh_hpa ??
    Number(/(?:QNH\s*|Q|^)(\d{3,4})\b/i.exec(hints.qnh ?? "")?.[1]);
  if (!letter || !/^[A-Z]$/.test(letter) || !(qnh >= 800 && qnh <= 1100))
    return null;
  return {
    letter,
    qnh: Math.round(qnh),
    minutes: Math.floor((now - latest.at) / 60_000),
  };
}
