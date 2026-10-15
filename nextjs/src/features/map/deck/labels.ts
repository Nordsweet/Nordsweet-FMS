import { type Airport, type Navpoint } from "~/data/schemas";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { destinationPoint } from "~/domain/geo";
import {
  airportChartLabel,
  type mapLabelVisibility,
} from "~/domain/map-labels";
import { trafficCallsign } from "~/domain/traffic-history";
import { type LayerId } from "~/stores/map";
import { palettes, type Theme } from "./theme";
import { type TextDatum } from "./scene";

type Visibility = ReturnType<typeof mapLabelVisibility>;

export function airportLabels(
  airports: Airport[],
  visible: boolean,
  visibility: Visibility,
  theme: Theme,
) {
  const colors = palettes[theme];
  const titles: TextDatum[] = [],
    details: TextDatum[] = [];
  if (!visible) return { titles, details };
  for (const p of airports) {
    const label = airportChartLabel(p, visibility);
    if (!label) continue;
    const position: [number, number] = [p.lon, p.lat];
    titles.push({ position, text: label.title, color: colors.airportTitle });
    if (label.details)
      details.push({
        position,
        text: label.details,
        color: colors.airportDetails,
      });
  }
  return { titles, details };
}

export function pointNameLabels(
  points: Navpoint[],
  layers: Record<LayerId, boolean>,
  visibility: Visibility,
  theme: Theme,
): TextDatum[] {
  if (!visibility.pointNames) return [];
  const colors = palettes[theme];
  return points.flatMap((p) => {
    const layer =
      p.kind === "vfr-reporting-point"
        ? "vfr"
        : p.kind === "navaid"
          ? "navaids"
          : "ifr";
    if (!layers[layer]) return [];
    const color =
      layer === "ifr"
        ? colors.ifrName
        : layer === "vfr" || /VOR|DME|NDB/i.test(p.navaid?.type ?? "")
          ? colors.vfrName
          : colors.navaidName;
    return [
      {
        position: [p.lon, p.lat],
        text:
          p.kind === "vfr-reporting-point"
            ? (p.aliases[0] ?? p.ident)
            : p.name || p.ident,
        color,
      },
    ];
  });
}

/** Callsign and track/altitude/speed lines under an aircraft, faded with the aircraft. */
export function trafficLabels(
  a: TrafficAircraft,
  position: [number, number],
  alpha: number,
  theme: Theme,
) {
  const colors = palettes[theme];
  const track =
    a.track_deg == null
      ? "TRK --"
      : `${Math.round(a.track_deg).toString().padStart(3, "0")} deg`;
  const altitude =
    a.altitude_ft == null ? "ALT --" : `${Math.round(a.altitude_ft)} ft`;
  const speed =
    a.ground_speed_kt == null
      ? "SPD --"
      : `${Math.round(a.ground_speed_kt)} kt`;
  const faded = (color: TextDatum["color"]): TextDatum["color"] => [
    color[0],
    color[1],
    color[2],
    Math.round(color[3] * alpha),
  ];
  return {
    callsign: {
      position,
      text: trafficCallsign(a.callsign) || (a.registration ?? a.hex),
      color: faded(colors.callsign),
    },
    details: {
      position,
      text: `${track} / ${altitude} / ${speed}`,
      color: faded(colors.flightData),
    },
  };
}

/** The 1–5 minute numbers along the own-ship track, pushed 12 px off the line. */
export function minuteLabels(
  fix: {
    lat: number;
    lon: number;
    trackDeg: number | null;
    groundSpeedKt: number | null;
  },
  theme: Theme,
): TextDatum[] {
  if (fix.trackDeg == null || (fix.groundSpeedKt ?? 0) < 1) return [];
  const angle = (fix.trackDeg * Math.PI) / 180;
  return [1, 2, 3, 4, 5].map((minute) => {
    const p = destinationPoint(
      fix,
      fix.trackDeg!,
      (fix.groundSpeedKt! * minute) / 60,
    );
    return {
      position: [p.lon, p.lat],
      text: String(minute),
      color: palettes[theme].ownship,
      offset: [Math.cos(angle) * 12, Math.sin(angle) * 12],
    };
  });
}
