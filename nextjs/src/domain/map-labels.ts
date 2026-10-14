import { type Airport } from "~/data/schemas";

/** Legacy zoom uses a 256px world; MapLibre's 512px world is one zoom level lower. */
export function mapLabelVisibility(
  mapLibreZoom: number,
  enabled: boolean,
  longitudeSpanDeg: number,
) {
  const legacyZoom = mapLibreZoom + 1;
  return {
    pointNames: enabled && legacyZoom >= 9,
    airportDetails: enabled && legacyZoom >= 10,
    airspaceNames: enabled && legacyZoom >= 9,
    airspaceFullNames: enabled && legacyZoom >= 10,
    trafficNames: longitudeSpanDeg < 8,
  };
}

type AirportLabel = Pick<
  Airport,
  "ident" | "name" | "isIcao" | "elevationFt" | "runways"
>;

/** Airport codes precede full names/runway data, matching drawAirportDataLabel in legacy main. */
export function airportChartLabel(
  airport: AirportLabel,
  visibility: ReturnType<typeof mapLabelVisibility>,
) {
  if (!visibility.pointNames) return null;
  const rawCode = airport.ident.trim().toUpperCase();
  const icao = airport.isIcao && /^[A-Z]{4}$/.test(rawCode) ? rawCode : "";
  if (!visibility.airportDetails && !icao) return null;
  const name = airport.name.trim();
  const searchKey = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const title = !visibility.airportDetails
    ? icao
    : icao && name && searchKey(name) !== searchKey(icao)
      ? `${name} / ${icao}`
      : name || icao;
  const length = Math.round(
    Math.max(
      0,
      ...airport.runways.flatMap((r) => [
        r.lengthM ?? 0,
        r.toraM ?? 0,
        r.todaM ?? 0,
        r.asdaM ?? 0,
        r.ldaM ?? 0,
      ]),
    ),
  );
  const details = visibility.airportDetails
    ? [
        Number.isFinite(airport.elevationFt)
          ? `AD ${Math.round(airport.elevationFt)} ft AMSL`
          : "",
        length ? `RWY ${length} m` : "",
      ]
        .filter(Boolean)
        .join(" / ")
    : "";
  return { title, details };
}
