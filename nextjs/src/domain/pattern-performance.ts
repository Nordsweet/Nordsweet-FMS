import {
  isaPressureHpa,
  isaTemperatureC,
  pressureAltitudeFt,
  ISA_SEA_LEVEL_HPA,
} from "./atmosphere";
import { parseMetar } from "./metar";
import type { TurnPerformance } from "./fly-by";

/** Low-speed IAS≈EAS conversion using dry-air density at circuit altitude; ISA when WX is absent. */
export function patternPlanningPerformance(
  speedKias: number,
  elevationFt: number,
  altitudeAalFt: number,
  metarRaw: string | null,
): TurnPerformance {
  const wx = metarRaw ? parseMetar(metarRaw) : null;
  const altitudeFt = elevationFt + altitudeAalFt;
  const pressureAlt = pressureAltitudeFt(
    altitudeFt,
    wx?.qnhHpa ?? ISA_SEA_LEVEL_HPA,
  );
  const temperature =
    wx?.temperatureC == null
      ? isaTemperatureC(pressureAlt)
      : wx.temperatureC - 0.0019812 * altitudeAalFt;
  const densityRatio =
    ((isaPressureHpa(pressureAlt) / ISA_SEA_LEVEL_HPA) * 288.15) /
    (temperature + 273.15);
  return {
    tasKt: speedKias / Math.sqrt(densityRatio),
    windDirectionDeg: wx?.windDirectionDeg ?? 0,
    windSpeedKt: wx?.windDirectionDeg == null ? 0 : (wx.windSpeedKt ?? 0),
  };
}
