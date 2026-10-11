import { z } from "zod";

import { isaPressureHpa } from "~/domain/atmosphere";
import { type LatLon } from "~/domain/geo";
import { type Wind } from "~/domain/wind";

/** Open-Meteo pressure levels below FL200 that its forecast API serves. */
const LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500] as const;

const locationSchema = z.object({
  hourly: z
    .object({ time: z.array(z.string()) })
    .catchall(z.array(z.number().nullable()).or(z.array(z.string()))),
});

export type WindsAloft = { winds: Wind[]; levelHpa: number; validAt: string };

/** Forecast wind (true direction, knots) at each point, at the pressure level nearest the altitude. */
export async function fetchWindsAloft(
  points: LatLon[],
  altitudeFt: number,
): Promise<WindsAloft> {
  const target = isaPressureHpa(altitudeFt);
  const level = LEVELS_HPA.reduce((best, l) =>
    Math.abs(l - target) < Math.abs(best - target) ? l : best,
  );
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set(
    "latitude",
    points.map((p) => p.lat.toFixed(3)).join(","),
  );
  url.searchParams.set(
    "longitude",
    points.map((p) => p.lon.toFixed(3)).join(","),
  );
  url.searchParams.set(
    "hourly",
    `wind_speed_${level}hPa,wind_direction_${level}hPa`,
  );
  url.searchParams.set("wind_speed_unit", "kn");
  url.searchParams.set("forecast_hours", "1"); // shortcut: current hour only; use the planned departure time once flights have one
  url.searchParams.set("timezone", "GMT");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo failed (${response.status})`);
  const body: unknown = await response.json();
  const locations = z
    .array(locationSchema)
    .parse(Array.isArray(body) ? body : [body]);
  const winds = locations.map((loc) => {
    const speed = loc.hourly[`wind_speed_${level}hPa`]?.[0];
    const direction = loc.hourly[`wind_direction_${level}hPa`]?.[0];
    if (typeof speed !== "number" || typeof direction !== "number")
      throw new Error("Open-Meteo returned no wind");
    return { directionDeg: direction, speedKt: speed };
  });
  return {
    winds,
    levelHpa: level,
    validAt: `${locations[0]!.hourly.time[0]}Z`,
  };
}
