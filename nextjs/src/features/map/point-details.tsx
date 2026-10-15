import { type TrafficPattern } from "~/data/traffic-pattern";
import { TrafficPatternPanel } from "./traffic-pattern-panel";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type FlightPoint } from "~/data/flight";
import {
  formatRoutePoint,
  pointKey,
  altitudeRestriction,
} from "~/domain/route-plan";
import { sameFlightPoint } from "~/domain/waypoint-insertion";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { useGps } from "~/features/fly/use-gps";
import { AirportBriefing, AirportNotams } from "~/features/plan/briefing";
import { WaypointWxDialog } from "~/features/plan/route-dialogs";
import { usePlan } from "~/features/plan/use-plan";

const KIND_LABEL: Record<string, MessageKey> = {
  airport: "maptools.kind.airport",
  airfield: "maptools.kind.airport",
  navaid: "maptools.kind.navaid",
  "ifr-waypoint": "maptools.kind.ifr",
  "vfr-reporting-point": "maptools.kind.vfr",
};

export function PointDetails({
  point,
  addPoint,
  now,
  previewPattern,
  acceptPattern,
  removePattern,
}: {
  point: FlightPoint & { name: string; kind: string };
  now: number;
  previewPattern: (pattern: TrafficPattern | null) => void;
  acceptPattern: (pattern: TrafficPattern) => void;
  removePattern: () => void;
  addPoint: (
    point: FlightPoint,
    as: "departure" | "destination" | "waypoint",
  ) => void;
}) {
  const t = useT(),
    flight = useFlight((s) => s.flight),
    update = useFlight((s) => s.update),
    navigation = useInFlight();
  const { fix, error } = useGps(navigation.startedAt !== null);
  const { plan, route } = usePlan();
  const displayedRoute = navigation.startedAt ? navigation.route : route;
  const waypointIndex = flight.waypoints.findIndex((p) =>
    sameFlightPoint(p, point),
  );
  const activeIndex = navigation.startedAt
    ? navigation.route.findIndex((p) => sameFlightPoint(p, point))
    : -1;
  const removable =
    waypointIndex >= 0 ||
    (activeIndex > 0 && activeIndex < navigation.route.length - 1);
  const onRoute = displayedRoute.some((p) => sameFlightPoint(p, point));
  const routePoint = plan?.points.find(
    (p) => formatRoutePoint(p) === point.ident || p.id === point.ident,
  );
  const key = routePoint
    ? pointKey(routePoint)
    : point.ident.trim().toUpperCase();
  const restriction = flight.pointRestrictions[key];
  const [wxOpen, setWxOpen] = useState(false);
  const [altitudeMode, setAltitudeMode] = useState(
    restriction?.altitudeMode ?? "at",
  );
  const [mode, setMode] = useState<
    "restriction" | "weather" | "notams" | "charts" | "pattern" | null
  >(null);
  const airportCode =
    routePoint?.airportIcao ?? (point.kind === "airport" ? point.ident : "");
  const airport = /^[A-Z]{4}$/.test(airportCode);
  const airportRecord = useQuery({
    ...api.airports.get.queryOptions({
      code: point.kind === "airport" ? point.ident : "",
    }),
    enabled: point.kind === "airport",
  }).data;
  const outbound = plan?.points.find(
    (p, i) => i > 0 && !p.patternId && !p.isProfilePoint,
  );
  const outboundRestriction = altitudeRestriction(outbound);
  const departureTargetAltitudeFt =
    outboundRestriction?.minFt ??
    outboundRestriction?.maxFt ??
    (outbound ? flight.waypointAltitudes[pointKey(outbound)] : null) ??
    flight.cruiseAltitudeFt;
  const charts = useQuery({
    ...api.charts.byAirport.queryOptions({ airport: airportCode }),
    enabled: airport && mode === "charts",
  });
  return (
    <div className="grid gap-2">
      <WaypointWxDialog
        pointKey={wxOpen ? key : null}
        onClose={() => setWxOpen(false)}
      />
      <strong>{point.ident}</strong>
      {point.name !== point.ident && <span>{point.name}</span>}
      <span className="text-muted-foreground text-xs font-bold">
        {t(KIND_LABEL[point.kind] ?? "maptools.kind.point")} |{" "}
        {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
      </span>
      <div className="flex flex-wrap gap-2">
        {navigation.startedAt && (
          <Button
            size="sm"
            variant="outline"
            disabled={!fix || !!error || now - Date.parse(fix.time) > 20000}
            onClick={() => {
              if (fix) navigation.goToPoint(point, fix);
            }}
          >
            {t("fly.directTo")}
          </Button>
        )}
        {navigation.startedAt && point.kind === "airport" && (
          <Button
            size="sm"
            variant="outline"
            disabled={!fix || !!error || now - Date.parse(fix.time) > 20000}
            onClick={() => {
              if (fix) navigation.divertTo(point, fix);
            }}
          >
            {t("fly.divert")}
          </Button>
        )}
        {point.kind === "airport" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addPoint(point, "departure")}
            >
              {t("plan.route.departure")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addPoint(point, "destination")}
            >
              {t("plan.route.destination")}
            </Button>
          </>
        )}
        {point.kind === "airport" && (
          <Button
            size="sm"
            variant="outline"
            aria-expanded={mode === "pattern"}
            onClick={() => setMode(mode === "pattern" ? null : "pattern")}
          >
            {t("pattern.title")}
          </Button>
        )}
        {/* Legacy "Add To Route" turns into "Remove From Route" once the point is on it. */}
        {removable ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (waypointIndex >= 0)
                update({
                  waypoints: flight.waypoints.filter(
                    (_, i) => i !== waypointIndex,
                  ),
                });
              if (activeIndex >= 0) navigation.removeWaypoint(activeIndex);
            }}
          >
            {t("maptools.removePoint")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => addPoint(point, "waypoint")}>
            {t("plan.route.addWaypoint")}
          </Button>
        )}
        {onRoute && (
          <Button size="sm" variant="outline" onClick={() => setWxOpen(true)}>
            WX
          </Button>
        )}
        {onRoute && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setMode(mode === "restriction" ? null : "restriction")
            }
          >
            {t("maptools.restriction")}
          </Button>
        )}
        {airport &&
          (["weather", "notams", "charts"] as const).map((action) => (
            <Button
              size="sm"
              variant="outline"
              key={action}
              onClick={() => setMode(mode === action ? null : action)}
            >
              {t(`maptools.${action}`)}
            </Button>
          ))}
      </div>
      {mode === "pattern" && airportRecord && (
        <TrafficPatternPanel
          airport={airportRecord}
          departureTargetAltitudeFt={departureTargetAltitudeFt}
          preview={previewPattern}
          accept={acceptPattern}
          cancel={() => setMode(null)}
          remove={removePattern}
        />
      )}
      {mode === "restriction" && (
        <form
          key={key + JSON.stringify(restriction)}
          className="grid gap-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget),
              speed = data.get("speed") as string,
              altitude = data.get("altitude") as string;
            const next = {
              speedKt:
                speed && Number.isFinite(Number(speed)) && Number(speed) > 0
                  ? Math.max(1, Math.round(Number(speed)))
                  : null,
              altitudeFt:
                altitude &&
                Number.isFinite(Number(altitude)) &&
                Number(altitude) >= 0
                  ? Math.round(Number(altitude))
                  : null,
              altitudeMode,
            };
            update({
              pointRestrictions: { ...flight.pointRestrictions, [key]: next },
            });
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Label>
              {t("maptools.speed")}
              <Input
                type="number"
                name="speed"
                min={1}
                defaultValue={restriction?.speedKt ?? ""}
              />
            </Label>
            <Label>
              {t("maptools.altitude")}
              <Input
                type="number"
                name="altitude"
                min={0}
                step={100}
                defaultValue={restriction?.altitudeFt ?? ""}
              />
            </Label>
          </div>
          <div
            role="group"
            aria-label={t("maptools.altitudeRestriction")}
            className="grid gap-1"
          >
            <span className="text-muted-foreground text-[10px] font-bold uppercase">
              {t("maptools.altitudeRestriction")}
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(["below", "at", "above"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  type="button"
                  variant="outline"
                  aria-pressed={altitudeMode === value}
                  onClick={() => setAltitudeMode(value)}
                >
                  {t(`maptools.${value}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              {t("maptools.apply")}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setAltitudeMode("at");
                const entries = { ...flight.pointRestrictions };
                delete entries[key];
                update({ pointRestrictions: entries });
              }}
            >
              {t("maptools.clear")}
            </Button>
          </div>
        </form>
      )}
      {mode === "weather" && (
        <AirportBriefing
          point={{ ...point, ident: airportCode }}
          role="selected"
        />
      )}
      {mode === "notams" && <AirportNotams icao={airportCode} />}
      {mode === "charts" &&
        (charts.data?.length ? (
          charts.data.map((chart) => (
            <a
              key={chart.src}
              href={chart.src}
              target="_blank"
              rel="noreferrer"
            >
              {chart.title}
            </a>
          ))
        ) : (
          <p>{t("maptools.noData")}</p>
        ))}
    </div>
  );
}
