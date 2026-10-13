"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api } from "~/api";
import {
  type AirportRows,
  type RadioRow,
  commsZones,
  estimateComms,
  routeRadioGroups,
  rowsAt,
} from "~/domain/comms";
import { type FlightPhase } from "~/domain/flight-phase";
import { AIRSPACE_QUERY } from "~/features/map/map-view";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings } from "~/stores/map";

import { type GpsFix } from "./use-gps";

/** Legacy treats a GPS sample older than 30 s as stale. */
const FRESH_FIX_MS = 30_000;

function Rows({ rows }: { rows: RadioRow[] }) {
  const t = useT();
  if (!rows.length)
    return (
      <p className="text-muted-foreground text-sm">
        {t("fly.comms.notAvailable")}
      </p>
    );
  return rows.map((r, i) => (
    <div key={i} className="flex justify-between gap-3 text-sm">
      <span>
        {r.callsign || t("fly.comms.noCallsign")}
        {r.sector && ` / ${r.sector}`}
      </span>
      <strong className="font-mono">{r.frequencyMhz} MHz</strong>
    </div>
  ));
}

const heading =
  "text-primary mt-1 text-xs font-semibold tracking-[0.08em] uppercase";

/** Legacy COMMs: the radio plan for the active phase and, in cruise, the next sector change. */
export function CommsPanel({
  phase,
  fix,
  now,
}: {
  phase: FlightPhase;
  fix: GpsFix | null;
  /** The flight view's clock (ms), to judge whether the fix is fresh. */
  now: number;
}) {
  const t = useT();
  const { flight, cruiseSpeedKt } = usePlan();
  const route = useInFlight((s) => s.route);
  const plan = useMapSettings((s) => s.plan);
  const frequencies = useQuery(api.frequencies.list.queryOptions(undefined));
  const airspace = useQuery(
    api.airspace.around.queryOptions({
      ...AIRSPACE_QUERY,
      plan: plan === "none" ? "current" : plan,
    }),
  );
  // Recompute at most every 2 s of GPS time, like legacy.
  const tick = fix ? Math.floor(Date.parse(fix.time) / 2000) : 0;
  const fresh = fix && now - Date.parse(fix.time) < FRESH_FIX_MS ? fix : null;

  const result = useMemo(() => {
    const list = frequencies.data ?? [];
    const airport: AirportRows = (icao, services) =>
      list
        .filter((f) => f.airport === icao && services.includes(f.service))
        .sort(
          (a, b) => services.indexOf(a.service) - services.indexOf(b.service),
        );
    const zones = commsZones(airspace.data?.features ?? []);
    const dep = flight.departure?.ident ?? "";
    const arr = flight.destination?.ident ?? "";
    return {
      estimate: estimateComms(
        {
          phase,
          position: fresh,
          gpsSpeedKt: fresh?.groundSpeedKt ?? null,
          plannedSpeedKt: cruiseSpeedKt,
          route,
        },
        {
          dep: (services) => airport(dep, services),
          arr: (services) => airport(arr, services),
          at: (point) => rowsAt(point, zones, airport),
        },
      ),
      groups: routeRadioGroups(route, zones, airport),
    };
    // `fresh` changes every fix; `tick` throttles it to 2 s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    tick,
    route,
    frequencies.data,
    airspace.data,
    flight.departure,
    flight.destination,
    cruiseSpeedKt,
  ]);

  if (!frequencies.data || !airspace.data)
    return <p className="text-sm">{t("fly.comms.loading")}</p>;
  const { estimate, groups } = result;
  const seconds = estimate.seconds;
  return (
    <>
      <p className="text-muted-foreground -mt-2 text-sm">
        {t("fly.comms.subtitle")}
      </p>
      <h3 className={heading}>{t("fly.comms.current")}</h3>
      <Rows rows={estimate.current} />
      <h3 className={heading}>{t("fly.comms.next")}</h3>
      <Rows rows={estimate.next} />
      <h3 className={heading}>{t("fly.comms.change")}</h3>
      <p className="text-sm">
        {seconds === null
          ? "—"
          : `${Math.floor(seconds / 60)} min ${String(Math.floor(seconds % 60)).padStart(2, "0")} s`}
        {estimate.distanceNm !== null &&
          ` · ${estimate.distanceNm.toFixed(1)} NM`}
        {estimate.speedKt !== null &&
          ` · ${Math.round(estimate.speedKt)} kt (${t(
            estimate.speedSource === "gps"
              ? "fly.comms.gpsGs"
              : "fly.comms.plannedGs",
          )})`}
      </p>
      <p className="text-muted-foreground text-sm">
        {estimate.notes.map((n) => t(`fly.comms.note.${n}`)).join(" ")}
      </p>
      {groups.length > 0 && (
        <>
          <h3 className={heading}>{t("fly.comms.onRoute")}</h3>
          {groups.map((g, i) => (
            <div key={i} className="grid gap-1">
              <h4 className="text-sm font-medium">{g.name}</h4>
              <Rows rows={g.rows} />
            </div>
          ))}
        </>
      )}
    </>
  );
}
