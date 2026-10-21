"use client";

import { fuelUnit, formatFuel, parseFuel } from "~/domain/fuel-units";
import { type WeightBalance } from "~/data/aircraft";
import { aircraftLabel, normalizeRegistration } from "~/domain/aircraft";
import {
  type LoadingResult,
  type WeightBalanceSheet,
} from "~/domain/weight-balance";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";

import { OverrideCell, OverrideInput, Section, num } from "./fields";
import { usePlan } from "./use-plan";

const kgInput = (text: string) => {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? Math.min(300, Math.max(0, n)) : null;
};

export function WeightBalanceSection() {
  const t = useT();
  const { flight, aircraft, weightBalance: sheet } = usePlan();
  const update = useFlight((s) => s.update);
  // Legacy shows the flight view's phase (taxi-out before a flight).
  const phase = useInFlight((s) => s.phase);
  const wb = aircraft?.weightBalance;

  if (!aircraft || !wb || !sheet)
    return (
      <Section>
        <p className="text-muted-foreground text-sm">
          {aircraft ? t("plan.wb.noData") : t("plan.aircraft.placeholder")}
        </p>
      </Section>
    );

  const unit = fuelUnit(aircraft.type, flight.fuelDisplayUnit);
  const registration = normalizeRegistration(flight.registration);
  const inside = sheet.takeoff.withinEnvelope;
  const fuelRow = (
    label: string,
    fuel: { litres: number; weightKg: number },
    moment: number,
    input?: { aria: string; onCommit: (litres: number | null) => void },
  ) => (
    <tr className="border-border border-t">
      <td className="px-2 py-1">{label}</td>
      <td className="px-1.5 py-1">
        <div className="flex items-center gap-2">
          {input ? (
            <OverrideInput
              className="w-24"
              label={input.aria}
              value={fuel.litres}
              suggested={false}
              key={unit}
              format={(value) => formatFuel(value, unit)}
              parse={(text) => parseFuel(text, unit)}
              onCommit={input.onCommit}
            />
          ) : (
            <span>
              {formatFuel(fuel.litres, unit)} {unit}
            </span>
          )}
          <span className="text-muted-foreground whitespace-nowrap">
            = {num(fuel.weightKg, 1)} kg
          </span>
        </div>
      </td>
      <td className="px-2 text-center">{num(sheet.fuel.armM, 3)}</td>
      <td className="px-2 text-center font-semibold">{num(moment, 1)}</td>
    </tr>
  );
  const totalRow = (
    label: string,
    result: LoadingResult,
    momentLabel: string,
    testId: string,
  ) => (
    <tr
      className="border-border border-t bg-[#e8e35a] font-semibold text-[#111827]"
      data-testid={testId}
    >
      <td className="px-2 py-2">{label}</td>
      <td className="px-2 text-center">{num(result.totalKg, 1)}</td>
      <td className="px-2 text-center text-xs">{momentLabel}</td>
      <td className="px-2 text-center">{num(result.momentKgm, 1)}</td>
    </tr>
  );

  return (
    <Section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Card label={t("plan.aircraft.title")}>
          {aircraftLabel(aircraft)}
          {registration && ` / ${registration}`}
        </Card>
        <Card label={t("plan.wb.phase")}>{t(`fly.phase.${phase}`)}</Card>
        <Card label={t("plan.wb.loadedWeight")}>
          {num(sheet.takeoff.totalKg, 1)} kg
        </Card>
        <Card label={t("plan.wb.loadedMoment")}>
          {num(sheet.takeoff.momentKgm, 1)} kgm
        </Card>
        <Card label="MTOW">{num(sheet.mtowKg)} kg</Card>
        <Card label="LW">
          {num(sheet.maxLandingKg, 1)} kg {t("plan.wb.lwBasis")}
        </Card>
        <Card label="ALW">
          {num(sheet.alternateLanding.totalKg, 1)} kg {t("plan.wb.alwBasis")}
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <div className="overflow-x-auto rounded-[14px] border">
            <table className="w-full min-w-[30rem] text-sm tabular-nums">
              <thead className="bg-[rgba(16,30,52,0.92)] text-xs tracking-[0.06em] uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">
                    {t("plan.wb.station")}
                  </th>
                  <th className="px-2 py-2">
                    {t("plan.wb.weightOrFuel", { unit })}
                  </th>
                  <th className="px-2 py-2">{t("plan.wb.arm")}</th>
                  <th className="px-2 py-2">{t("plan.wb.moment")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-border border-t">
                  <td className="px-2 py-2">{t("plan.wb.empty")}</td>
                  <td className="px-2 text-center">
                    {num(sheet.empty.weightKg, 1)}
                  </td>
                  <td className="px-2 text-center">
                    {num(sheet.empty.armM, 3)}
                  </td>
                  <td className="px-2 text-center font-semibold">
                    {num(sheet.empty.momentKgm, 1)}
                  </td>
                </tr>
                <tr className="border-border border-t">
                  <td
                    colSpan={4}
                    className="bg-[linear-gradient(90deg,rgba(122,243,211,0.92),rgba(93,193,255,0.85))] px-2 py-1.5 text-center text-xs font-bold tracking-[0.08em] text-[#06101b] uppercase"
                  >
                    {t("plan.wb.usefulLoad")}
                  </td>
                </tr>
                {sheet.stations.map((station) => {
                  const label = t(`plan.wb.station.${station.id}`);
                  return (
                    <tr key={station.id} className="border-border border-t">
                      <td className="px-2 py-1">{label}</td>
                      <OverrideCell
                        label={t("plan.wb.weightOf", { station: label })}
                        value={station.weightKg}
                        suggested={false}
                        format={(kg) => (kg ? String(kg) : "")}
                        parse={kgInput}
                        onCommit={(kg) =>
                          update({
                            stationsKg: {
                              ...flight.stationsKg,
                              [station.id]: kg ?? 0,
                            },
                          })
                        }
                      />
                      <td className="px-2 text-center">
                        {num(station.armM, 3)}
                      </td>
                      <td className="px-2 text-center font-semibold">
                        {num(station.momentKgm, 1)}
                      </td>
                    </tr>
                  );
                })}
                {fuelRow(
                  t("plan.wb.usableFuel").replace("[L]", `[${unit}]`),
                  sheet.fuel.usable,
                  sheet.fuel.usable.weightKg * sheet.fuel.armM,
                  {
                    aria: t("plan.wb.usableFuel").replace("[L]", `[${unit}]`),
                    // Same value as the Fuel tab's block fuel, as in the legacy planner.
                    onCommit: (blockL) =>
                      update({ fuel: { blockL: blockL ?? 0 } }),
                  },
                )}
                {totalRow(
                  t("plan.wb.current"),
                  sheet.takeoff,
                  t("plan.wb.currentMoment"),
                  "wb-takeoff",
                )}
                {fuelRow(
                  t("plan.wb.tripFuel").replace("[L]", `[${unit}]`),
                  sheet.fuel.trip,
                  sheet.fuel.trip.weightKg * sheet.fuel.armM,
                  {
                    aria: t("plan.wb.tripFuel").replace("[L]", `[${unit}]`),
                    // Same value as the Fuel tab's trip fuel.
                    onCommit: (fuelL) =>
                      update({
                        fuelOverrides: {
                          ...flight.fuelOverrides,
                          plannedTrip: {
                            ...flight.fuelOverrides.plannedTrip,
                            fuelL,
                          },
                        },
                      }),
                  },
                )}
                {totalRow(
                  t("plan.wb.landingCondition"),
                  sheet.landing,
                  t("plan.wb.landingMoment"),
                  "wb-landing",
                )}
                {fuelRow(
                  t("plan.wb.alternateFuel"),
                  sheet.fuel.alternate,
                  sheet.fuel.alternate.weightKg * sheet.fuel.armM,
                )}
                {totalRow(
                  t("plan.wb.alternateCondition"),
                  sheet.alternateLanding,
                  t("plan.wb.alternateMoment"),
                  "wb-alternate",
                )}
              </tbody>
            </table>
          </div>
          <p
            data-testid="wb-status"
            className={cn(
              "rounded-2xl border px-3.5 py-3 text-sm",
              inside
                ? "border-ok/40 text-ok"
                : "border-destructive/40 text-destructive",
            )}
          >
            {inside ? t("plan.wb.inside") : t("plan.wb.outside")}
          </p>
        </div>
        <EnvelopeChart wb={wb} sheet={sheet} />
      </div>
    </Section>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-[14px] border bg-[rgba(7,17,31,0.48)] px-3 py-2">
      <span className="text-muted-foreground text-[0.7rem] tracking-[0.08em] uppercase">
        {label}
      </span>
      <strong className="text-sm">{children}</strong>
    </div>
  );
}

/** Round grid values about `lines` apart (legacy getWeightBalanceGridValues). */
function gridValues(min: number, max: number, lines: number) {
  const raw = Math.max(1, Math.abs(max - min) / Math.max(1, lines));
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) *
    magnitude;
  const values = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.01; v += step)
    values.push(Math.round(v * 1000) / 1000);
  return values;
}

