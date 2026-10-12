import { useEffect, useState } from "react";

import { mToFt, mpsToKt } from "~/domain/units";

export type GpsFix = {
  lat: number;
  lon: number;
  altitudeFt: number | null;
  groundSpeedKt: number | null;
  /** True track over the ground; null when stationary or unknown. */
  trackDeg: number | null;
  accuracyM: number;
  time: string;
};

/** Device GPS (Geolocation API, high accuracy). */
export function useGps(enabled: boolean) {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        setError(null);
        setFix({
          lat: coords.latitude,
          lon: coords.longitude,
          altitudeFt: coords.altitude === null ? null : mToFt(coords.altitude),
          groundSpeedKt: coords.speed === null ? null : mpsToKt(coords.speed),
          trackDeg:
            coords.heading === null || Number.isNaN(coords.heading)
              ? null
              : coords.heading,
          accuracyM: coords.accuracy,
          time: new Date(timestamp).toISOString(),
        });
      },
      (e) =>
        setError(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  const supported =
    typeof navigator !== "undefined" && "geolocation" in navigator;
  return { fix, error: supported ? error : "unavailable" };
}
