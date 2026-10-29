"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { type Airport, type Procedure } from "~/data/schemas";
import { type FlightPhase } from "~/domain/flight-phase";
import { AirportTaxi } from "~/features/plan/taxi";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { formatHeading } from "~/domain/format";

const W = 744;
const H = 1052;
const M = { top: 58, right: 42, bottom: 48, left: 54 };

type ChartPoint = {
  x: number;
  y: number;
  ident: string;
  isAirport: boolean;
  leg: Procedure["legs"][number] | null;
};

/** North-up equirectangular projection of the points into the chart frame, kept to scale. */
function project(
  points: { lat: number; lon: number }[],
): (p: { lat: number; lon: number }) => { x: number; y: number } {
  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * k);
  const ys = points.map((p) => p.lat);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const scale = Math.min(
    (W - M.left - M.right) / Math.max(maxX - minX, 1e-6),
    (H - M.top - M.bottom) / Math.max(maxY - minY, 1e-6),
  );
  const offsetX = M.left + (W - M.left - M.right - (maxX - minX) * scale) / 2;
  const offsetY = M.top + (H - M.top - M.bottom - (maxY - minY) * scale) / 2;
  return (p) => ({
    x: offsetX + (p.lon * k - minX) * scale,
    y: offsetY + (maxY - p.lat) * scale,
  });
}

