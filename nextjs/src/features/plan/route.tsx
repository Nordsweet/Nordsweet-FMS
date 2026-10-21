"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, Ellipsis, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type Flight, type FlightPoint } from "~/data/flight";
import { nordRouteFields, parseNordFile } from "~/data/nord";
import { type Procedure } from "~/data/schemas";
import { aircraftLabel } from "~/domain/aircraft";
import { formatHhMm } from "~/domain/fuel-planning";
import {
  type ProcedureType,
  type RouteLeg,
  type RoutePlan,
  altitudeRestriction,
  formatRoutePoint,
  formatRouteWind,
  isRestrictionConflict,
  isStarEntryPoint,
  normalizeProcedureId,
  pointKey,
  procedureLabel,
  procedureRunwayLabel,
  speedRestrictionKt,
  waypointWindProfile,
} from "~/domain/route-plan";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";
import { useMapSettings } from "~/stores/map";
import { clearedRoute, routeEditKeys } from "~/domain/route-edit";
import { sameFlightPoint } from "~/domain/waypoint-insertion";

import { NumberField, Section, num } from "./fields";
import { AirportField } from "./airport-field";
import {
  EconomyDialog,
  VerticalProfileDialog,
  WaypointWxDialog,
} from "./route-dialogs";
import { usePlan } from "./use-plan";

const tile =
  "grid gap-1 rounded-[14px] border border-[rgba(141,190,255,0.16)] bg-[rgba(16,30,52,0.6)] px-3.5 py-2.5";
const tileLabel =
  "text-muted-foreground text-[0.7rem] font-semibold tracking-[0.08em] uppercase";

