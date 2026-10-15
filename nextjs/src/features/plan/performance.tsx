"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type Runway } from "~/data/schemas";
import { densityAltitudeFt, pressureAltitudeFt } from "~/domain/atmosphere";
import {
  type PerformanceWarning,
  type RunwaySurface,
  computeDistance,
} from "~/domain/performance";
import { parseMetar } from "~/domain/metar";
import { windComponents } from "~/domain/wind";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";
import { cn } from "~/lib/utils";

import { NumberField, Section, fmt } from "./fields";
import { usePlan } from "./use-plan";
import { useBriefing } from "./weather";

const surfaceOf = (runway: Runway): RunwaySurface =>
  runway.surface === "grass"
    ? "grass"
    : runway.surface === "unknown"
      ? "unknown"
      : "paved";

function WarningList({ warnings }: { warnings: PerformanceWarning[] }) {
  const t = useT();
  if (!warnings.length) return null;
  return (
    <ul
      className="text-destructive grid gap-1 text-sm"
      aria-label={t("plan.perf.warnings")}
    >
      {warnings.map((w, i) => (
        <li key={i}>
          ⚠{" "}
          {w.code === "above-table"
            ? t("plan.perf.warning.above-table", {
                axis: t(`plan.perf.axis.${w.axis}`),
                value: fmt(w.value),
                max: fmt(w.max),
              })
            : w.code === "not-tabulated"
              ? t("plan.perf.warning.not-tabulated", {
                  axis: t(`plan.perf.axis.${w.axis}`),
                })
              : w.code === "tailwind-above-limit"
                ? t("plan.perf.warning.tailwind-above-limit", {
                    limit: w.limitKt,
                  })
                : t(`plan.perf.warning.${w.code}`)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Take-off or landing distances for the planned airport with the stored inputs. Shared by the
 * planner and the flight view's INFO panel; `empty` names what is missing.
 */
export function usePhasePerformance(phase: "takeoff" | "landing") {
  const { flight, aircraft, loading } = usePlan();
  const point = phase === "takeoff" ? flight.departure : flight.destination;
  const airport = useQuery({
    ...api.airports.get.queryOptions({ code: point?.ident ?? "" }),
    enabled: !!point,
  });
  const update = useFlight((s) => s.update);
  const inputKey = `${phase}|${point?.ident ?? ""}|${aircraft?.id ?? ""}`;
  const inputs = flight.performanceInputs[inputKey] ?? {
    runwayId: null,
    configId: null,
    oatC: 15,
    qnhHpa: 1013,
    windDirectionDeg: 0,
    windSpeedKt: 0,
  };
  const change = (patch: Partial<typeof inputs>) => {
    const current = useFlight.getState().flight;
    update({
      ...(phase === "takeoff" && point && patch.runwayId
        ? {
            departureRunway: {
              airport: point.ident,
              designator: patch.runwayId,
              source: "takeoff" as const,
            },
          }
        : {}),
      performanceInputs: {
        ...current.performanceInputs,
        [inputKey]: {
          ...inputs,
          ...current.performanceInputs[inputKey],
          ...patch,
        },
      },
    });
  };
  const base = { point, inputs, inputKey, change, aircraft };
  const perf = aircraft?.[phase];
  const ap = airport.data;
  const weightKg = loading?.[phase].totalKg;
  if (!point || !ap)
    return { ...base, empty: "plan.perf.needAirport" as const };
  if (!perf) return { ...base, empty: "plan.perf.noData" as const };
  if (weightKg === undefined)
    return { ...base, empty: "plan.perf.needWeight" as const };
  if (!ap.runways.length)
    return { ...base, empty: "plan.perf.noRunways" as const };

  const { runwayId, configId, oatC, qnhHpa, windDirectionDeg, windSpeedKt } =
    inputs;
  const runway =
    ap.runways.find((r) => r.designator === runwayId) ?? ap.runways[0]!;
  const config =
    perf.configurations.find(
      (c) => c.id === (configId ?? perf.defaultConfiguration),
    ) ?? perf.configurations[0]!;
  const pa = pressureAltitudeFt(ap.elevationFt, qnhHpa);
  const wind = windComponents(runway.trueHeadingDeg, {
    directionDeg: windDirectionDeg,
    speedKt: windSpeedKt,
  });
  const result = computeDistance(config, {
    weightKg,
    pressureAltitudeFt: pa,
    temperatureC: oatC,
    headwindKt: wind.headwindKt,
    surface: surfaceOf(runway),
    slopePct: runway.slopePct,
  });
  const availableM = phase === "takeoff" ? runway.toraM : runway.ldaM;
  // Take-off: ground roll must fit the TORA. Landing: distance from 50 ft must fit the LDA.
  const requiredM =
    phase === "takeoff" ? result.groundRollM : result.obstacle50ftM;
  return {
    ...base,
    empty: null,
    perf,
    ap,
    weightKg,
    runway,
    config,
    pa,
    wind,
    result,
    availableM,
    fits: availableM !== null && requiredM <= availableM,
  };
}

function Phase({ phase }: { phase: "takeoff" | "landing" }) {
  const t = useT();
  const p = usePhasePerformance(phase);
  const { point, inputs, inputKey, change, aircraft } = p;
  const { oatC, qnhHpa, windDirectionDeg, windSpeedKt } = inputs;
  const setRunwayId = (runwayId: string) => change({ runwayId });
  const setConfigId = (configId: string) => change({ configId });
  const setOatC = (oatC: number) => change({ oatC });
  const setQnhHpa = (qnhHpa: number) => change({ qnhHpa });
  const setWindDirectionDeg = (windDirectionDeg: number) =>
    change({ windDirectionDeg });
  const setWindSpeedKt = (windSpeedKt: number) => change({ windSpeedKt });
  const { station, briefing } = useBriefing(point);
  const metar = briefing.data?.metar ?? null;
  const [metarNote, setMetarNote] = useState<{
    key: string;
    text: string;
  } | null>(null);

  const title = t(`plan.perf.${phase}`);
  if (p.empty !== null) return <Phase.Empty title={title} text={t(p.empty)} />;
  const {
    perf,
    ap,
    weightKg,
    runway,
    config,
    pa,
    wind,
    result,
    availableM,
    fits,
  } = p;
  const fillFromMetar = () => {
    if (!metar || !station) return;
    const values = parseMetar(metar.raw);
    if (values.temperatureC !== null) setOatC(values.temperatureC);
    if (values.qnhHpa !== null) setQnhHpa(values.qnhHpa);
    setWindSpeedKt(values.windSpeedKt);
    // Variable wind with speed: plan for the worst case, a straight tailwind.
    const variable = values.windDirectionDeg === null && values.windSpeedKt > 0;
    setWindDirectionDeg(
      variable
        ? (runway.trueHeadingDeg + 180) % 360
        : (values.windDirectionDeg ?? 0),
    );
    setMetarNote({
      key: inputKey,
      text: [
        t("plan.perf.fromMetar", {
          icao: station.icao,
          age: fmt(metar.age_minutes),
        }),
        variable && t("plan.perf.variableWind"),
        values.gustKt !== null &&
          t("plan.perf.gusting", { gust: fmt(values.gustKt) }),
        metar.stale && t("plan.wx.stale"),
      ]
        .filter(Boolean)
        .join(" · "),
    });
  };
  const maxCrosswind = aircraft?.windLimits?.maxCrosswindKt ?? null;
  const crosswindKt = Math.abs(wind.crosswindKt);

  return (
    <div className="grid gap-3" data-testid={`perf-${phase}`}>
      <h3 className="font-medium">
        {title} — {ap.ident} {ap.name}
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>{t("plan.perf.runway")}</Label>
          <Select value={runway.designator} onValueChange={setRunwayId}>
            <SelectTrigger
              className="w-full"
              aria-label={t("plan.perf.runway")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ap.runways.map((r) => (
                <SelectItem key={r.designator} value={r.designator}>
                  {r.designator} · {t(`plan.perf.surface.${surfaceOf(r)}`)} ·{" "}
                  {fmt(r.lengthM)} m
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {perf.configurations.length > 1 && (
          <div className="grid gap-1.5">
            <Label>{t("plan.perf.configuration")}</Label>
            <Select value={config.id} onValueChange={setConfigId}>
              <SelectTrigger
                className="w-full"
                aria-label={t("plan.perf.configuration")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {perf.configurations.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <NumberField
          label={t("plan.perf.oat")}
          unit="°C"
          value={oatC}
          onChange={setOatC}
        />
        <NumberField
          label={t("plan.perf.qnh")}
          unit="hPa"
          min={900}
          value={qnhHpa}
          onChange={setQnhHpa}
        />
        <NumberField
          label={t("plan.perf.windDirection")}
          unit="°T"
          min={0}
          value={windDirectionDeg}
          onChange={(v) => setWindDirectionDeg(v % 360)}
        />
        <NumberField
          label={t("plan.perf.windSpeed")}
          unit="kt"
          min={0}
          value={windSpeedKt}
          onChange={setWindSpeedKt}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={!metar}
          onClick={fillFromMetar}
        >
          {t("plan.perf.fillFromMetar")}
        </Button>
        {!metar && (
          <span className="text-muted-foreground">
            {t("plan.perf.noMetar")}
          </span>
        )}
        {metarNote?.key === inputKey && (
          <span
            className="text-muted-foreground"
            data-testid={`perf-${phase}-metar`}
          >
            {metarNote.text}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums sm:grid-cols-4">
        <dt className="text-muted-foreground">
          {t("plan.perf.pressureAltitude")}
        </dt>
        <dd>{fmt(pa)} ft</dd>
        <dt className="text-muted-foreground">
          {t("plan.perf.densityAltitude")}
        </dt>
        <dd>{fmt(densityAltitudeFt(pa, oatC))} ft</dd>
        <dt className="text-muted-foreground">
          {wind.headwindKt >= 0
            ? t("plan.perf.headwind")
            : t("plan.perf.tailwind")}
        </dt>
        <dd>{fmt(Math.abs(wind.headwindKt))} kt</dd>
        <dt className="text-muted-foreground">{t("plan.perf.crosswind")}</dt>
        <dd
          className={cn(
            maxCrosswind !== null &&
              crosswindKt > maxCrosswind &&
              "text-destructive",
          )}
        >
          {fmt(crosswindKt)} kt{maxCrosswind !== null && ` / ${maxCrosswind}`}
        </dd>
        <dt className="text-muted-foreground">{t("plan.perf.groundRoll")}</dt>
        <dd data-testid={`perf-${phase}-ground-roll`}>
          {fmt(result.groundRollM)} m
        </dd>
        <dt className="text-muted-foreground">{t("plan.perf.obstacle50ft")}</dt>
        <dd data-testid={`perf-${phase}-obstacle`}>
          {fmt(result.obstacle50ftM)} m
        </dd>
        <dt className="text-muted-foreground">
          {phase === "takeoff" ? "TORA" : "LDA"}
        </dt>
        <dd className={fits ? "text-ok" : "text-destructive"}>
          {availableM === null
            ? t("plan.perf.unknown")
            : `${fmt(availableM)} m`}
        </dd>
        <dt className="text-muted-foreground">{t("plan.perf.weight")}</dt>
        <dd>{fmt(weightKg)} kg</dd>
        {result.speeds.liftoffKias !== null && (
          <>
            <dt className="text-muted-foreground">{t("plan.perf.liftoff")}</dt>
            <dd>{fmt(result.speeds.liftoffKias)} KIAS</dd>
          </>
        )}
        {result.speeds.obstacle50ftKias !== null && (
          <>
            <dt className="text-muted-foreground">
              {t("plan.perf.speed50ft")}
            </dt>
            <dd>{fmt(result.speeds.obstacle50ftKias)} KIAS</dd>
          </>
        )}
        {result.speeds.approachKias !== null && (
          <>
            <dt className="text-muted-foreground">{t("plan.perf.approach")}</dt>
            <dd>{fmt(result.speeds.approachKias)} KIAS</dd>
          </>
        )}
      </dl>
      {!fits && availableM !== null && (
        <p className="text-destructive text-sm font-medium">
          {t("plan.perf.doesNotFit")}
        </p>
      )}
      <WarningList warnings={result.warnings} />
      {config.notes.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {config.notes.join(" ")}
        </p>
      )}
    </div>
  );
}

Phase.Empty = function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1">
      <h3 className="font-medium">{title}</h3>
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
};

export function PerformanceSection() {
  const t = useT();
  return (
    <Section title={t("plan.perf.title")}>
      <Phase phase="takeoff" />
      <Phase phase="landing" />
      <p className="text-muted-foreground text-xs">
        {t("plan.perf.disclaimer")}
      </p>
    </Section>
  );
}
