import { useCallback, useSyncExternalStore } from "react";
import { distanceNm, initialBearingDeg } from "~/domain/geo";
import { mToFt, mpsToKt } from "~/domain/units";
import { gnssAltitudeTrend } from "~/domain/terrain";
import { connectTelemetry, type ConnectorStatus } from "~/api/connector";
import { usePositionSource } from "~/stores/position-source";
export type GpsFix = {
  source?: "gps" | "derived" | "replay" | "connector" | "demo";
  paused?: boolean;
  indicatedAirspeedKt?: number;
  trueAirspeedKt?: number;
  altitudeAglFt?: number;
  verticalSpeedFpm?: number;
  lat: number;
  lon: number;
  altitudeFt: number | null;
  altitudeAccuracyM?: number | null;
  groundSpeedKt: number | null;
  trackDeg: number | null;
  headingTrueDeg?: number;
  accuracyM: number;
  time: string;
  receivedAt?: number;
};
type Snapshot = {
  fix: GpsFix | null;
  error: "denied" | "unavailable" | null;
  connectorStatus: ConnectorStatus;
};
const empty: Snapshot = { fix: null, error: null, connectorStatus: "off" };
let snapshot: Snapshot = empty;
let watchId: number | null = null;
/** True while a GPX replay drives the fixes; device positions are ignored. */
let simulating = false;
let heightSamples: { at: number; altitudeM: number }[] = [];
const listeners = new Set<() => void>();
function publish(
  value: Omit<Snapshot, "connectorStatus"> & {
    connectorStatus?: ConnectorStatus;
  },
) {
  snapshot = { ...snapshot, ...value };
  listeners.forEach((listener) => listener());
}
function startDevice() {
  if (watchId === null) {
    if (!("geolocation" in navigator))
      publish({ fix: null, error: "unavailable" });
    else
      watchId = navigator.geolocation.watchPosition(
        ({ coords, timestamp }) => {
          if (simulating || usePositionSource.getState().source !== "device")
            return;
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
          heightSamples = heightSamples.filter(
            (s) => timestamp - s.at <= 10000 && s.at < timestamp,
          );
          if (
            coords.altitude !== null &&
            (coords.altitudeAccuracy ?? Infinity) <= 30 &&
            coords.accuracy <= 100
          )
            heightSamples.push({ at: timestamp, altitudeM: coords.altitude });
          else heightSamples = [];
          const trend = gnssAltitudeTrend(heightSamples);
          publish({
            error: null,
            fix: {
              source: derived ? "derived" : "gps",
              lat: coords.latitude,
              lon: coords.longitude,
              altitudeFt:
                coords.altitude === null ? null : mToFt(coords.altitude),
              altitudeAccuracyM: coords.altitudeAccuracy,
              verticalSpeedFpm: trend?.verticalSpeedFpm,
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
          usePositionSource.getState().source === "device" &&
          publish({
            fix: snapshot.fix,
            error: error.code === 1 ? "denied" : "unavailable",
          }),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
      );
  }
}
let stopConnector: (() => void) | undefined;
let stopSettings: (() => void) | undefined;
function stopSource() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  stopConnector?.();
  stopConnector = undefined;
}
function startSource() {
  stopSource();
  heightSamples = [];
  simulating = false;
  publish(empty);
  const settings = usePositionSource.getState();
  if (settings.source === "device") {
    startDevice();
    return;
  }
  if (!settings.enabled) return;
  stopConnector = connectTelemetry(
    settings.url,
    settings.token,
    (frame) => {
      const data = frame.data;
      if (!data || !frame.receivedAt) return;
      publish({
        error: null,
        fix: {
          source: frame.source === "demo" ? "demo" : "connector",
          paused: frame.paused,
          lat: data.latitude,
          lon: data.longitude,
          altitudeFt: data.altitudeMslFt,
          groundSpeedKt: data.groundSpeedKt,
          trackDeg: data.trackTrueDeg,
          accuracyM: 0,
          altitudeAccuracyM: null,
          time: frame.receivedAt,
          receivedAt: Date.now(),
          indicatedAirspeedKt: data.indicatedAirspeedKt,
          trueAirspeedKt: data.trueAirspeedKt,
          altitudeAglFt: data.altitudeAglFt,
          verticalSpeedFpm: data.verticalSpeedFpm,
          headingTrueDeg: data.headingTrueDeg,
        },
      });
    },
    (connectorStatus) => {
      const valid = connectorStatus === "live" || connectorStatus === "paused";
      publish({
        connectorStatus,
        fix: valid ? snapshot.fix : null,
        error: valid ? null : "unavailable",
      });
    },
  );
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    startSource();
    stopSettings = usePositionSource.subscribe(startSource);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stopSource();
      stopSettings?.();
      stopSettings = undefined;
    }
  };
}
/** Legacy "Debug with GPX": replayed fixes replace the device GPS; null hands it back. */
export function simulateFix(fix: GpsFix | null) {
  if (usePositionSource.getState().source !== "device") return;
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
