"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { type WxRow } from "~/domain/route-plan";
import { formatHhMm } from "~/domain/fuel-planning";
import { economySuggestions, rpmMap } from "~/domain/route-economy";
import {
  type RoutePlan,
  altitudeRestriction,
  formatRoutePoint,
  formatRouteWind,
  isRestrictionConflict,
  pointKey,
} from "~/domain/route-plan";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";

import { num } from "./fields";
import { usePlan } from "./use-plan";

const card =
  "grid gap-1 rounded-[14px] border border-[rgba(141,190,255,0.16)] bg-[rgba(16,30,52,0.6)] px-3 py-2";
const cardLabel =
  "text-muted-foreground text-[0.7rem] font-semibold tracking-[0.08em] uppercase";
const table =
  "w-full text-sm tabular-nums [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1.5";
const head =
  "bg-[rgba(16,30,52,0.92)] text-left text-xs tracking-[0.06em] uppercase";

/** Legacy altitude label: "S.L." at sea level. */
const altitudeLabel = (ft: number | null | undefined) =>
  ft === null || ft === undefined || !Number.isFinite(ft)
    ? "n/a"
    : ft === 0
      ? "S.L."
      : `${Math.round(ft)} ft`;

/** Legacy "2250 RPM / MAP 28"; other table settings as written. */
const settingLabel = (setting: string) => {
  const s = rpmMap(setting);
  return s ? `${s.rpm} RPM / MAP ${num(s.mapInHg)}` : setting;
};

