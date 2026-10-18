"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  Battery,
  Plane,
  RadioTower,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "~/api";
import { cachedTerrainElevation } from "~/api/terrain";
import { geoidSeparationM } from "~/domain/terrain";
import { angleDiffDeg } from "~/domain/angles";
import { magneticVariationDeg, trueToMagneticDeg } from "~/domain/magnetic";
import { type Progress } from "~/domain/progress";
import { useT } from "~/i18n/use-t";
import { type GpsFix } from "./use-gps";

const subscribeNetwork = (update: () => void) => {
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
};
type DeviceBattery = EventTarget & { level: number; charging: boolean };

/** Live flight instruments above the phase selector; unsupported or stale inputs remain unavailable. */
export function FlightStatusBar({
  fix,
  progress,
}: {
  fix: GpsFix | null;
  progress: Progress | null;
}) {
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  const [battery, setBattery] = useState<{
    level: number;
    charging: boolean;
  } | null>(null);
  const online = useSyncExternalStore(
    subscribeNetwork,
    () => navigator.onLine,
    () => true,
  );
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    queueMicrotask(tick);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let stop: (() => void) | undefined,
      active = true;
    const getBattery = (
      navigator as Navigator & { getBattery?: () => Promise<DeviceBattery> }
    ).getBattery;
    if (getBattery)
      void getBattery
        .call(navigator)
        .then((device) => {
          if (!active) return;
          const update = () =>
            setBattery({ level: device.level, charging: device.charging });
          update();
          device.addEventListener("levelchange", update);
          device.addEventListener("chargingchange", update);
          stop = () => {
            device.removeEventListener("levelchange", update);
            device.removeEventListener("chargingchange", update);
          };
        })
        .catch(() => {
          /* Battery status is optional. */
        });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
  const current =
    fix &&
    now !== null &&
    now - Date.parse(fix.time) >= -5000 &&
    now - Date.parse(fix.time) <= 20000
      ? fix
      : null;
  const terrain = useQuery({
    ...api.terrain.region.queryOptions({
      lat: Math.round((current?.lat ?? 0) * 100) / 100,
      lon: Math.round((current?.lon ?? 0) * 100) / 100,
      radiusNm: 1,
    }),
    enabled:
      !!current &&
      current.altitudeAglFt === undefined &&
      current.source !== "replay",
    retry: false,
  });
  const geoid = useQuery({
    ...api.terrain.geoid.queryOptions(undefined),
    enabled:
      !!current &&
      current.source !== "connector" &&
      current.source !== "demo" &&
      current.source !== "replay",
  });
  const groundM =
    current && terrain.data ? cachedTerrainElevation(current) : null;
  const separationM =
    current && geoid.data ? geoidSeparationM(geoid.data, current) : null;
  const mslFt =
    current?.altitudeFt == null
      ? null
      : current.source === "connector" || current.source === "demo"
        ? current.altitudeFt
        : separationM === null
          ? null
          : current.altitudeFt - separationM / 0.3048;
  const agl =
    current?.altitudeAglFt ??
    (mslFt !== null && groundM !== null
      ? Math.max(0, mslFt - groundM / 0.3048)
      : null);
  const value = (n: number | null | undefined, unit = "", digits = 0) =>
    n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}${unit}`;
  const variation = current ? magneticVariationDeg(current) : 0;
  const degrees = (n: number | null | undefined) =>
    n == null
      ? "—"
      : `${String(Math.round(trueToMagneticDeg(n, variation)) % 360 || 360).padStart(3, "0")}°`;
  const distance = current ? progress?.distanceToNextNm : null;
  const seconds =
    distance != null && (current?.groundSpeedKt ?? 0) > 5
      ? Math.round((distance / current!.groundSpeedKt!) * 3600)
      : null;
  const ete =
    seconds === null
      ? "—"
      : `${Math.floor(seconds / 3600)
          .toString()
          .padStart(2, "0")}:${Math.floor((seconds % 3600) / 60)
          .toString()
          .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const item = (label: string, text: string, id: string) => (
    <div>
      <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
        {label}
      </div>
      <output
        data-testid={id}
        className="text-foreground font-mono text-base leading-5 font-bold tabular-nums"
      >
        {text}
      </output>
    </div>
  );
  return (
    <section
      aria-label={t("fly.status.title")}
      data-testid="flight-status-bar"
      className="bg-card/95 text-card-foreground absolute inset-x-0 top-0 z-40 flex h-24 items-center gap-5 overflow-x-auto border-b px-3 py-2 backdrop-blur"
    >
      <div className="min-w-24 shrink-0">
        {item(
          t("fly.status.altitude"),
          value(current?.altitudeFt, " ft"),
          "status-altitude",
        )}
        <div className="text-primary mt-2 flex items-center gap-1 text-xs">
          <ArrowUp
            className="size-4"
            style={{
              transform: `rotate(${current && progress ? angleDiffDeg(current.trackDeg ?? 0, progress.bearingToNextDeg) : 0}deg)`,
            }}
            aria-hidden="true"
          />
          {progress?.next.ident ?? "—"}
        </div>
      </div>
      <div className="min-w-24 shrink-0">
        {item(
          t("fly.status.gs"),
          value(current?.groundSpeedKt, " kt"),
          "status-gs",
        )}
      </div>
      <div className="grid min-w-28 shrink-0 gap-1">
        {item(t("fly.track"), degrees(current?.trackDeg), "status-track")}
        {item(
          t("fly.dtk"),
          degrees(current ? progress?.desiredTrackDeg : null),
          "status-dtk",
        )}
      </div>
      <div className="grid min-w-28 shrink-0 gap-1">
        {item(
          t("fly.status.vs"),
          value(current?.verticalSpeedFpm),
          "status-vs",
        )}
        {item(
          t("fly.status.distance"),
          value(distance, " NM", 1),
          "status-distance",
        )}
      </div>
      <div className="grid min-w-28 shrink-0 gap-1">
        {item(
          t("fly.status.utc"),
          now === null ? "—" : new Date(now).toISOString().slice(11, 19),
          "status-utc",
        )}
        {item(t("fly.ete"), ete, "status-ete")}
      </div>
      <div className="ml-auto grid min-w-48 shrink-0 gap-1">
        <div className="flex items-center gap-4 text-xs">
          <span title={t("fly.status.gps")} className="flex items-center gap-1">
            <RadioTower className="size-5" />
            {value(current?.accuracyM, " m")}
          </span>
          <span title={t("fly.status.network")}>
            {online ? (
              <Wifi className="size-5" />
            ) : (
              <WifiOff className="size-5 text-amber-400" />
            )}
          </span>
          <span
            title={t("fly.status.battery")}
            className="flex items-center gap-1"
          >
            <Battery className="size-5" />
            {battery
              ? `${Math.round(battery.level * 100)}%${battery.charging ? " ⚡" : ""}`
              : "—"}
          </span>
          <span title={current?.source ?? t("fly.status.noPosition")}>
            <Plane
              className={`size-5 ${current ? "text-primary" : "text-muted-foreground"}`}
            />
          </span>
        </div>
        {item(t("fly.status.agl"), value(agl, " ft"), "status-agl")}
      </div>
    </section>
  );
}