/** Legacy Nordchart: the procedure's legs to scale with fixes, restrictions, tracks and lengths. */
export function ProcedureChart({
  procedure,
  airport,
  procedures = [procedure],
  runway: selectedRunway,
}: {
  procedure: Procedure;
  airport: Airport;
  procedures?: Procedure[];
  runway?: string;
}) {
  const t = useT();
  const star = procedure.type === "STAR";
  const runway = selectedRunway ?? procedure.runways[0] ?? "--";
  const routes = procedures.map((p) => {
    const legs = p.legs.filter(
      (l): l is typeof l & { lat: number; lon: number } =>
        l.lat !== null && l.lon !== null,
    );
    const field = {
      lat: airport.lat,
      lon: airport.lon,
      ident: `${airport.ident} RWY ${runway}`,
      isAirport: true,
      leg: null,
    };
    return [
      ...(star ? [] : [field]),
      ...legs.map((leg) => ({
        lat: leg.lat,
        lon: leg.lon,
        ident: leg.ident,
        isAirport: false,
        leg,
      })),
      ...(star ? [field] : []),
    ];
  });
  const raw = routes.flat();
  if (raw.length < 2)
    return (
      <p className="text-muted-foreground text-sm">
        {t("fly.chart.noGeometry")}
      </p>
    );
  const xy = project(raw);
  const chartRoutes: ChartPoint[][] = routes.map((route) =>
    route.map((p) => ({ ...p, ...xy(p) })),
  );
  const points = [
    ...new Map(
      chartRoutes.flat().map((p) => [`${p.ident}|${p.x}|${p.y}`, p]),
    ).values(),
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("fly.chart.procedureChart", {
        procedure: procedure.designator,
      })}
      className="h-auto w-full rounded-xl bg-[#fffef7] text-[#080808]"
    >
      <g transform={`translate(${W - 50} 60)`}>
        <text textAnchor="middle" y={-22} fontSize={16} fontWeight={900}>
          N
        </text>
        <path
          d="M 0 25 L 0 -12 M -8 -2 L 0 -12 L 8 -2"
          fill="none"
          stroke="#080808"
          strokeWidth={2.2}
        />
      </g>
      {chartRoutes.map((route, routeIndex) => (
        <polyline
          key={routeIndex}
          points={route.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#080808"
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
      ))}
      {chartRoutes.flatMap((route, r) =>
        route.slice(1).map((p, i) => {
          const a = route[i]!;
          const leg = p.leg;
          let angle = (Math.atan2(p.y - a.y, p.x - a.x) * 180) / Math.PI;
          if (angle > 90) angle -= 180;
          if (angle < -90) angle += 180;
          const track =
            leg?.trackMagDeg != null
              ? `${formatHeading(leg.trackMagDeg)}°`
              : "";
          const length =
            leg?.distanceNm != null
              ? `${Number(leg.distanceNm.toFixed(1))}`
              : "";
          return track || length ? (
            <text
              key={`${r}-${i}`}
              transform={`translate(${(a.x + p.x) / 2} ${(a.y + p.y) / 2}) rotate(${angle})`}
              y={-7}
              textAnchor="middle"
              fontSize={12}
              fontWeight={800}
              paintOrder="stroke"
              stroke="#fffef7"
              strokeWidth={4}
            >
              {[track, length].filter(Boolean).join("  ")}
            </text>
          ) : null;
        }),
      )}
      {points.map((p, i) => {
        const alt = p.leg?.altitude ?? null;
        const rows = [
          p.ident,
          ...(alt ? [alt.raw.replace(/^[+-]|[+-]$/g, "")] : []),
          ...(p.leg?.speedKt ? [`${p.leg.speedKt} KT`] : []),
        ];
        const right = p.x < W - 160;
        return (
          <g key={i} transform={`translate(${p.x} ${p.y})`}>
            {p.isAirport ? (
              <rect x={-6} y={-6} width={12} height={12} fill="#080808" />
            ) : (
              <path
                d="M 0 -5.5 L 5.5 0 L 0 5.5 L -5.5 0 Z"
                fill="#fffef7"
                stroke="#080808"
                strokeWidth={1.8}
              />
            )}
            <text
              x={right ? 10 : -10}
              textAnchor={right ? "start" : "end"}
              fontSize={13}
              fontWeight={900}
              paintOrder="stroke"
              stroke="#fffef7"
              strokeWidth={5}
            >
              {rows.map((row, r) => (
                <tspan key={r} x={right ? 10 : -10} dy={r ? 15 : -2}>
                  {row}
                </tspan>
              ))}
            </text>
            {/* At or above: underline; at or below: overline; exact: both (chart convention). */}
            {alt && rows[1] && (
              <g stroke="#080808" strokeWidth={1.4}>
                {(alt.type === "atOrAbove" || alt.type === "exact") && (
                  <line
                    x1={right ? 10 : -60}
                    x2={right ? 60 : -10}
                    y1={18}
                    y2={18}
                  />
                )}
                {(alt.type === "atOrBelow" || alt.type === "exact") && (
                  <line
                    x1={right ? 10 : -60}
                    x2={right ? 60 : -10}
                    y1={2}
                    y2={2}
                  />
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ChartLinks({ airport }: { airport: string | undefined }) {
  const t = useT();
  const charts =
    useQuery({
      ...api.charts.byAirport.queryOptions({ airport: airport ?? "" }),
      enabled: !!airport,
    }).data ?? [];
  if (!charts.length) return null;
  return (
    <div className="grid gap-1 text-sm">
      <h3 className="text-primary text-xs font-semibold tracking-[0.08em] uppercase">
        {t("fly.chart.official")}
      </h3>
      {charts.map((c) => (
        <a
          key={c.src}
          href={c.src}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {c.title}
        </a>
      ))}
    </div>
  );
}

/**
 * Legacy TAXI / PROC chart buttons: the taxi route on the ground, else the selected SID/STAR as
 * a Nordchart (not for navigation), with the airport's official charts.
 */
export function ChartPanel({ phase }: { phase: FlightPhase }) {
  const t = useT();
  const { flight, departureAirport, destinationAirport, procedureOptions } =
    usePlan();
  const arrival =
    phase === "descent" || phase === "landing" || phase === "taxiin";
  const airport = arrival ? destinationAirport : departureAirport;
  if (phase === "taxiout" || phase === "taxiin") {
    const point = phase === "taxiin" ? flight.destination : flight.departure;
    return (
      <>
        {point && (
          <AirportTaxi
            point={point}
            phase={phase === "taxiin" ? "arrival" : "departure"}
          />
        )}
        <ChartLinks airport={airport?.ident} />
      </>
    );
  }
  const type = arrival ? "STAR" : "SID";
  const selection = arrival ? flight.star : flight.sid;
  const options = procedureOptions(type);
  const procedure =
    selection === "AUTO"
      ? options.suggested
      : (options.procedures.find((p) => p.id === selection) ?? null);
  const navSpec = "RNAV 1";
  return (
    <>
      {procedure && airport ? (
        <>
          <div className="grid gap-1 text-sm sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground text-xs uppercase">
                Nordchart
              </div>
              <strong>
                {airport.ident} {airport.name}
              </strong>
              <div>{t(arrival ? "fly.chart.star" : "fly.chart.sid")}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase">
                {t("fly.chart.selection")}
              </div>
              <strong>{procedure.designator}</strong>
              <div>
                RWY {procedure.runways.join("/") || "--"} / {navSpec}
              </div>
            </div>
            <div>
              <div className="text-destructive text-xs font-semibold uppercase">
                {t("fly.chart.notForNavigation")}
              </div>
              <div className="text-muted-foreground text-xs">
                {t("fly.chart.route")}{" "}
                {procedure.legs.map((l) => l.ident).join(" - ")}
              </div>
            </div>
          </div>
          <ProcedureChart procedure={procedure} airport={airport} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t(arrival ? "fly.chart.noStar" : "fly.chart.noSid")}
        </p>
      )}
      <ChartLinks airport={airport?.ident} />
    </>
  );
}