export function RouteSection() {
  const t = useT();
  const update = useFlight((s) => s.update);
  const {
    flight,
    aircraft,
    plan,
    procedureOptions,
    cruiseSpeedKt,
    eteMinutes,
    schedule,
  } = usePlan();
  const [wxKey, setWxKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"economy" | "profile" | null>(null);
  const [loadStatus, setLoadStatus] = useState<string | null>(null);
  const ete = Number.isFinite(eteMinutes) ? formatHhMm(eteMinutes) : "n/a";

  return (
    <Section>
      <p
        className="text-muted-foreground text-xs font-bold tracking-[0.08em] uppercase"
        data-testid="route-summary"
      >
        {plan
          ? `${plan.departure.ident} -> ${plan.destination.ident} · ${num(plan.totalDistanceNm)} NM · ETE ${ete}`
          : t("plan.route.status.select")}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>{t("arrival.rules")}</Label>
          <Select
            value={flight.flightRules}
            onValueChange={(flightRules) => {
              if (["V", "I", "Y", "Z"].includes(flightRules))
                update({ flightRules: flightRules as Flight["flightRules"] });
            }}
          >
            <SelectTrigger className="w-full" aria-label={t("arrival.rules")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="V">V - VFR</SelectItem>
              <SelectItem value="I">I - IFR</SelectItem>
              <SelectItem value="Y">{t("arrival.Y")}</SelectItem>
              <SelectItem value="Z">{t("arrival.Z")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AirportField
          label={t("plan.route.departure")}
          value={flight.departure}
          placeholder="ICAO"
          onSelect={(departure) => update({ departure })}
        >
          <ScheduleButton kind="departure" value={schedule.departure} />
        </AirportField>
        <AirportField
          label={t("plan.route.arrival")}
          value={flight.destination}
          placeholder="ICAO"
          onSelect={(destination) => update({ destination })}
        >
          <ScheduleButton kind="destination" value={schedule.destination} />
        </AirportField>
        <AirportField
          label={t("plan.route.alternateAirport")}
          value={flight.alternate}
          placeholder={t("plan.point.noneIcao")}
          onSelect={(alternate) => update({ alternate })}
        />
        <NumberField
          label={t("plan.route.altitude")}
          min={0}
          step={500}
          value={flight.cruiseAltitudeFt}
          onChange={(cruiseAltitudeFt) => update({ cruiseAltitudeFt })}
        />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <NumberField
              label={t("plan.route.airspeed")}
              min={30}
              value={cruiseSpeedKt}
              onChange={(cruiseTasKt) =>
                update({ cruiseTasKt, cruiseSpeedEco: false })
              }
            />
          </div>
          <label
            className="flex h-12.5 items-center gap-2 rounded-xl border px-3 text-xs font-bold"
            title={t("plan.route.ecoTitle")}
          >
            <input
              type="checkbox"
              checked={flight.cruiseSpeedEco}
              onChange={(e) => update({ cruiseSpeedEco: e.target.checked })}
            />
            {t("plan.route.eco")}
          </label>
        </div>
        {(["SID", "STAR", "APPROACH"] as const).map((type) => (
          <ProcedureSelect
            key={type}
            type={type}
            {...procedureOptions(type)}
            value={flight[selectionField[type]]}
            onChange={(value) => update({ [selectionField[type]]: value })}
          />
        ))}
      </div>
      <RouteText expanded={plan?.points.map(formatRoutePoint).join(" → ")} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            update({
              departure: flight.destination,
              destination: flight.departure,
              // Legacy re-renders the selects: other airports' procedures fall back to none.
              sid: flight.sid === "AUTO" ? "AUTO" : null,
              star: flight.star === "AUTO" ? "AUTO" : null,
              approach: flight.approach === "AUTO" ? "AUTO" : null,
            })
          }
        >
          {t("plan.route.invert")}
        </Button>
        <Button variant="outline" onClick={() => setDialog("economy")}>
          {t("plan.route.economy")}
        </Button>
        <Button variant="outline" onClick={() => setDialog("profile")}>
          {t("plan.route.verticalProfile")}
        </Button>
        <LoadRouteButton onStatus={setLoadStatus} />
        <Button variant="outline" onClick={() => update(clearedRoute)}>
          {t("plan.route.clear")}
        </Button>
      </div>
      <RouteStatus plan={plan} loadStatus={loadStatus} />
      {plan && (
        <>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            data-testid="route-tiles"
          >
            {[
              [
                t("plan.route.tile.aircraft"),
                aircraft ? aircraftLabel(aircraft) : "--",
              ],
              [t("plan.route.tile.from"), plan.departure.ident],
              [t("plan.route.tile.to"), plan.destination.ident],
              [
                t("plan.route.tile.alternate"),
                plan.alternate?.ident ?? t("plan.route.none"),
              ],
              ...(["SID", "STAR", "APPROACH"] as const).map((type) => {
                const used = plan.usedProcedures.find((p) => p.type === type);
                return [
                  type === "APPROACH" ? t("plan.route.approach") : type,
                  used ? procedureLabel(used) : t("plan.route.none"),
                ];
              }),
              [
                t("plan.route.tile.cruiseAltitude"),
                `${Math.round(plan.altitudeFt)} ft`,
              ],
              [
                t("plan.route.tile.cruiseSpeed"),
                cruiseSpeedKt > 0 ? `${Math.round(cruiseSpeedKt)} kt` : "n/a",
              ],
              [
                t("plan.route.tile.routeWind"),
                plan.routeWindAvailable
                  ? formatRouteWind(plan.routeWindComponentKt)
                  : t("plan.route.cruiseTile"),
              ],
              [t("plan.route.tile.ete"), ete],
              [
                t("plan.route.tile.totalDistance"),
                `${num(plan.totalDistanceNm)} NM`,
              ],
            ].map(([label, value]) => (
              <div key={label} className={tile}>
                <span className={tileLabel}>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className={tile} data-testid="route-strip">
            <p>
              <strong className="text-primary">
                {t("plan.route.expanded")}
              </strong>{" "}
              {plan.points.map(formatRoutePoint).join(" → ")}
            </p>
            <p className="text-muted-foreground text-xs">
              {plan.routeWindAvailable
                ? t("plan.route.windAverage", {
                    wind: formatRouteWind(plan.routeWindComponentKt),
                  })
                : t("plan.route.windTile")}
            </p>
          </div>
          <ol className="grid gap-2" aria-label={t("plan.route.legs")}>
            {plan.legs.map((leg, i) => (
              <LegCard
                key={`${i}-${pointKey(leg.to)}`}
                leg={leg}
                plan={plan}
                onWx={setWxKey}
              />
            ))}
          </ol>
        </>
      )}
      {/* Mounted only while open: each one derives the plan again. */}
      {wxKey && (
        <WaypointWxDialog pointKey={wxKey} onClose={() => setWxKey(null)} />
      )}
      {dialog === "economy" && (
        <EconomyDialog open onClose={() => setDialog(null)} />
      )}
      {dialog === "profile" && (
        <VerticalProfileDialog open onClose={() => setDialog(null)} />
      )}
    </Section>
  );
}

const selectionField = {
  SID: "sid",
  STAR: "star",
  APPROACH: "approach",
} as const satisfies Record<ProcedureType, keyof Flight>;

function RouteText({ expanded }: { expanded?: string }) {
  const t = useT();
  const id = useId();
  const routeText = useFlight((s) => s.flight.routeText);
  const update = useFlight((s) => s.update);
  const [editing, setEditing] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t("plan.route.text")}</Label>
      <textarea
        id={id}
        rows={3}
        spellCheck={false}
        placeholder={t("plan.route.placeholder")}
        className="border-input bg-input/40 focus-visible:ring-ring/50 min-h-24 rounded-xl border px-3 py-2 text-base outline-none focus-visible:ring-3"
        value={editing ? routeText : (expanded ?? routeText)}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) =>
          update({ routeText: e.target.value, removedRoutePoints: [] })
        }
      />
      <p className="text-muted-foreground text-xs">
        {t("plan.route.textHint")}
      </p>
    </div>
  );
}

const NONE = "NONE";
const AUTO = "AUTO";

export function ProcedureSelect({
  type,
  procedures,
  suggested,
  requested,
  value,
  onChange,
}: {
  type: ProcedureType;
  procedures: Procedure[];
  suggested: Procedure | null;
  requested: Procedure | null;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const t = useT();
  const label = type === "APPROACH" ? t("plan.route.approach") : type;
  // A procedure named in the route text shows in its select, as in legacy.
  const stored = value === AUTO ? AUTO : normalizeProcedureId(value);
  const known = procedures.find(
    (p) =>
      normalizeProcedureId(p.id) === stored ||
      normalizeProcedureId(p.designator) === stored,
  );
  const current = requested
    ? normalizeProcedureId(requested.id)
    : stored === AUTO
      ? AUTO
      : known
        ? normalizeProcedureId(known.id)
        : NONE;
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select
        value={current}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            {t("plan.route.noneOf", { type: label.toUpperCase() })}
          </SelectItem>
          <SelectItem value={AUTO}>
            {suggested
              ? t("plan.route.auto", {
                  procedure: `${procedureLabel(suggested)} / ${procedureRunwayLabel(suggested)}`,
                })
              : t("plan.route.autoNoData")}
          </SelectItem>
          {procedures.map((p) => (
            <SelectItem key={p.id} value={normalizeProcedureId(p.id)}>
              {procedureLabel(p)} - {procedureRunwayLabel(p)} -{" "}
              {t("plan.route.legCount", { count: p.legs.length })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ScheduleButton({
  kind,
  value,
}: {
  kind: "departure" | "destination";
  value: string;
}) {
  const t = useT();
  const id = useId();
  const flightSchedule = useFlight((s) => s.flight.schedule);
  const update = useFlight((s) => s.update);
  const isDeparture = kind === "departure";
  const date = value ? new Date(value) : null;
  const title =
    date && Number.isFinite(date.getTime())
      ? t(
          isDeparture
            ? "plan.route.schedule.departureAt"
            : "plan.route.schedule.landingAt",
          {
            time: date.toLocaleString([], {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        )
      : t(
          isDeparture
            ? "plan.route.schedule.setDeparture"
            : "plan.route.schedule.setLanding",
        );
  const set = (next: string) =>
    update({ schedule: { ...flightSchedule, [kind]: next } });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "size-12.5 shrink-0",
            value && "border-primary text-primary",
          )}
          aria-label={title}
          title={title}
        >
          <Clock />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Label htmlFor={id}>
          {t(
            isDeparture
              ? "plan.route.schedule.departure"
              : "plan.route.schedule.landing",
          )}
        </Label>
        <Input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(e) => set(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          className="justify-self-end"
          onClick={() => set("")}
        >
          {t("plan.route.schedule.clear")}
        </Button>
        <p className="text-muted-foreground text-xs">
          {t(
            isDeparture
              ? "plan.route.schedule.hintDeparture"
              : "plan.route.schedule.hintLanding",
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function LoadRouteButton({ onStatus }: { onStatus: (status: string) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const update = useFlight((s) => s.update);
  const aircraftList = useQuery(api.aircraft.list.queryOptions(undefined));
  const airports = useQuery(api.airports.list.queryOptions(undefined));
  const airportPoint = (code: string | null): FlightPoint | null => {
    const a = code
      ? airports.data?.find((x) => x.ident === code.trim().toUpperCase())
      : null;
    return a ? { ident: a.ident, lat: a.lat, lon: a.lon } : null;
  };
  return (
    <>
      <Button variant="outline" onClick={() => input.current?.click()}>
        {t("plan.route.loadRoute")}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".nord,application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const { flight, alternateCode } = parseNordFile(
              await file.text(),
              (aircraftList.data ?? []).map((a) => a.id),
            );
            // Route only: aircraft, loading and fuel stay as they are.
            update({
              ...nordRouteFields(flight),
              alternate: airportPoint(alternateCode),
            });
            onStatus(
              t("plan.route.loaded", { name: flight.name || file.name }),
            );
          } catch {
            onStatus(t("plan.route.loadFailed"));
          }
        }}
      />
    </>
  );
}

function RouteStatus({
  plan,
  loadStatus,
}: {
  plan: RoutePlan | null;
  loadStatus: string | null;
}) {
  const t = useT();
  const navpoints = useQuery(api.navpoints.list.queryOptions(undefined));
  const airways = useQuery(api.airways.list.queryOptions(undefined));
  const procedures = useQuery(api.procedures.all.queryOptions(undefined));
  const data = t("plan.route.status.data", {
    points: navpoints.data?.length ?? 0,
    airways: Object.keys(airways.data ?? {}).length,
    procedures: procedures.data?.length ?? 0,
  });
  let text: string;
  let warn = true;
  if (!plan) text = t("plan.route.status.select");
  else {
    const parts = [
      plan.usedProcedures.length
        ? t("plan.route.status.procedures", {
            list: plan.usedProcedures.map(procedureLabel).join(" / "),
          })
        : "",
      plan.usedAirways.length
        ? t("plan.route.status.airways", { list: plan.usedAirways.join(" / ") })
        : "",
    ].filter(Boolean);
    const logic = parts.length ? parts.join(". ") : t("plan.route.status.dct");
    warn = plan.warnings.length > 0;
    const warnings = plan.warnings.map((w) =>
      w.code === "threshold-missing"
        ? t(`plan.route.warning.threshold-missing.${w.role}`, w)
        : t(
            `plan.route.warning.${w.code}` as MessageKey,
            w as Record<string, string>,
          ),
    );
    text = warn
      ? `${logic}. ${warnings.join(" ")} ${data}`
      : `${logic}. ${t("plan.route.status.expanded")} ${data}`;
  }
  return (
    <div className="grid gap-1">
      <p
        data-testid="route-status"
        className={cn(
          "rounded-2xl border px-3.5 py-3 text-sm",
          warn ? "border-warn/40 text-warn" : "border-ok/40 text-ok",
        )}
      >
        {text}
      </p>
      {loadStatus && (
        <p className="text-muted-foreground text-sm">{loadStatus}</p>
      )}
    </div>
  );
}

function LegCard({
  leg,
  plan,
  onWx,
}: {
  leg: RouteLeg;
  plan: RoutePlan;
  onWx: (key: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const update = useFlight((s) => s.update);
  const flight = useFlight((s) => s.flight);
  const point = leg.to;
  const key = pointKey(point);
  const override = flight.waypointAltitudes[key];
  const suggested = plan.verticalProfile.suggestedAltitudesByKey[key];
  const restriction = altitudeRestriction(point);
  const speed = speedRestrictionKt(point);
  const conflict = isRestrictionConflict(
    plan.pointAltitudeByKey[key],
    restriction,
  );
  const restrictionText =
    [restriction?.label, speed !== null ? `${speed} kt` : ""]
      .filter(Boolean)
      .join(" / ") || "--";
  const choice =
    leg.from.procedureChoice?.type === "STAR"
      ? leg.from.procedureChoice
      : point.procedureChoice && point.procedureChoice.type !== "STAR"
        ? point.procedureChoice
        : null;
  const hasWx = waypointWindProfile(flight.waypointWx[key]).length > 0;
  return (
    <li className="grid grid-cols-2 items-center gap-3 rounded-[14px] border border-[rgba(141,190,255,0.16)] bg-[rgba(16,30,52,0.6)] px-3.5 py-2.5 sm:grid-cols-[2fr_1fr_1fr_1fr]">
      <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
        <div className="grid">
          <span className={tileLabel}>
            {String(leg.bearingDeg).padStart(3, "0")} deg /{" "}
            {num(leg.distanceNm)} NM
          </span>
          <strong>{formatRoutePoint(point)}</strong>
        </div>
        {!point.isProfilePoint && key && (
          <Button
            variant="outline"
            size="sm"
            className={cn(hasWx && "border-primary text-primary")}
            title={
              hasWx
                ? t("plan.route.leg.wxEntered")
                : t("plan.route.wx.title", { point: key })
            }
            onClick={() => onWx(key)}
          >
            WX
          </Button>
        )}
        {!point.isProfilePoint && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={t("fly.fpl.remove", {
                point: formatRoutePoint(point),
              })}
              className="flex size-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/15 focus-visible:ring-2"
              onClick={() => {
                const index = plan.points.indexOf(point);
                const insertedIndex = flight.waypoints.findIndex((p) =>
                  sameFlightPoint(p, { ...point, ident: point.id }),
                );
                if (index === plan.points.length - 1)
                  update({ destination: null });
                else
                  update({
                    waypoints: flight.waypoints.filter(
                      (_, i) => i !== insertedIndex,
                    ),
                    removedRoutePoints: [
                      ...flight.removedRoutePoints,
                      routeEditKeys(plan.points)[index]!,
                    ],
                  });
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t("fly.fpl.options", {
                point: formatRoutePoint(point),
              })}
              className="flex size-9 items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:ring-2"
              onClick={() => {
                const ident = point.airportIcao ?? point.id;
                useMapSettings.getState().inspectPoint({
                  ident,
                  lat: point.lat,
                  lon: point.lon,
                  name: formatRoutePoint(point),
                  kind:
                    point.kind === "airport" || point.kind === "threshold"
                      ? "airport"
                      : "point",
                });
                router.push("/map");
              }}
            >
              <Ellipsis className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-1">
        <span className={tileLabel}>{t("plan.route.leg.altitude")}</span>
        <Input
          type="number"
          min={0}
          step={100}
          inputMode="numeric"
          aria-label={t("plan.route.leg.altitudeAt", {
            point: formatRoutePoint(point),
          })}
          className="h-9 rounded-xl"
          placeholder={String(
            Math.round(
              Number.isFinite(suggested) ? suggested! : plan.altitudeFt,
            ),
          )}
          defaultValue={override ?? ""}
          key={`${key}|${override}`}
          onBlur={(e) => {
            const text = e.target.value.trim();
            const n = Number(text);
            const next = { ...flight.waypointAltitudes };
            if (text !== "" && Number.isFinite(n))
              next[key] = Math.max(0, Math.round(n));
            else delete next[key];
            update({ waypointAltitudes: next });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </div>
      <div className={cn("grid gap-1", conflict && "text-destructive")}>
        <span className={tileLabel}>{t("plan.route.leg.restriction")}</span>
        <strong>{restrictionText}</strong>
      </div>
      <div className="grid gap-1">
        <span className={tileLabel}>{t("plan.route.leg.type")}</span>
        {choice?.procedures.length ? (
          <Select
            value={choice.selectedId || "-"}
            onValueChange={(v) => {
              const next = { ...flight.inlineProcedureSelections };
              if (v === "-") delete next[choice.key];
              else next[choice.key] = v;
              update({ inlineProcedureSelections: next });
            }}
          >
            <SelectTrigger
              className="h-9 w-full"
              aria-label={t("plan.route.leg.type")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-">
                {t("plan.route.leg.selectVariant", {
                  type: choice.type,
                  fix: choice.baseFix,
                })}
              </SelectItem>
              {choice.procedures.map((p) => (
                <SelectItem key={p.id} value={normalizeProcedureId(p.id)}>
                  {procedureLabel(p)} - {procedureRunwayLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <strong>
            {point.procedure && !isStarEntryPoint(point)
              ? procedureLabel(point.procedure)
              : plan.usedAirways.length
                ? t("plan.route.leg.mixed")
                : "DCT"}
          </strong>
        )}
      </div>
    </li>
  );
}
