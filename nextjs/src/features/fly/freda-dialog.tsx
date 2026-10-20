"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  fuelUnit,
  fuelFromLitres,
  fuelToLitres,
  formatFuel,
} from "~/domain/fuel-units";
import { timerElapsed } from "~/domain/flight-timers";
import { fredaFuelRemaining } from "~/domain/freda";
import { useFlightSync } from "~/stores/flight-sync";
import { navigationProgress } from "~/domain/holding";
import { fmt } from "~/features/plan/fields";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";

import { Group, Row } from "./emergency-panel";
import { type GpsFix } from "./use-gps";
import { useTurnPerformance } from "./use-turn-performance";

const TANKS: Record<string, [string, string]> = {
  P2006T: ["LH tank", "RH tank"],
};
const DEPARTURE_SERVICES = [
  "zblizanie",
  "radar",
  "radio",
  "informacja",
  "tower",
  "atis",
];
const ARRIVAL_SERVICES = ["radio", "informacja", "tower", "atis"];

/** Legacy FREDA check (30-minute in-flight check): Fuel, Radio, Engine, Direction, Altitude. */
export function FredaDialog({ fix, now }: { fix: GpsFix | null; now: number }) {
  const t = useT();
  const { flight, aircraft, fuelPlanning, plan } = usePlan();
  const inFlight = useInFlight();
  const recoveryReady = useFlightSync((s) => s.phase === "ready");
  const turns = useTurnPerformance(fix);
  const frequencies = useQuery(
    api.frequencies.list.queryOptions(undefined),
  ).data;
  const [tanks, setTanks] = useState<number[] | null>(null);
  const [engine, setEngine] = useState<"yes" | "no" | null>(null);

  // Cruise burn since the last confirmed reading; initial fuel is the fallback before the first FREDA.
  const trip = fuelPlanning?.rows.plannedTrip;
  const plannedFlow =
    trip?.fuelL && trip.minutes ? trip.fuelL / (trip.minutes / 60) : null;
  const flow = fuelPlanning?.cruise.fuelFlowLph ?? plannedFlow;
  const air = inFlight.timers.airTime;
  const predicted = fredaFuelRemaining(
    flight.fuel.blockL,
    flow,
    air,
    now,
    inFlight.fredaFuel,
  );
  const unit = fuelUnit(aircraft?.type, flight.fuelDisplayUnit);
  const capacity = aircraft?.fuelTankCapacityL ?? aircraft?.usableFuelL ?? 999;
  const labels = TANKS[aircraft?.type ?? ""] ?? ["Left tank", "Right tank"];
  const values =
    tanks ??
    labels.map(() =>
      predicted === null ? 0 : Math.round(fuelFromLitres(predicted / 2, unit)),
    );
  const setTank = (i: number, liters: number) =>
    setTanks(
      values.map((v, j) =>
        j === i
          ? Math.max(
              0,
              Math.min(
                Math.floor(fuelFromLitres(capacity, unit)),
                Math.round(liters),
              ),
            )
          : v,
      ),
    );

  // Radio: the departure's after-departure frequency, near the arrival the destination's.
  const progress = fix
    ? navigationProgress(
        inFlight.route,
        fix,
        inFlight.activeLeg,
        turns,
        inFlight.holding,
      )
    : null;
  const nearArrival = inFlight.activeLeg >= inFlight.route.length - 2;
  const frequency = (icao: string | undefined, services: string[]) => {
    const row = (frequencies ?? [])
      .filter((f) => f.airport === icao && services.includes(f.service))
      .sort(
        (a, b) => services.indexOf(a.service) - services.indexOf(b.service),
      )[0];
    return row
      ? `${row.frequencyMhz} ${row.callsign}`
      : t("fly.comms.notAvailable");
  };
  const gs = fix?.groundSpeedKt ?? null;
  const eta =
    progress && gs !== null && gs > 1
      ? new Date(now + (progress.distanceToNextNm / gs) * 3_600_000)
      : null;
  const plannedFt = progress
    ? (progress.next.altitudeFt ??
      plan?.pointAltitudeByKey[progress.next.ident] ??
      flight.cruiseAltitudeFt)
    : null;

  const close = () => {
    setTanks(null);
    setEngine(null);
    inFlight.closeFreda();
  };
  const freshForArrival =
    !["descent", "landing", "taxiin"].includes(inFlight.phase) ||
    (!!fix && !fix.paused && Math.abs(now - Date.parse(fix.time)) <= 20000);
  return (
    <Dialog
      open={
        inFlight.fredaOpen &&
        inFlight.fredaAvailable &&
        recoveryReady &&
        freshForArrival
      }
      onOpenChange={(open) => !open && close()}
    >
      <DialogContent className="max-h-[90dvh] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto">
        <DialogTitle>FREDA</DialogTitle>
        <DialogDescription>
          {t("fly.freda.subtitle", { time: timerElapsed(air, now) })}
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Group title={t("fly.freda.fuel")}>
              <p className="text-sm">
                {predicted === null
                  ? t("fly.freda.noPrediction")
                  : t("fly.freda.predicted", {
                      litres: formatFuel(predicted, unit),
                      unit,
                    })}
                {flow !== null &&
                  ` • ${t("fly.freda.burn", { flow: formatFuel(flow, unit), unit })}`}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {labels.map((label, i) => (
                  <label key={label} className="grid gap-1 text-sm">
                    {label} [{unit}]
                    <Input
                      type="number"
                      min={0}
                      max={Math.floor(fuelFromLitres(capacity, unit))}
                      inputMode="numeric"
                      value={values[i]}
                      onChange={(e) => setTank(i, Number(e.target.value))}
                    />
                    <span className="flex gap-1">
                      {[-5, -1, 1, 5].map((d) => (
                        <Button
                          key={d}
                          size="sm"
                          variant="outline"
                          onClick={() => setTank(i, values[i]! + d)}
                        >
                          {d > 0 ? `+${d}` : d}
                        </Button>
                      ))}
                    </span>
                  </label>
                ))}
              </div>
            </Group>
          </div>
          <Group title={t("fly.freda.radio")}>
            <Row
              label={t("fly.freda.current")}
              value={
                nearArrival
                  ? frequency(flight.destination?.ident, ARRIVAL_SERVICES)
                  : frequency(flight.departure?.ident, DEPARTURE_SERVICES)
              }
            />
            <Row
              label={t("fly.freda.next")}
              value={frequency(flight.destination?.ident, ARRIVAL_SERVICES)}
            />
          </Group>
          <Group title={t("fly.freda.engine")}>
            <p className="text-sm">{t("fly.freda.engineQuestion")}</p>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={engine === v ? "default" : "outline"}
                  aria-pressed={engine === v}
                  onClick={() => setEngine(v)}
                >
                  {t(`fly.freda.${v}`)}
                </Button>
              ))}
            </div>
            {engine === "no" && (
              <p className="text-destructive text-sm">
                {t("fly.freda.troubleshooting")}
              </p>
            )}
          </Group>
          <Group title={t("fly.freda.direction")}>
            <Row
              label={t("fly.freda.point")}
              value={progress?.next.ident ?? t("fly.freda.noNext")}
            />
            <Row
              label={t("fly.freda.courseDistance")}
              value={
                progress
                  ? `${fmt(progress.bearingToNextDeg).padStart(3, "0")} deg / ${fmt(progress.distanceToNextNm, 1)} NM`
                  : "--"
              }
            />
            <Row
              label="ETA"
              value={
                eta
                  ? eta.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })
                  : "--:--"
              }
            />
            <Row
              label={t("fly.freda.groundSpeed")}
              value={gs === null ? "--" : `${fmt(gs)} kt`}
            />
          </Group>
          <Group title={t("fly.freda.altitude")}>
            <Row
              label={t("fly.freda.current")}
              value={
                fix?.altitudeFt == null ? "--" : `${fmt(fix.altitudeFt)} ft`
              }
            />
            <Row
              label={t("fly.freda.planned")}
              value={plannedFt === null ? "--" : `${fmt(plannedFt)} ft`}
            />
          </Group>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            {t("map.close")}
          </Button>
          <Button
            onClick={() => {
              inFlight.completeFreda(
                tanks === null && predicted !== null
                  ? predicted
                  : fuelToLitres(
                      values.reduce((a, b) => a + b, 0),
                      unit,
                    ),
              );
              setTanks(null);
              setEngine(null);
            }}
          >
            {t("fly.freda.complete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
