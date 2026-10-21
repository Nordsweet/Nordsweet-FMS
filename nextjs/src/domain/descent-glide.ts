type DescentFix = {
  source?: string;
  paused?: boolean;
  onGround?: boolean;
  verticalSpeedFpm?: number;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  accuracyM: number;
  altitudeAccuracyM?: number | null;
  time: string;
};

/** Only fresh airborne measured descent strictly beyond 500 ft/min enables glide rings. */
export function descentGlideAvailable(
  fix: DescentFix | null,
  altitudeMslFt: number | null,
  now: number,
): boolean {
  if (!fix || fix.paused || fix.onGround || fix.source === "replay")
    return false;
  const instrument = fix.source === "connector" || fix.source === "demo";
  const age = now - Date.parse(fix.time);
  return (
    Number.isFinite(age) &&
    age >= -1000 &&
    age <= 20000 &&
    altitudeMslFt !== null &&
    Number.isFinite(altitudeMslFt) &&
    Number.isFinite(fix.verticalSpeedFpm) &&
    fix.verticalSpeedFpm! < -500 &&
    fix.groundSpeedKt !== null &&
    Number.isFinite(fix.groundSpeedKt) &&
    fix.groundSpeedKt > 0 &&
    fix.trackDeg !== null &&
    Number.isFinite(fix.trackDeg) &&
    Number.isFinite(fix.accuracyM) &&
    fix.accuracyM <= 100 &&
    (instrument ||
      (fix.altitudeAccuracyM != null &&
        fix.altitudeAccuracyM > 0 &&
        fix.altitudeAccuracyM <= 30))
  );
}
