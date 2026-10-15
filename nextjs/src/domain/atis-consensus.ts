import { type Atis } from "~/api/aviation/schemas";
import { type CommunityAtisReport } from "~/api/aviation/client";
import {
  type AtisPad,
  type AtisField,
  atisFields,
  atisValue,
  atisReady,
  metarHints,
} from "./atis-pad";

/** Single-device reports are editor suggestions, never an operational weather source. */
export function reliableAtis(atis: Atis) {
  return (
    atis.source !== "community" ||
    (atis.verified === true && atis.confirmation_count >= 2 && !atis.stale)
  );
}

/** Structured pilot fields supplement the same selectable hints used for METAR. */
export function atisHints(
  atis: Atis,
  icao: string,
): Partial<Record<AtisField, string>> {
  const hints = metarHints(atis.text);
  for (const field of atisFields(icao)) {
    const value = atis.fields[field];
    if (value?.length)
      hints[field] = Array.isArray(value) ? value.join(" ") : value;
  }
  if (atis.letter) hints.information = atis.letter;
  const observed = atis.observed_at ?? atis.received_at;
  if (!hints.time && observed) hints.time = observed.slice(11, 16);
  if (!hints.qnh && atis.qnh_hpa) hints.qnh = `QNH ${atis.qnh_hpa}`;
  return hints;
}

/** Build a report only from an explicitly confirmed, dated ATIS pad. */
export function atisPadReport(
  icao: string,
  pad: AtisPad,
  now: number,
): Omit<CommunityAtisReport, "id" | "reporterId"> | null {
  const information = atisValue(pad, "information");
  const time = /^(\d{2}):(\d{2})Z?$/.exec(atisValue(pad, "time"));
  if (
    !/^[A-Z]{4}$/.test(icao) ||
    !/^[A-Z]$/.test(information) ||
    !time ||
    Number(time[1]) > 23 ||
    Number(time[2]) > 59 ||
    !atisReady(pad, "wind") ||
    !atisReady(pad, "qnh")
  )
    return null;
  const at = new Date(now);
  at.setUTCHours(Number(time[1]), Number(time[2]), 0, 0);
  if (at.getTime() > now + 5 * 60_000) at.setUTCDate(at.getUTCDate() - 1);
  if (now - at.getTime() > 60 * 60_000) return null;
  const fields: Record<string, string> = {};
  for (const field of atisFields(icao)) {
    const value = atisValue(pad, field);
    if (field !== "location" && value) fields[field] = value;
  }
  return {
    airportIcao: icao,
    information,
    atisObservedAt: at.toISOString(),
    fields,
    datisText:
      `${icao} ATIS ${information}\n` +
      Object.entries(fields)
        .map(([field, value]) => `${field.toUpperCase()} ${value}`)
        .join("\n"),
  };
}
