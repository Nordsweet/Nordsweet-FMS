import { angleDiffDeg, normalizeDeg, toDeg, toRad } from "./angles";

export type Wind = {
  /** Direction the wind blows FROM, degrees. Must use the same reference (true/magnetic) as the course. */
  directionDeg: number;
  speedKt: number;
};

/**
 * Wind components on a runway or track. Headwind positive (negative = tailwind);
 * crosswind positive from the right.
 */
export function windComponents(headingDeg: number, wind: Wind) {
  const angle = toRad(angleDiffDeg(headingDeg, wind.directionDeg));
  return {
    headwindKt: wind.speedKt * Math.cos(angle),
    crosswindKt: wind.speedKt * Math.sin(angle),
  };
}

/** Solves the wind triangle: heading to fly and ground speed for a desired course. */
export function windTriangle(courseDeg: number, tasKt: number, wind: Wind) {
  const angle = toRad(wind.directionDeg - courseDeg);
  const sinWca = (wind.speedKt * Math.sin(angle)) / tasKt;
  if (Math.abs(sinWca) > 1) return null; // wind stronger than TAS across track
  const wca = Math.asin(sinWca);
  const groundSpeedKt = tasKt * Math.cos(wca) - wind.speedKt * Math.cos(angle);
  if (groundSpeedKt <= 0) return null;
  return {
    headingDeg: normalizeDeg(courseDeg + toDeg(wca)),
    windCorrectionDeg: toDeg(wca),
    groundSpeedKt,
  };
}