function Cards({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className={card}>
          <span className={cardLabel}>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

const EMPTY_ROW: WxRow = { altitudeFt: "", windDirection: "", windSpeed: "" };

export function WaypointWxDialog({
  pointKey: key,
  onClose,
}: {
  pointKey: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const { plan, flight } = usePlan();
  const update = useFlight((s) => s.update);
  const stored = key ? (flight.waypointWx[key] ?? []) : [];
  // Always one blank row to add the next level.
  const rows =
    !stored.length || stored.at(-1)!.altitudeFt
      ? [...stored, EMPTY_ROW]
      : stored;
  const altitudeFt =
    (key ? plan?.pointAltitudeByKey[key] : undefined) ??
    flight.cruiseAltitudeFt;
  const commit = (index: number, field: keyof WxRow, value: string) => {
    if (!key) return;
    const next = rows.map((r, i) =>
      i === index ? { ...r, [field]: value.trim() } : r,
    );
    while (
      next.length &&
      !next.at(-1)!.altitudeFt &&
      !next.at(-1)!.windDirection &&
      !next.at(-1)!.windSpeed
    )
      next.pop();
    update({ waypointWx: { ...flight.waypointWx, [key]: next } });
  };
  const fields: [keyof WxRow, string, number | undefined, number][] = [
    ["altitudeFt", t("plan.route.wx.altitude"), undefined, 500],
    ["windDirection", t("plan.route.wx.direction"), 360, 1],
    ["windSpeed", t("plan.route.wx.speed"), undefined, 1],
  ];
  return (
    <Dialog open={key !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
        <DialogTitle>
          {t("plan.route.wx.title", { point: key ?? "" })}
        </DialogTitle>
        <DialogDescription>
          {t("plan.route.wx.subtitle", { altitude: Math.round(altitudeFt) })}
        </DialogDescription>
        <div className="grid gap-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              {fields.map(([field, label, max, step]) => (
                <label key={field} className="grid gap-1">
                  <span className={cardLabel}>{label}</span>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step={step}
                    inputMode="numeric"
                    aria-label={`${label} ${i + 1}`}
                    defaultValue={row[field]}
                    onBlur={(e) =>
                      e.target.value.trim() !== row[field] &&
                      commit(i, field, e.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EconomyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { plan, aircraft, flight, routeInput } = usePlan();
  const update = useFlight((s) => s.update);
  const result = !open
    ? null
    : !plan || !routeInput
      ? { error: "no-route" as const }
      : !aircraft?.cruise
        ? { error: "no-cruise" as const }
        : economySuggestions(
            plan,
            aircraft.cruise,
            flight.cruiseOatC,
            routeInput,
          );
  const error = result?.error;
  const ok = result && !result.error ? result : null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{t("plan.route.economy")}</DialogTitle>
        <DialogDescription>
          {t(ok ? "plan.route.eco.subtitle" : "plan.route.eco.subtitleError")}
        </DialogDescription>
        {error ? (
          <div className={card}>
            <strong>{t("plan.route.eco.unavailable")}</strong>
            <span>{t(`plan.route.eco.error.${error}`)}</span>
            <span className="text-muted-foreground text-xs">
              {t("plan.route.eco.errorHelp")}
            </span>
          </div>
        ) : ok && plan ? (
          <>
            <Cards
              items={[
                [
                  t("plan.route.eco.route"),
                  `${plan.departure.ident} -> ${plan.destination.ident}`,
                ],
                [t("plan.route.eco.fuel"), `${num(ok.totalFuelL)} l`],
                [t("plan.route.eco.time"), formatHhMm(ok.hours * 60)],
                [
                  t("plan.route.eco.avgGs"),
                  `${num(ok.averageGroundSpeedKt, 0)} kt`,
                ],
                [
                  t("plan.route.eco.avgSetting"),
                  ok.averageSetting
                    ? `${num(ok.averageSetting.rpm, 0)} RPM / MAP ${num(ok.averageSetting.mapInHg)}`
                    : "--",
                ],
                [
                  t("plan.route.eco.avgPower"),
                  `${num(ok.averagePowerPct, 0)}%`,
                ],
                [
                  t("plan.route.eco.windSource"),
                  ok.routeWeatherAvailable
                    ? t("plan.route.eco.windWaypoint")
                    : t("plan.route.cruiseTile"),
                ],
                [t("plan.route.eco.oat"), `${num(ok.oatC, 0)} C`],
              ]}
            />
            <p className={cn(card, "text-sm")}>{t("plan.route.eco.note")}</p>
            <div className="overflow-x-auto rounded-[14px] border">
              <table className={table} data-testid="economy-points">
                <thead className={head}>
                  <tr>
                    <th>#</th>
                    <th>{t("plan.route.eco.waypoint")}</th>
                    <th>{t("plan.route.eco.suggested")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ok.points.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td>{i + 1}</td>
                      <td className="font-semibold">
                        {formatRoutePoint(p.point)}
                      </td>
                      <td className="text-primary">
                        {altitudeLabel(p.altitudeFt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-[14px] border">
              <table className={cn(table, "min-w-[40rem]")}>
                <thead className={head}>
                  <tr>
                    <th>{t("plan.route.eco.leg")}</th>
                    <th>{t("plan.route.eco.legAltitude")}</th>
                    <th>{t("plan.route.eco.gs")}</th>
                    <th>{t("plan.route.eco.fuelPerNm")}</th>
                    <th>{t("plan.route.eco.setting")}</th>
                    <th>{t("plan.route.eco.wind")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ok.legs.map((leg, i) =>
                    leg ? (
                      <tr key={i} className="border-t">
                        <td className="font-semibold">
                          {formatRoutePoint(plan.legs[i]!.from)} -&gt;{" "}
                          {formatRoutePoint(plan.legs[i]!.to)}
                        </td>
                        <td className="text-primary">
                          {altitudeLabel(leg.altitudeFt)}
                        </td>
                        <td>{num(leg.groundSpeedKt, 0)} kt</td>
                        <td>{num(leg.fuelPerNm, 2)} l/NM</td>
                        <td>{settingLabel(leg.performance.setting)}</td>
                        <td>{formatRouteWind(leg.windComponentKt)}</td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("plan.route.close")}
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              if (!ok) return;
              const next = { ...flight.waypointAltitudes };
              for (const p of ok.points)
                if (p.key) next[p.key] = Math.round(p.altitudeFt);
              update({ waypointAltitudes: next });
              onClose();
            }}
          >
            {t("plan.route.eco.apply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function profileSamples(plan: RoutePlan) {
  return plan.points.map((point, i) => {
    const key = pointKey(point);
    const altitudeFt = plan.pointAltitudeByKey[key] ?? plan.altitudeFt;
    const restriction = altitudeRestriction(point);
    const role = plan.verticalProfile.profileRolesByKey[key] ?? "";
    return {
      point,
      index: i + 1,
      altitudeFt,
      distanceNm: point.routeDistanceNm ?? 0,
      restriction,
      conflict: isRestrictionConflict(altitudeFt, restriction),
      role,
      label: role
        ? `${formatRoutePoint(point)} / ${role}`
        : formatRoutePoint(point),
    };
  });
}

export function VerticalProfileDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { plan } = usePlan();
  const samples = open && plan ? profileSamples(plan) : [];
  const find = (id: string) =>
    samples.find(
      (s) => s.label === id || (s.point.profileLabels ?? []).includes(id),
    );
  const toc = find("TOC");
  const tod = find("TOD");
  const soc = samples.find((s) => s.role === "SOC");
  const maxAltitude = samples.reduce((m, s) => Math.max(m, s.altitudeFt), 0);
  const conflicts = samples.filter((s) => s.conflict).length;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{t("plan.route.verticalProfile")}</DialogTitle>
        <DialogDescription>
          {plan
            ? `${plan.departure.ident} -> ${plan.destination.ident} / ${num(plan.totalDistanceNm)} NM`
            : t("plan.route.vp.subtitle")}
        </DialogDescription>
        {!plan ? (
          <p className={card}>{t("plan.route.vp.error")}</p>
        ) : (
          <>
            <Cards
              items={[
                [
                  t("plan.route.eco.route"),
                  `${plan.departure.ident} -> ${plan.destination.ident}`,
                ],
                [
                  t("plan.route.vp.distance"),
                  `${num(plan.totalDistanceNm)} NM`,
                ],
                [
                  t("plan.route.vp.target"),
                  altitudeLabel(plan.verticalProfile.routeTargetAltitudeFt),
                ],
                [t("plan.route.vp.max"), altitudeLabel(maxAltitude)],
                ["TOC", toc ? `${num(toc.distanceNm)} NM` : "n/a"],
                [
                  "SOC",
                  soc ? `${soc.point.id} / ${num(soc.distanceNm)} NM` : "n/a",
                ],
                ["TOD", tod ? `${num(tod.distanceNm)} NM` : "n/a"],
                [
                  t("plan.route.vp.gradient"),
                  `${Math.round(plan.verticalProfile.climbGradientFtPerNm)} ft/NM`,
                ],
                [
                  t("plan.route.vp.restrictions"),
                  conflicts
                    ? t("plan.route.vp.conflicts", { count: conflicts })
                    : t("plan.route.vp.ok"),
                ],
              ]}
            />
            <ProfileChart plan={plan} samples={samples} />
            <div className="overflow-x-auto rounded-[14px] border">
              <table className={table} data-testid="profile-table">
                <thead className={head}>
                  <tr>
                    <th>#</th>
                    <th>{t("plan.route.vp.point")}</th>
                    <th>{t("plan.route.vp.distance")}</th>
                    <th>{t("plan.route.vp.altitude")}</th>
                    <th>{t("plan.route.leg.restriction")}</th>
                    <th>{t("plan.route.vp.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s) => (
                    <tr
                      key={s.index}
                      className={cn(
                        "border-t",
                        s.conflict && "text-destructive",
                      )}
                    >
                      <td>{s.index}</td>
                      <td className="font-semibold">{s.label}</td>
                      <td>{num(s.distanceNm)} NM</td>
                      <td className="text-primary">
                        {altitudeLabel(s.altitudeFt)}
                      </td>
                      <td>{s.restriction?.label ?? "--"}</td>
                      <td>
                        {s.conflict
                          ? t("plan.route.vp.conflict")
                          : t("plan.route.vp.ok")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileChart({
  plan,
  samples,
}: {
  plan: RoutePlan;
  samples: ReturnType<typeof profileSamples>;
}) {
  const t = useT();
  const width = 960;
  const height = 420;
  const m = { bottom: 54, left: 70, right: 34, top: 30 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const total = Math.max(1, plan.totalDistanceNm);
  const rawMax = samples.reduce(
    (v, s) => Math.max(v, s.altitudeFt),
    plan.altitudeFt,
  );
  const maxAltitude = Math.max(1000, Math.ceil((rawMax + 500) / 1000) * 1000);
  const x = (d: number) =>
    m.left + (Math.max(0, Math.min(d, total)) / total) * plotW;
  const y = (a: number) =>
    m.top +
    plotH -
    (Math.max(0, Math.min(a, maxAltitude)) / maxAltitude) * plotH;
  const line = samples
    .map((s) => `${x(s.distanceNm)},${y(s.altitudeFt)}`)
    .join(" ");
  const ticks = [0, 1, 2, 3, 4, 5];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t("plan.route.vp.chart")}
      className="w-full"
    >
      {ticks.map((i) => {
        const altitude = (maxAltitude / 5) * i;
        const distance = (total / 5) * i;
        return (
          <g
            key={i}
            className="fill-muted-foreground stroke-[rgba(141,190,255,0.14)] text-[13px]"
          >
            <line
              x1={m.left}
              x2={m.left + plotW}
              y1={y(altitude)}
              y2={y(altitude)}
            />
            <text
              x={m.left - 12}
              y={y(altitude) + 4}
              textAnchor="end"
              stroke="none"
            >
              {altitudeLabel(altitude)}
            </text>
            <line
              x1={x(distance)}
              x2={x(distance)}
              y1={m.top}
              y2={m.top + plotH}
            />
            <text
              x={x(distance)}
              y={m.top + plotH + 28}
              textAnchor="middle"
              stroke="none"
            >
              {Math.round(distance)} NM
            </text>
          </g>
        );
      })}
      <polygon
        points={`${m.left},${m.top + plotH} ${line} ${m.left + plotW},${m.top + plotH}`}
        className="fill-[rgba(122,243,211,0.12)]"
      />
      <polyline points={line} className="stroke-primary fill-none stroke-[3]" />
      {samples.map((s, i) => {
        const anchor =
          i === 0 ? "start" : i === samples.length - 1 ? "end" : "middle";
        const lx =
          i === 0
            ? x(s.distanceNm) + 4
            : i === samples.length - 1
              ? x(s.distanceNm) - 4
              : x(s.distanceNm);
        const ly = y(s.altitudeFt) - 12;
        return (
          <g key={s.index} className="text-[12px]">
            <circle
              cx={x(s.distanceNm)}
              cy={y(s.altitudeFt)}
              r={s.point.isProfilePoint ? 5 : 4.5}
              className={cn(
                s.conflict
                  ? "fill-destructive"
                  : s.point.isProfilePoint
                    ? "fill-warn"
                    : "fill-primary",
              )}
            />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              className="fill-foreground font-semibold"
            >
              {s.label}
            </text>
            {s.restriction && (
              <text
                x={lx}
                y={ly + 15}
                textAnchor={anchor}
                className="fill-muted-foreground"
              >
                {s.restriction.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
