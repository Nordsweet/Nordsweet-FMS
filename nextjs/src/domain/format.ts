const pad2 = (n: number) => String(n).padStart(2, "0");

/** "AA:BB" from a whole count of the smaller unit: minutes give HH:MM, seconds give MM:SS. */
export const formatClock = (total: number) =>
  `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;

/** "HH:MM:SS" from whole seconds. */
export const formatClockHms = (seconds: number) =>
  `${pad2(Math.floor(seconds / 3600))}:${formatClock(seconds % 3600)}`;

/** Three-digit heading, track or bearing in whole degrees ("007"). */
export const formatHeading = (deg: number) =>
  String(Math.round(deg)).padStart(3, "0");
