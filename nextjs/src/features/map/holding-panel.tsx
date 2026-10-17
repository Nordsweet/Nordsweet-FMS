import { useEffect, useState } from "react";
import { holdingSchema, type Holding } from "~/data/holding";
import { type FlightPoint } from "~/data/flight";
import {
  holdingEntry,
  holdingFixIndex,
  holdingLegSeconds,
} from "~/domain/holding";
import { distanceNm, initialBearingDeg } from "~/domain/geo";
import {
  magneticVariationDeg,
  magneticToTrueDeg,
  trueToMagneticDeg,
} from "~/domain/magnetic";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { usePlan } from "~/features/plan/use-plan";
import { useGps } from "~/features/fly/use-gps";
import { formatRoutePoint, pointKey } from "~/domain/route-plan";
import { sameFlightPoint } from "~/domain/waypoint-insertion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useT } from "~/i18n/use-t";
import { MapSelect } from "./map-select";

export function HoldingPanel({
  point,
  now,
  preview,
  accept,
  remove,
  cancel,
}: {
  point: FlightPoint;
  now: number;
  preview: (holding: Holding | null) => void;
  accept: (holding: Holding) => void;
  remove: () => void;
  cancel: () => void;
}) {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const navigation = useInFlight();
  const { route: plannedRoute, plan, cruiseSpeedKt } = usePlan();
  const { fix, error } = useGps(navigation.startedAt !== null);
  const route = navigation.startedAt ? navigation.route : plannedRoute;
  const current =
    !error && fix && now - Date.parse(fix.time) <= 20000 ? fix : null;
  const existing = navigation.startedAt
    ? navigation.holding?.config
    : flight.holding;
  const saved =
    existing && sameFlightPoint(existing.fix, point) ? existing : null;
  const index = route.findIndex(
    (p, i) =>
      i > (navigation.startedAt ? navigation.activeLeg : -1) &&
      sameFlightPoint(p, point),
  );
  const profile = plan?.points.find(
    (p) => formatRoutePoint(p) === point.ident || p.id === point.ident,
  );
  const key = profile ? pointKey(profile) : point.ident;
  const plannedFt =
    plan?.pointAltitudeByKey[key] ??
    flight.waypointAltitudes[key] ??
    flight.cruiseAltitudeFt;
  const [level, setLevel] = useState(
    String(
      saved?.levelFt ??
        (navigation.startedAt && index === navigation.activeLeg + 1
          ? (current?.altitudeFt ?? plannedFt)
          : plannedFt),
    ),
  );
  const from = current ?? route[Math.max(0, index - 1)] ?? flight.departure;
  const approach =
    from && distanceNm(from, point) > 0.001
      ? initialBearingDeg(from, point)
      : (saved?.approachTrueDeg ?? 0);
  const [variation] = useState(() => magneticVariationDeg(point));
  const [course, setCourse] = useState(
    String(
      Math.round(
        trueToMagneticDeg(saved?.inboundTrueDeg ?? approach, variation),
      ) % 360,
    ),
  );
  const [direction, setDirection] = useState<Holding["direction"]>(
    saved?.direction ?? "right",
  );
  const [time, setTime] = useState(
    String((saved?.legSeconds ?? holdingLegSeconds(Number(level))) / 60),
  );
  const [manualTime, setManualTime] = useState(!!saved);
  const parsed = holdingSchema.safeParse({
    fix: { ident: point.ident, lat: point.lat, lon: point.lon },
    levelFt: level === "" ? NaN : Number(level),
    inboundTrueDeg:
      course === "" || Number(course) < 0 || Number(course) > 360
        ? NaN
        : magneticToTrueDeg(Number(course), variation),
    direction,
    legSeconds: time === "" ? NaN : Number(time) * 60,
    tasKt: saved?.tasKt ?? cruiseSpeedKt,
    approachTrueDeg: approach,
  });
  const json = parsed.success ? JSON.stringify(parsed.data) : null;
  const config = parsed.success ? parsed.data : null;
  const onRoute =
    config &&
    holdingFixIndex(
      route,
      config,
      navigation.startedAt ? navigation.activeLeg : -1,
    ) >= 0;
  useEffect(() => {
    preview(json ? holdingSchema.parse(JSON.parse(json)) : null);
    return () => preview(null);
  }, [json, preview]);
  return (
    <section
      className="grid gap-2 border-t pt-3"
      aria-label={t("holding.title")}
    >
      <strong>
        {t("holding.title")} — {point.ident}
      </strong>
      <Label htmlFor="holding-fix">{t("holding.fix")}</Label>
      <Input id="holding-fix" value={point.ident} readOnly />
      <Label htmlFor="holding-level">{t("holding.level")}</Label>
      <Input
        id="holding-level"
        type="number"
        min="0"
        max="60000"
        value={level}
        onChange={(e) => {
          setLevel(e.target.value);
          if (!manualTime)
            setTime(String(holdingLegSeconds(Number(e.target.value)) / 60));
        }}
      />
      <Label htmlFor="holding-course">{t("holding.inbound")}</Label>
      <Input
        id="holding-course"
        type="number"
        min="0"
        max="360"
        value={course}
        onChange={(e) => setCourse(e.target.value)}
      />
      <Label>{t("holding.direction")}</Label>
      <MapSelect
        label={t("holding.direction")}
        value={direction}
        onChange={setDirection}
        options={[
          { value: "right", label: t("holding.right") },
          { value: "left", label: t("holding.left") },
        ]}
      />
      <Label htmlFor="holding-time">{t("holding.time")}</Label>
      <Input
        id="holding-time"
        type="number"
        min="0.25"
        max="10"
        step="0.25"
        value={time}
        onChange={(e) => {
          setTime(e.target.value);
          setManualTime(true);
        }}
      />
      {config && (
        <p>
          {t("holding.entry", {
            entry: t(
              `holding.${holdingEntry(config.inboundTrueDeg, config.approachTrueDeg, config.direction)}`,
            ),
          })}
        </p>
      )}
      {!onRoute && <p>{t("holding.routeRequired")}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!config || route.length < 2}
          onClick={() => {
            if (config && route.length >= 2) accept(config);
          }}
        >
          {t("holding.accept")}
        </Button>
        <Button size="sm" variant="outline" onClick={cancel}>
          {t("holding.cancel")}
        </Button>
        {saved && (
          <Button size="sm" variant="outline" onClick={remove}>
            {t("holding.remove")}
          </Button>
        )}
      </div>
    </section>
  );
}
