import type { Atis } from "~/api/aviation/schemas";
import type { Airport } from "~/data/schemas";
import type { Flight } from "~/data/flight";
import { atisHints, reliableAtis } from "./atis-consensus";
import { atisReady, atisValue, type AtisPad } from "./atis-pad";
import { parseMetar } from "./metar";
import { patternRunwaySuggestion } from "./traffic-pattern-runway";
import { mpsToKt } from "./units";

type Conditions = {
  oatC?: number;
  qnhHpa?: number;
  wind?: { directionDeg: number | null; speedKt: number };
  runwayId?: string;
};

function windFrom(text: string): Conditions["wind"] {
  text = text.toUpperCase();
  if (/\bCALM\b/.test(text)) return { directionDeg: null, speedKt: 0 };
  const coded = /\b(\d{3}|VRB)\/?(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/.exec(text);
  const spoken =
    /\bWIND\s+(?:FROM\s+)?(\d{1,3}|VRB|VARIABLE)\s*(?:DEG(?:REES)?|°)?[\s,]+(?:AT\s+)?(\d{1,3})\s*(KT|KNOTS?|MPS)\b(?:[\s,]+GUST(?:ING|S)?\s+(\d{1,3})\s*(?:KT|KNOTS?|MPS)?)?/.exec(
      text,
    );
  if (!coded && !spoken) return undefined;
  const direction = coded?.[1] ?? spoken![1]!;
  const speed = Number(coded?.[2] ?? spoken![2]);
  const unit = coded?.[4] ?? spoken![3];
  if (
    direction !== "VRB" &&
    direction !== "VARIABLE" &&
    Number(direction) > 360
  )
    return undefined;
  return {
    directionDeg:
      direction === "VRB" || direction === "VARIABLE" || speed === 0
        ? null
        : Number(direction) % 360,
    // Match METAR performance: sustained wind, without crediting extra gust headwind.
    speedKt: unit === "MPS" ? mpsToKt(speed) : speed,
  };
}

function temperature(text: string) {
  const match = /^(M|-|MINUS\s*)?(\d{1,2})(?:\s*°?C)?$/i.exec(text.trim());
  const value = match ? Number(match[2]) * (match[1] ? -1 : 1) : undefined;
  return value !== undefined && value >= -80 && value <= 60 ? value : undefined;
}

/** Select only the airport's fresh, reliable phase-specific report; pilot fields take precedence. */
export function performanceAtis(
  airport: Airport,
  phase: "takeoff" | "landing",
  reports: readonly Atis[],
  pad: AtisPad | null,
): Conditions {
  const kind = phase === "takeoff" ? "departure" : "arrival";
  const reportTime = (r: Atis) =>
    Date.parse(r.observed_at ?? r.received_at ?? "") || 0;
  const report = reports
    .filter(
      (r) =>
        !r.stale &&
        reliableAtis(r) &&
        (r.kind === kind || r.kind === "combined"),
    )
    .sort(
      (a, b) =>
        reportTime(b) - reportTime(a) ||
        Number(b.kind === kind) - Number(a.kind === kind),
    )[0];
  const result: Conditions = {};
  if (report) {
    const hints = atisHints(report, airport.ident);
    const metar = parseMetar(" " + report.text.toUpperCase());
    const spokenTemp =
      /\b(?:TEMPERATURE|TEMP|T)\s+(MINUS\s*)?(-?\d{1,2})\b/i.exec(report.text);
    const oat =
      temperature(hints.temperature ?? "") ??
      metar.temperatureC ??
      (spokenTemp
        ? temperature((spokenTemp[1] ?? "") + spokenTemp[2])
        : undefined);
    if (oat !== undefined && oat !== null) result.oatC = oat;
    const qnh = Number(
      /(?:\bQNH\s*|\bQ|^)(\d{3,4})\b/i.exec(hints.qnh ?? report.text)?.[1] ??
        report.qnh_hpa ??
        metar.qnhHpa,
    );
    if (qnh >= 800 && qnh <= 1100) result.qnhHpa = qnh;
    result.wind = windFrom(hints.wind ? "WIND " + hints.wind : report.text);
  }
  if (pad) {
    const oat = temperature(atisValue(pad, "temperature"));
    if (oat !== undefined) result.oatC = oat;
    const qnh = Number(/\bQNH\s*(\d{3,4})\b/.exec(atisValue(pad, "qnh"))?.[1]);
    if (qnh >= 800 && qnh <= 1100) result.qnhHpa = qnh;
    if (atisReady(pad, "wind"))
      result.wind = windFrom(atisValue(pad, "wind")) ?? result.wind;
  }
  const runway = patternRunwaySuggestion(
    airport,
    pad ? atisValue(pad, "runway") : "",
    report ? [report] : [],
    null,
  );
  if (runway.source === "atis" && runway.runway)
    result.runwayId = runway.runway.designator;
  return result;
}

/** Apply each changed ATIS once, so subsequent edits to performance remain pilot-controlled. */
export function applyPerformanceAtis(
  stored: Flight["performanceInputs"][string],
  conditions: Conditions,
  airport: Airport,
) {
  const signature = JSON.stringify(conditions);
  if (signature === "{}" || stored.atisSignature === signature) return stored;
  const runway =
    airport.runways.find(
      (r) => r.designator === (conditions.runwayId ?? stored.runwayId),
    ) ?? airport.runways[0];
  const { wind, ...values } = conditions;
  return {
    ...stored,
    ...values,
    atisSignature: signature,
    ...(wind
      ? {
          windSpeedKt: wind.speedKt,
          windDirectionDeg:
            wind.directionDeg ??
            (wind.speedKt > 0 && runway
              ? (runway.trueHeadingDeg + 180) % 360
              : 0),
        }
      : {}),
  };
}
