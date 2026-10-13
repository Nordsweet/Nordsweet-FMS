"use client";

import {
  densityAltitudeFt,
  isaTemperatureC,
  pressureAltitudeFt,
} from "~/domain/atmosphere";
import { cruisePerformance } from "~/domain/cruise-performance";
import {
  type FlightPhase,
  climbTableFor,
  climbTableRead,
  phaseAirport,
} from "~/domain/flight-phase";
import { fmt, num } from "~/features/plan/fields";
import { usePhasePerformance } from "~/features/plan/performance";
import { settingLabel } from "~/features/plan/route-dialogs";
import { AirportTaxi } from "~/features/plan/taxi";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";

import { Group, Row } from "./emergency-panel";

const DESTINATION: FlightPhase[] = ["descent", "landing", "taxiin"];
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}`;
const climbPair = (label: string, iasKt: number, rateFpm: number) =>
  `${label} ${Math.round(iasKt)} KIAS / ROC ${Math.round(rateFpm)} ft/min`;
const basisText = (b: Partial<Record<string, number>>) =>
  `${b.weightKg} kg / ${b.pressureAltitudeFt} ft / ${b.temperatureC} C`;

/** Legacy INFO: the active phase's performance (the flight view's performancePhasePanel). */
export function InfoPanel({ phase }: { phase: FlightPhase }) {
  const t = useT();
  const {
    flight,
    aircraft,
    departureAirport,
    destinationAirport,
    takeoffWeightKg,
    plan,
  } = usePlan();
  const config = useInFlight((s) => s.config);
  const takeoff = usePhasePerformance("takeoff");
  const landing = usePhasePerformance("landing");
  const destinationSide = DESTINATION.includes(phase);
  const side = destinationSide ? landing : takeoff;
  const airport = phaseAirport(phase, departureAirport, destinationAirport);
  const { oatC, qnhHpa } = side.inputs;
  const runwayLabel =
    airport && side.empty === null
      ? `${airport.ident} RWY ${side.runway.designator}`
      : "n/a";

  // Atmosphere: the cruise level in cruise, else the phase's airport with its performance inputs.
  const cruise = phase === "cruise";
  const elevationFt = cruise
    ? flight.cruiseAltitudeFt
    : (airport?.elevationFt ?? 0);
  const pa = cruise ? elevationFt : pressureAltitudeFt(elevationFt, qnhHpa);
  const oat = cruise ? flight.cruiseOatC : oatC;
  const atmosphere = (
    <Group title={t("fly.info.atmosphere")}>
      <Row
        label={t(cruise ? "fly.info.cruiseAltitude" : "fly.info.elevation")}
        value={`${fmt(elevationFt)} ft`}
      />
      <Row label={t("plan.perf.pressureAltitude")} value={`${fmt(pa)} ft`} />
      <Row
        label={t("plan.perf.densityAltitude")}
        value={`${fmt(densityAltitudeFt(pa, oat))} ft`}
      />
      <Row
        label={t("fly.info.isaDelta")}
        value={`${signed(oat - isaTemperatureC(pa))} C`}
      />
    </Group>
  );

  const rows = ((): React.ReactNode => {
    if (phase === "taxiout" || phase === "taxiin") {
      const point = phase === "taxiout" ? flight.departure : flight.destination;
      return (
        <>
          <Row label={t("fly.info.selectedRunway")} value={runwayLabel} />
          {point && (
            <AirportTaxi
              point={point}
              phase={phase === "taxiout" ? "departure" : "arrival"}
            />
          )}
        </>
      );
    }
    if (phase === "takeoff" || phase === "landing") {
      if (side.empty !== null)
        return <p className="text-muted-foreground text-sm">{t(side.empty)}</p>;
      const { runway, result, weightKg } = side;
      const table = result.obstacle50ftM;
      const available = phase === "takeoff" ? runway.toraM : runway.ldaM;
      const usedOf = phase === "takeoff" ? runway.todaM : runway.ldaM;
      const se = (["vy", "vx"] as const).flatMap((profile) => {
        const oei = climbTableFor(aircraft?.climbTables ?? [], {
          flaps: "up",
          profile,
          engines: "one-inop",
        });
        if (!oei) return [];
        const read = climbTableRead(oei, weightKg, elevationFt, oatC);
        const label = oei.speedLabel.toUpperCase();
        return [
          <Row
            key={`${profile}-i`}
            label={t("fly.info.seInterpolated", { label })}
            value={climbPair(
              label,
              read.interpolated.iasKt,
              read.interpolated.rateFpm,
            )}
          />,
          <Row
            key={`${profile}-t`}
            label={t("fly.info.seTable", { label })}
            value={climbPair(
              label,
              read.conservative.iasKt,
              read.conservative.rateFpm,
            )}
          />,
          ...(profile === "vx"
            ? [
                <Row
                  key="se-basis"
                  label={t("fly.info.seForTable")}
                  value={basisText(read.basis)}
                />,
              ]
            : []),
        ];
      });
      return (
        <>
          <Row
            label={phase === "takeoff" ? "TORA / TODA / ASDA" : "LDA"}
            value={
              phase === "takeoff"
                ? [runway.toraM, runway.todaM, runway.asdaM]
                    .map((m) => (m === null ? "n/a" : `${fmt(m)} m`))
                    .join(" / ")
                : runway.ldaM === null
                  ? "n/a"
                  : `${fmt(runway.ldaM)} m`
            }
          />
          <Row
            label={t("fly.info.wbWeight")}
            value={t(
              phase === "takeoff"
                ? "fly.info.currentCondition"
                : "fly.info.landingCondition",
              { weight: fmt(weightKg) },
            )}
          />
          <Row
            label={t("plan.perf.groundRoll")}
            value={`${fmt(result.interpolatedCorrected.groundRollM)} m`}
          />
          <Row
            label={t("fly.info.at50ft")}
            value={`${fmt(result.interpolatedCorrected.obstacle50ftM)} m`}
          />
          <Row
            label={t("fly.info.tableCorrected")}
            value={`GR ${fmt(result.groundRollM)} m / 50 ft ${fmt(table)} m`}
          />
          <Row
            label={t("fly.emer.forTable")}
            value={basisText(result.tableBasis)}
          />
          <Row
            label={t(
              phase === "takeoff"
                ? "fly.info.marginTora"
                : "fly.info.marginLda",
            )}
            value={
              available === null ? "n/a" : `${signed(available - table)} m`
            }
          />
          {phase === "takeoff" ? (
            <Row
              label={t("fly.info.liftoff50ft")}
              value={`${fmt(result.speeds.liftoffKias ?? NaN)} / ${fmt(result.speeds.obstacle50ftKias ?? NaN)} KIAS`}
            />
          ) : (
            <Row
              label={t("plan.perf.approach")}
              value={`${fmt(result.speeds.approachKias ?? NaN)} KIAS`}
            />
          )}
          {phase === "takeoff" && se.length > 0 && (
            <>
              <Row
                label={t("fly.info.seBasis")}
                value={`Elev ${fmt(elevationFt)} ft / Temp ${fmt(oatC)} C`}
              />
              {se}
            </>
          )}
          {usedOf !== null && (
            <Row
              label={t(
                phase === "takeoff" ? "fly.info.todUsed" : "fly.info.ldaUsed",
              )}
              value={`${fmt(table)} m / ${fmt(usedOf)} m · ${((table / usedOf) * 100).toFixed(1)}%`}
            />
          )}
        </>
      );
    }
    if (phase === "climb") {
      const table = climbTableFor(aircraft?.climbTables ?? [], config.climb);
      // Aircraft without the legacy P2006T tables: their one climb table is Vy, both engines.
      const fallback =
        !aircraft?.climbTables.length &&
        config.climb.profile === "vy" &&
        config.climb.engines === "both"
          ? aircraft?.climb
          : null;
      const grid = table ?? fallback;
      const label = table?.speedLabel ?? "Vy";
      const read = grid
        ? climbTableRead(grid, takeoffWeightKg, pa, oatC)
        : null;
      return (
        <>
          <Row
            label={t("fly.info.departure")}
            value={
              departureAirport
                ? `${departureAirport.ident} - ${departureAirport.name}`
                : "n/a"
            }
          />
          <Row
            label={t("plan.perf.pressureAltitude")}
            value={`${fmt(pa)} ft`}
          />
          <Row
            label={t("plan.perf.configuration")}
            value={
              table
                ? `Gear ${table.landingGear} / Flaps ${table.flapsLabel} / ${table.powerSetting}`
                : (fallback?.label ?? "n/a")
            }
          />
          {read ? (
            <>
              <Row
                label={t("fly.info.interpolated", { label })}
                value={climbPair(
                  label,
                  read.interpolated.iasKt,
                  read.interpolated.rateFpm,
                )}
              />
              <Row
                label={t("fly.info.table", { label })}
                value={climbPair(
                  label,
                  read.conservative.iasKt,
                  read.conservative.rateFpm,
                )}
              />
              <Row
                label={t("fly.info.forTable", { label })}
                value={basisText(read.basis)}
              />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("fly.info.noData")}
            </p>
          )}
        </>
      );
    }
    if (phase === "cruise") {
      const wind = plan?.routeWindComponentKt ?? 0;
      const perf = aircraft?.cruise
        ? cruisePerformance(
            aircraft.cruise,
            flight.cruiseAltitudeFt,
            flight.cruiseOatC,
            wind,
            config.cruiseMode,
          )
        : null;
      return (
        <>
          <Row
            label={t("fly.info.cruiseAltitude")}
            value={`${fmt(flight.cruiseAltitudeFt)} ft`}
          />
          <Row
            label={t("fly.info.altitudeSource")}
            value={t("fly.info.planner")}
          />
          <Row
            label={t("fly.info.oatIsa")}
            value={`${signed(flight.cruiseOatC)} C / ISA ${signed(flight.cruiseOatC - isaTemperatureC(flight.cruiseAltitudeFt))} C`}
          />
          <Row label={t("fly.info.wind")} value={`${fmt(wind)} kt`} />
          <Row
            label={t("fly.info.engineMode")}
            value={t(`fly.config.${config.cruiseMode}`)}
          />
          <Row
            label={t("fly.info.engSetting")}
            value={perf ? settingLabel(perf.setting) : "n/a"}
          />
          <Row
            label={t("fly.info.interpolatedData")}
            value={
              perf
                ? `${perf.powerPct === null ? "" : `${num(perf.powerPct)}% PWR / `}${num(perf.ktas)} KTAS / ${num(perf.fuelFlowLph)} l/h total`
                : "n/a"
            }
          />
          <Row
            label={t("fly.info.gsEstimate")}
            value={perf ? `${num(perf.groundSpeedKt)} kt` : "n/a"}
          />
        </>
      );
    }
    // Descent.
    return (
      <>
        <Row
          label={t("fly.info.destination")}
          value={
            destinationAirport
              ? `${destinationAirport.ident} - ${destinationAirport.name}`
              : "n/a"
          }
        />
        <Row label={t("fly.info.selectedRunway")} value={runwayLabel} />
        <Row
          label={t("fly.info.cruiseAltitude")}
          value={`${fmt(flight.cruiseAltitudeFt)} ft`}
        />
        <Row label={t("fly.info.elevation")} value={`${fmt(elevationFt)} ft`} />
        <Row label={t("plan.perf.pressureAltitude")} value={`${fmt(pa)} ft`} />
      </>
    );
  })();

  const where = airport?.ident ?? "";
  return (
    <>
      <p className="text-muted-foreground -mt-2 text-sm">
        {t(`fly.info.context.${phase}`, {
          airport: where,
          altitude: fmt(flight.cruiseAltitudeFt),
        })}
      </p>
      <Group title={t(`fly.phase.${phase}`)}>{rows}</Group>
      {atmosphere}
    </>
  );
}
