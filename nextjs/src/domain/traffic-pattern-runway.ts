import { type Airport } from "~/data/schemas";
import { type Atis } from "~/api/aviation/schemas";
import { reliableAtis, atisHints } from "./atis-consensus";
import { parseMetar } from "./metar";

/** Prefer an explicitly copied runway or reliable airport ATIS, then the greatest wind component. */
export function patternRunwaySuggestion(
  airport: Airport,
  copiedRunway: string,
  reports: Atis[],
  metar: string | null,
  copiedWind = "",
) {
  const match = (text: string) => {
    const landing =
      /\b(?:LANDING|ARRIVAL)(?:\s+(?:RWY|RUNWAY))?\s+(\d{1,2}[LRC]?)\b/i.exec(
        text,
      );
    if (landing) text = landing[1]!;
    const tokens = [
      ...text
        .toUpperCase()
        .matchAll(
          /(?:\b(?:RWY|RUNWAY|LANDING|ARRIVAL)\s*|^)(0?[1-9]|[12]\d|3[0-6])([LRC]?)(?=\b|\/)/g,
        ),
    ];
    for (const token of tokens) {
      const key = token[1]!.padStart(2, "0") + token[2]!;
      const runway = airport.runways.find(
        (r) =>
          r.designator.toUpperCase().replace(/^(\d)([LRC]?)$/, "0$1$2") === key,
      );
      if (runway) return runway;
    }
    return null;
  };
  const copied = match(copiedRunway);
  if (copied) return { runway: copied, source: "atis" as const };
  for (const report of reports.filter((r) => reliableAtis(r) && !r.stale)) {
    const runway =
      match(atisHints(report, airport.ident).runway ?? "") ??
      match(report.text);
    if (runway) return { runway, source: "atis" as const };
  }
  const windTexts = [
    copiedWind,
    ...reports
      .filter((r) => reliableAtis(r) && !r.stale)
      .map((r) => atisHints(r, airport.ident).wind ?? r.text),
    metar ?? "",
  ];
  const wind =
    windTexts
      .map((text) => parseMetar(text.replace(/(\d{3})\/(\d{2,3})/g, "$1$2")))
      .find((w) => w.windDirectionDeg !== null && w.windSpeedKt > 0) ?? null;
  const known =
    wind?.windDirectionDeg !== null &&
    wind?.windDirectionDeg !== undefined &&
    wind.windSpeedKt > 0;
  const headwind = (heading: number) =>
    known
      ? Math.cos(((heading - wind.windDirectionDeg!) * Math.PI) / 180) *
        wind.windSpeedKt
      : 0;
  const runway =
    [...airport.runways].sort(
      (a, b) =>
        headwind(b.trueHeadingDeg) - headwind(a.trueHeadingDeg) ||
        (b.lengthM ?? 0) - (a.lengthM ?? 0),
    )[0] ?? null;
  return { runway, source: known ? ("wind" as const) : ("fallback" as const) };
}
