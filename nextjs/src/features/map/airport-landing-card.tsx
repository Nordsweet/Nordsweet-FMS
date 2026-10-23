"use client";

import { useState } from "react";
import type { Airport } from "~/data/schemas";
import { airportArrival } from "~/domain/airport-arrival";
import { pressureAltitudeFt } from "~/domain/atmosphere";
import {
  applyPerformanceAtis,
  performanceAtis,
} from "~/domain/atis-performance";
import { arrivalFuelModel } from "~/domain/arrival-fuel-model";
import { fredaFuelRemaining } from "~/domain/freda";
import { fuelUnit, formatFuel } from "~/domain/fuel-units";
import { parseMetar } from "~/domain/metar";
import { computeDistance } from "~/domain/performance";
import { computeLoading } from "~/domain/weight-balance";
import { windComponents } from "~/domain/wind";
import type { TurnPerformance } from "~/domain/fly-by";
import type { GpsFix } from "~/features/fly/use-gps";
import { WarningList } from "~/features/plan/performance";
import { usePlan } from "~/features/plan/use-plan";
import { useBriefing } from "~/features/plan/weather";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useAtis } from "~/stores/atis";
import { useInFlight } from "~/stores/inflight";

/** Arrival mass and LDA for any selected airport, using the same POH calculator as the RWY panel. */
export function AirportLandingCard({
  airport,
  fix,
  now,
  turns,
}: {
  airport: Airport;
  fix: GpsFix | null;
  now: number;
  turns?: TurnPerformance;
}) {
  const t = useT();
  const { flight, aircraft, plan, cruiseSpeedKt, fuelPlanning } = usePlan();
  const navigation = useInFlight();
  const departure =
    airport.ident === flight.departure?.ident &&
    (airport.ident !== flight.destination?.ident ||
      ["taxiout", "takeoff", "climb"].includes(navigation.phase));
  const operation = departure ? "takeoff" : "landing";
  const atis = useAtis();
  const { station, briefing } = useBriefing(
    aircraft?.[operation] ? airport : null,
  );
  const [selectedRunway, setSelectedRunway] = useState<string | null>(null);
  if (!aircraft?.[operation] || !navigation.startedAt) return null;

  const perf = aircraft[operation];
  const pad =
    atis.records[airport.ident] ??
    (atis.airport === airport.ident ? atis.pad : null);
  const weather = performanceAtis(
    airport,
    operation,
    station?.icao === airport.ident ? (briefing.data?.atis ?? []) : [],
    pad,
  );
  const metarReport = briefing.data?.metar;
  const metar =
    metarReport && !metarReport.stale ? parseMetar(metarReport.raw) : null;
  const stored =
    flight.performanceInputs[`${operation}|${airport.ident}|${aircraft.id}`];
  const inputs = applyPerformanceAtis(
    stored ?? {
      runwayId: null,
      configId: null,
      oatC: metar?.temperatureC ?? 15,
      qnhHpa: metar?.qnhHpa ?? 1013,
      windDirectionDeg: metar?.windDirectionDeg ?? 0,
      windSpeedKt: metar?.windSpeedKt ?? 0,
    },
    weather,
    airport,
  );
  const patternRunway = departure
    ? flight.departureRunway?.airport === airport.ident
      ? flight.departureRunway.designator
      : flight.departurePattern?.runway.designator
    : flight.trafficPattern?.airport.ident === airport.ident
      ? flight.trafficPattern.runway.designator
      : null;
  const wind = {
    directionDeg: inputs.windDirectionDeg,
    speedKt: inputs.windSpeedKt,
  };
  const runway =
    airport.runways.find(
      (r) =>
        r.designator === (selectedRunway ?? patternRunway ?? inputs.runwayId),
    ) ??
    [...airport.runways].sort(
      (a, b) =>
        windComponents(b.trueHeadingDeg, wind).headwindKt -
          windComponents(a.trueHeadingDeg, wind).headwindKt ||
        ((departure ? b.todaM : b.ldaM) ?? b.lengthM ?? 0) -
          ((departure ? a.todaM : a.ldaM) ?? a.lengthM ?? 0),
    )[0];
  const config =
    perf.configurations.find(
      (c) => c.id === (inputs.configId ?? perf.defaultConfiguration),
    ) ?? perf.configurations[0]!;
  const { flow, performance, direct, legs } = arrivalFuelModel({
    aircraft,
    flight,
    plan,
    route: navigation.route,
    cruiseSpeedKt,
    fuelPlanning,
    turns,
  });
  const currentFuel = fredaFuelRemaining(
    flight.fuel.blockL,
    flow,
    navigation.timers.airTime,
    now,
    navigation.fredaFuel,
  );
  const fresh = fix && Math.abs(now - Date.parse(fix.time)) <= 20000;
  const arrival =
    fresh && currentFuel !== null
      ? airportArrival({
          airport,
          position: fix,
          route: navigation.route,
          activeLeg: navigation.activeLeg,
          turns: performance,
          legs,
          direct,
          currentFuelL: currentFuel,
        })
      : null;
  const weight =
    aircraft.weightBalance && (departure || arrival)
      ? computeLoading(aircraft.weightBalance, {
          stationsKg: flight.stationsKg,
          fuelL: departure ? flight.fuel.blockL : arrival!.fuelL,
        })
      : null;
  const surface =
    runway?.surface === "grass"
      ? "grass"
      : runway?.surface === "unknown"
        ? "unknown"
        : "paved";
  // Variable surface wind receives no headwind credit: use the worst tailwind component.
  const variable = weather.wind
    ? weather.wind.directionDeg === null
    : !stored && metar?.windDirectionDeg === null;
  const headwindKt = runway
    ? variable
      ? -inputs.windSpeedKt
      : windComponents(runway.trueHeadingDeg, wind).headwindKt
    : 0;
  const result =
    runway && weight
      ? computeDistance(config, {
          weightKg: weight.totalKg,
          pressureAltitudeFt: pressureAltitudeFt(
            airport.elevationFt,
            inputs.qnhHpa,
          ),
          temperatureC: inputs.oatC,
          headwindKt,
          surface,
          slopePct: runway.slopePct,
        })
      : null;
  const availableM = (departure ? runway?.todaM : runway?.ldaM) ?? null;
  const requiredM = result ? Math.ceil(result.obstacle50ftM) : null;
  const percent =
    requiredM !== null && availableM !== null
      ? (requiredM / availableM) * 100
      : null;
  const remainingM =
    requiredM !== null && availableM !== null
      ? Math.floor(availableM - requiredM)
      : null;
  const exceeded = remainingM !== null && remainingM < 0;
  const reciprocal = runway
    ? airport.runways.find(
        (r) =>
          Math.abs(
            ((r.trueHeadingDeg - runway.trueHeadingDeg + 540) % 360) - 180,
          ) > 175,
      )
    : null;
  const assumed =
    !stored &&
    ((weather.oatC === undefined && metar?.temperatureC == null) ||
      (weather.qnhHpa === undefined && metar?.qnhHpa == null) ||
      (!weather.wind && !metar));
  const unit = fuelUnit(aircraft.type, flight.fuelDisplayUnit);

  return (
    <section
      className="bg-card rounded-xl border p-3 text-xs"
      data-testid="airport-landing-card"
      aria-label={t(
        departure ? "airportLanding.takeoffTitle" : "airportLanding.title",
      )}
      data-operation={operation}
    >
      <div className="flex items-start justify-between gap-3 font-bold">
        <div>
          <div className="text-primary tracking-wider">
            {t(
              departure ? "airportLanding.todaUsed" : "airportLanding.ldaUsed",
            )}
          </div>
          <div data-testid="landing-distances">
            {requiredM ?? "—"} m / {availableM ?? "—"} m
          </div>
        </div>
        <span
          className={cn("text-xl tabular-nums", exceeded && "text-destructive")}
          data-testid="landing-percent"
        >
          {percent === null ? "—" : `${percent.toFixed(1)}%`}
        </span>
      </div>
      {runway && (
        <Select value={runway.designator} onValueChange={setSelectedRunway}>
          <SelectTrigger
            className="mt-2 h-8 w-full"
            aria-label={t(
              departure
                ? "airportLanding.takeoffRunway"
                : "airportLanding.runway",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {airport.runways.map((r) => (
              <SelectItem key={r.designator} value={r.designator}>
                RWY {r.designator}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {runway && (
        <>
          <div
            className="relative mx-auto my-3 flex h-80 w-full items-center justify-center rounded-lg bg-black/10"
            aria-hidden="true"
          >
            <span className="text-muted-foreground absolute top-1 text-[10px] font-bold uppercase">
              {t(`plan.perf.surface.${surface}`)}
            </span>
            <div
              className={cn(
                "relative mt-4 h-72 w-20 overflow-hidden rounded-sm border border-white/30",
                surface === "grass" ? "bg-green-950" : "bg-slate-800",
              )}
            >
              {percent !== null && (
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0",
                    exceeded ? "bg-red-500/60" : "bg-emerald-400/30",
                  )}
                  style={{ height: `${Math.min(100, percent)}%` }}
                />
              )}
              <div
                className="absolute inset-x-1 top-1 h-4"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, #e2e8f0 0 2px, transparent 2px 4px)",
                }}
              />
              <span className="absolute inset-x-0 top-7 rotate-180 text-center text-base font-bold text-white">
                {reciprocal?.designator ?? ""}
              </span>
              <div className="absolute top-1/2 left-1/2 h-5 border-l border-dashed border-white/70" />
              <span className="absolute inset-x-0 bottom-7 text-center text-base font-bold text-white">
                {runway.designator}
              </span>
              <div
                className="absolute inset-x-1 bottom-1 h-4"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, #e2e8f0 0 2px, transparent 2px 4px)",
                }}
              />
            </div>
          </div>
          <div className="flex justify-between gap-2 font-semibold">
            <span>RWY {runway.designator}</span>
            <span className={cn(exceeded && "text-destructive")}>
              {remainingM === null
                ? t(
                    departure
                      ? "airportLanding.noToda"
                      : "airportLanding.noLda",
                  )
                : t(
                    exceeded
                      ? "airportLanding.short"
                      : "airportLanding.remaining",
                    { meters: Math.abs(remainingM) },
                  )}
            </span>
          </div>
        </>
      )}
      {!runway ? (
        <p>{t("plan.perf.noRunways")}</p>
      ) : !departure && !fresh ? (
        <p className="mt-2">{t("airportLanding.needPosition")}</p>
      ) : !departure && !arrival ? (
        <p className="mt-2">{t("airportLanding.needPrediction")}</p>
      ) : !weight ? (
        <p>{t("plan.perf.needWeight")}</p>
      ) : null}
      {!departure && arrival && (
        <div
          className="text-muted-foreground mt-3 grid gap-1"
          data-testid="landing-arrival"
        >
          <span>
            {t(
              arrival.mode === "route"
                ? "airportLanding.route"
                : "airportLanding.direct",
            )}{" "}
            · {arrival.distanceNm.toFixed(1)} NM · {Math.ceil(arrival.minutes)}{" "}
            min · ETA{" "}
            {new Date(now + arrival.minutes * 60000)
              .toISOString()
              .slice(11, 16)}{" "}
            UTC
          </span>
          <span>
            {t("airportLanding.arrivalValues", {
              weight: weight ? Math.round(weight.totalKg) : "—",
              fuel: formatFuel(arrival.fuelL, unit),
              unit,
            })}
          </span>
          {!arrival.enoughFuel && (
            <strong className="text-destructive">
              {t("airportLanding.insufficientFuel")}
            </strong>
          )}
          {navigation.holding && arrival.mode === "route" && (
            <span>{t("airportLanding.holding")}</span>
          )}
        </div>
      )}
      <div className="text-muted-foreground mt-2 grid gap-1">
        <span>
          {config.label} · {inputs.oatC}°C · QNH {inputs.qnhHpa} ·{" "}
          {variable
            ? "VRB"
            : String(Math.round(inputs.windDirectionDeg)).padStart(3, "0")}
          °/{inputs.windSpeedKt} kt
        </span>
        <span>
          {t(
            departure
              ? "airportLanding.takeoffWeather"
              : "airportLanding.weather",
            {
              station: station?.icao ?? airport.ident,
            },
          )}
        </span>
        {assumed && <span>{t("airportLanding.assumed")}</span>}
        {availableM === null && (
          <span>
            {t(departure ? "airportLanding.noToda" : "airportLanding.noLda")}
          </span>
        )}
      </div>
      {result && <WarningList warnings={result.warnings} />}
    </section>
  );
}
