declare module "magvar" {
  /** WMM2025 declination in degrees, east positive. Altitude in km; `when` as decimal year or Date. */
  export function magvar(
    latitude: number,
    longitude: number,
    altitudeKm?: number,
    when?: number | Date,
  ): number;
}