/** The CG envelope in (moment, weight) space with MTOW and the TOW, LW and ALW points, as in legacy. */
function EnvelopeChart({
  wb,
  sheet,
}: {
  wb: WeightBalance;
  sheet: WeightBalanceSheet;
}) {
  const t = useT();
  const width = 720;
  const height = 420;
  const m = { top: 26, right: 24, bottom: 45, left: 58 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  // Legacy axes: the profile's chart bounds, else the envelope's extents.
  const moments = wb.envelope.map((p) => p.momentKgm);
  const weights = wb.envelope.map((p) => p.weightKg);
  const minM = wb.chartBounds?.minMomentKgm ?? Math.min(...moments);
  const maxM = wb.chartBounds?.maxMomentKgm ?? Math.max(...moments);
  const minW = wb.chartBounds?.minWeightKg ?? Math.min(...weights);
  const maxW = wb.chartBounds?.maxWeightKg ?? Math.max(...weights);
  const x = (moment: number) =>
    Math.max(
      m.left,
      Math.min(
        m.left + plotW,
        m.left + ((moment - minM) / (maxM - minM)) * plotW,
      ),
    );
  const y = (weight: number) =>
    Math.max(
      m.top,
      Math.min(
        m.top + plotH,
        m.top + plotH - ((weight - minW) / (maxW - minW)) * plotH,
      ),
    );
  const point = (
    label: string,
    result: LoadingResult,
    colours: [inside: string, outside: string],
    dy: number,
    filled: boolean,
  ) => {
    if (!(result.totalKg > 0)) return null;
    const colour = result.withinEnvelope ? colours[0] : colours[1];
    const px = x(result.momentKgm);
    const py = y(result.totalKg);
    return (
      <g>
        <line
          x1={px}
          y1={m.top}
          x2={px}
          y2={m.top + plotH}
          stroke={colour}
          strokeWidth={1.4}
          strokeDasharray="4 5"
        />
        <line
          x1={m.left}
          y1={py}
          x2={m.left + plotW}
          y2={py}
          stroke={colour}
          strokeWidth={1.4}
          strokeDasharray="4 5"
        />
        <circle
          cx={px}
          cy={py}
          r={6}
          fill={filled ? colour : "#fff"}
          stroke={filled ? "#06101b" : colour}
          strokeWidth={filled ? 2 : 3}
        />
        <text
          x={px + 10}
          y={py + dy}
          fontSize={12}
          fontWeight={900}
          fill={colour}
        >
          {label} {num(result.totalKg, 1)} kg
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t("plan.wb.chart")}
      className="h-auto w-full rounded-[14px]"
    >
      <rect width={width} height={height} fill="#f9fbff" />
      {gridValues(minM, maxM, 8).map((v) => (
        <g key={`m${v}`}>
          <line
            x1={x(v)}
            y1={m.top}
            x2={x(v)}
            y2={m.top + plotH}
            stroke="#e1e8f2"
          />
          <text
            x={x(v)}
            y={height - 16}
            textAnchor="middle"
            fontSize={10}
            fill="#526273"
          >
            {num(v)}
          </text>
        </g>
      ))}
      {gridValues(minW, maxW, 7).map((v) => (
        <g key={`w${v}`}>
          <line
            x1={m.left}
            y1={y(v)}
            x2={m.left + plotW}
            y2={y(v)}
            stroke="#e7edf5"
          />
          <text
            x={m.left - 10}
            y={y(v) + 3}
            textAnchor="end"
            fontSize={10}
            fill="#526273"
          >
            {num(v)}
          </text>
        </g>
      ))}
      <polygon
        points={wb.envelope
          .map((p) => `${x(p.momentKgm)},${y(p.weightKg)}`)
          .join(" ")}
        fill="rgba(93, 193, 255, 0.08)"
        stroke="#111827"
        strokeWidth={2.2}
      />
      <line
        x1={m.left}
        y1={y(wb.mtowKg)}
        x2={m.left + plotW}
        y2={y(wb.mtowKg)}
        stroke="#d92d45"
        strokeWidth={1.8}
        strokeDasharray="8 6"
      />
      <text
        x={m.left + plotW - 8}
        y={y(wb.mtowKg) - 7}
        textAnchor="end"
        fontSize={11}
        fontWeight={900}
        fill="#d92d45"
      >
        MTOW {num(wb.mtowKg)} kg
      </text>
      {point("TOW", sheet.takeoff, ["#28c76f", "#ff4d6d"], -10, true)}
      {point("LW", sheet.landing, ["#1677ff", "#ff8a00"], 16, false)}
      {point("ALW", sheet.alternateLanding, ["#8b5cf6", "#ff4d6d"], 32, false)}
      <text
        x={m.left + plotW / 2}
        y={height - 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={900}
        fill="#111827"
      >
        {t("plan.wb.moment")}
      </text>
      <text
        x={16}
        y={m.top + plotH / 2}
        textAnchor="middle"
        transform={`rotate(-90 16 ${m.top + plotH / 2})`}
        fontSize={12}
        fontWeight={900}
        fill="#111827"
      >
        {t("plan.wb.weightAxis")}
      </text>
      <text
        x={width - 28}
        y={m.top + 18}
        textAnchor="end"
        fontSize={11}
        fontWeight={900}
        fill="#111827"
      >
        {t("plan.wb.envelope")}
      </text>
    </svg>
  );
}
