/** ICAO standard atmosphere (troposphere), feet and hPa. */
export const ISA_SEA_LEVEL_HPA = 1013.25;
export const ISA_SEA_LEVEL_C = 15;
const LAPSE_C_PER_FT = 0.0019812;

/** ISA temperature at a pressure altitude. */
export function isaTemperatureC(pressureAltitudeFt: number) {
  return ISA_SEA_LEVEL_C - LAPSE_C_PER_FT * pressureAltitudeFt;
}

/** Pressure altitude of a field at `elevationFt` with altimeter setting `qnhHpa`. */
export function pressureAltitudeFt(elevationFt: number, qnhHpa: number) {
  return (
    elevationFt + 145366.45 * (1 - (qnhHpa / ISA_SEA_LEVEL_HPA) ** 0.190284)
  );
}

/** Density altitude (dry air) — ~118.8 ft per °C deviation from ISA. */
export function densityAltitudeFt(pressureAltitudeFt: number, oatC: number) {
  return (
    pressureAltitudeFt + 118.8 * (oatC - isaTemperatureC(pressureAltitudeFt))
  );
}
