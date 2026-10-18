import { useCallback, useSyncExternalStore } from "react";
import { distanceNm, initialBearingDeg } from "~/domain/geo";
import { mToFt, mpsToKt } from "~/domain/units";
export type GpsFix = {
  source?: "gps" | "derived" | "replay";
  lat: number;
  lon: number;
  altitudeFt: number | null;
  altitudeAccuracyM?: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  accuracyM: number;
  time: string;
  receivedAt?: number;
};
type Snapshot = { fix: GpsFix | null; error: "denied" | "unavailable" | null };
const empty: Snapshot = { fix: null, error: null };
let snapshot: Snapshot = empty;
let watchId: number | null = null;
/** True while a GPX replay drives the fixes; device positions are ignored. */
let simulating = false;
const listeners = new Set<() => void>();
function publish(value: Snapshot) {
  snapshot = value;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (watchId === null) {
    if (!("geolocation" in navigator))
      publish({ fix: null, error: "unavailable" });
    else
      watchId = navigator.geolocation.watchPosition(
        ({ coords, timestamp }) => {
          if (simulating) return;
          if (
            !Number.isFinite(coords.latitude) ||
            !Number.isFinite(coords.longitude) ||
            Math.abs(coords.latitude) > 90 ||
            Math.abs(coords.longitude) > 180 ||
            !Number.isFinite(timestamp)
          )
            return;
          const previous = snapshot.fix;
          const position = { lat: coords.latitude, lon: coords.longitude };
          let speed =
            coords.speed === null || !Number.isFinite(coords.speed)
              ? null
              : mpsToKt(coords.speed);
          let heading =
            coords.heading === null || !Number.isFinite(coords.heading)
              ? null
              : coords.heading;
          let derived = speed === null || heading === null;
          if (previous && (speed === null || speed < 1 || heading === null)) {
            const hours = (timestamp - Date.parse(previous.time)) / 3600000;
            const distance = distanceNm(previous, position);
            if (hours > 0 && distance > 0.003) {
              derived = true;
              if (speed === null || speed < 1) speed = distance / hours;
              heading ??= initialBearingDeg(previous, position);
            }
          }
          publish({
            error: null,
            fix: {
              source: derived ? "derived" : "gps",
              lat: coords.latitude,
              lon: coords.longitude,
              altitudeFt:
                coords.altitude === null ? null : mToFt(coords.altitude),
              altitudeAccuracyM: coords.altitudeAccuracy,
              groundSpeedKt: speed,
              trackDeg: heading,
              accuracyM: coords.accuracy,
              time: new Date(timestamp).toISOString(),
              receivedAt: Date.now(),
            },
          });
        },
        (error) =>
          !simulating &&
          publish({
            fix: snapshot.fix,
            error: error.code === 1 ? "denied" : "unavailable",
          }),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
      );
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
}
/** Legacy "Debug with GPX": replayed fixes replace the device GPS; null hands it back. */
export function simulateFix(fix: GpsFix | null) {
  simulating = fix !== null;
  publish({ fix: fix ? { ...fix, source: "replay" } : null, error: null });
}

/** A shared browser watch keeps the map and Fly screen on the same GPS observation. */
export function useGps(enabled: boolean) {
  const listen = useCallback(
    (listener: () => void) => (enabled ? subscribe(listener) : () => undefined),
    [enabled],
  );
  const value = useSyncExternalStore(
    listen,
    () => snapshot,
    () => empty,
  );
  return enabled ? value : empty;
}
