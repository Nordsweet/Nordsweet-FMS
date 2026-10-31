import { type TurnPerformance } from "~/domain/fly-by";
import { type TrafficPattern } from "~/data/traffic-pattern";
import { AirportProcedurePanel } from "./airport-procedure-panel";
import { AirportFuel } from "./airport-fuel";
import { AirportLandingCard } from "./airport-landing-card";
import { HoldingPanel } from "./holding-panel";
import { type Holding } from "~/data/holding";
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
import {
  sameFlightPoint,
  waypointsAfterRouteRemoval,
} from "~/domain/waypoint-insertion";
import { routeEditKeys } from "~/domain/route-edit";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { useGps } from "~/features/fly/use-gps";
import { AirportBriefing, AirportNotams } from "~/features/plan/briefing";
import { WaypointWxDialog } from "~/features/plan/route-dialogs";
import { usePlan } from "~/features/plan/use-plan";
import { EmergencyAirportChoice } from "~/features/emergency/emergency-airport-choice";
import { useBrowserCharts } from "~/features/charts/use-browser-charts";

const KIND_LABEL: Record<string, MessageKey> = {
  airport: "maptools.kind.airport",
  airfield: "maptools.kind.airport",
  navaid: "maptools.kind.navaid",
  "ifr-waypoint": "maptools.kind.ifr",
  "vfr-reporting-point": "maptools.kind.vfr",
};

export function PointDetails({
  point,
  turnPerformance,
  addPoint,
  now,
  previewPattern,
  acceptPattern,
  removePattern,
  previewHolding,
  acceptHolding,
  removeHolding,
  openChart,
}: {
  point: FlightPoint & { name: string; kind: string; weather?: boolean };
  now: number;
  turnPerformance?: TurnPerformance;
  previewPattern: (pattern: TrafficPattern | null) => void;
  acceptPattern: (pattern: TrafficPattern) => void;
  removePattern: (operation: "leave" | "join") => void;
  previewHolding: (holding: Holding | null) => void;
  acceptHolding: (holding: Holding) => void;
  removeHolding: () => void;
  openChart: (airport: string, chartId: string) => void;
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
  const { plan, route, routeData } = usePlan();
  const displayedRoute = navigation.startedAt ? navigation.route : route;
  const waypointIndex = flight.waypoints.findIndex((p) =>
    sameFlightPoint(p, point),
  );
  const activeIndex = navigation.startedAt
    ? navigation.route.findIndex((p) => sameFlightPoint(p, point))
    : -1;
  const plannedIndex =
    !navigation.startedAt && plan
      ? plan.points.findIndex(
          (p, i) =>
            i > 0 &&
            i < plan.points.length - 1 &&
            !p.patternId &&
            !p.isProfilePoint &&
            sameFlightPoint({ ident: p.id, lat: p.lat, lon: p.lon }, point),
        )
      : -1;
  const routeIndex = !navigation.startedAt
    ? route.findIndex(
        (p, i) => i > 0 && i < route.length - 1 && sameFlightPoint(p, point),
      )
    : -1;
  const removable =
    waypointIndex >= 0 ||
    plannedIndex >= 0 ||
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
    | "restriction"
    | "weather"
    | "notams"
    | "charts"
    | "departure"
    | "arrival"
    | "hold"
    | null
  >(point.weather ? "weather" : null);
  const airportCode =
    routePoint?.airportIcao ??
    (["airport", "airfield"].includes(point.kind) ? point.ident : "");
  const airport = /^[A-Z]{4}$/.test(airportCode);
  const selectedAirport =
    point.kind === "airport" ||
    point.kind === "airfield" ||
    (point.kind === "route" && !!routeData?.airport(point.ident));
  const airportRecord = useQuery({
    ...api.airports.get.queryOptions({
      code: selectedAirport ? point.ident : "",
    }),
    enabled: selectedAirport,
  }).data;
  const navpoints = useQuery({
    ...api.navpoints.list.queryOptions(undefined),
    enabled: point.kind === "navaid" || point.kind === "route",
  });
  const navaid =
    point.kind === "navaid" || point.kind === "route"
      ? navpoints.data?.find(
          (p) => p.kind === "navaid" && sameFlightPoint(p, point),
        )?.navaid
      : null;
  const outbound = plan?.points.find(
    (p, i) => i > 0 && !p.patternId && !p.isProfilePoint,
  );
  const outboundRestriction = altitudeRestriction(outbound);
  const departureTargetAltitudeFt =
    outboundRestriction?.minFt ??
    outboundRestriction?.maxFt ??
    (outbound ? flight.waypointAltitudes[pointKey(outbound)] : null) ??
    flight.cruiseAltitudeFt;
  const { charts: allCharts } = useBrowserCharts(airport && mode === "charts");
  const charts = allCharts.filter((chart) => chart.airport === airportCode);
  return (
    <div
      className={
        airportRecord && navigation.startedAt
          ? "airport-details-columns"
          : undefined
      }
    >
      <div
        className="grid content-start gap-2"
        data-testid="airport-point-actions"
      >
        <WaypointWxDialog
          pointKey={wxOpen ? key : null}
          onClose={() => setWxOpen(false)}
        />
        <strong>{point.ident}</strong>
        {airportRecord && (
          <EmergencyAirportChoice airport={airportRecord} now={now} />
        )}
        {point.name !== point.ident && <span>{point.name}</span>}
        {navaid && (
          <div
            className="text-primary font-mono text-sm font-semibold"
            data-testid="navaid-details"
          >
            {navaid.type}
            {navaid.frequency &&
              `, ${navaid.frequency} ${/NDB/i.test(navaid.type) ? "kHz" : "MHz"}`}
            {` ${point.ident}`}
            {navaid.channel && ` · ${navaid.channel}`}
          </div>
        )}
        <span className="text-muted-foreground text-xs font-bold">
          {t(KIND_LABEL[point.kind] ?? "maptools.kind.point")} |{" "}
          {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-expanded={mode === "hold"}
            onClick={() => setMode(mode === "hold" ? null : "hold")}
          >
            {t("holding.title")}
          </Button>
          {navigation.startedAt && (
            <Button
              size="sm"
              variant="outline"
              disabled={!fix || !!error || now - Date.parse(fix.time) > 20000}
              onClick={() => {
                if (fix) navigation.goToPoint(point, fix, turnPerformance);
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
                if (fix) navigation.divertTo(point, fix, turnPerformance);
              }}
            >
              {t("fly.divert")}
            </Button>
          )}
          {!navigation.startedAt && point.kind === "airport" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addPoint(point, "departure")}
              >
                {t("maptools.setDeparture")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addPoint(point, "destination")}
              >
                {t("maptools.setDestination")}
              </Button>
            </>
          )}
          {selectedAirport && point.ident === flight.departure?.ident && (
            <Button
              size="sm"
              variant="outline"
              aria-expanded={mode === "departure"}
              onClick={() => setMode(mode === "departure" ? null : "departure")}
            >
              {t("departure.title")}
            </Button>
          )}
          {selectedAirport && (
            <Button
              size="sm"
              variant="outline"
              aria-expanded={mode === "arrival"}
              onClick={() => setMode(mode === "arrival" ? null : "arrival")}
            >
              {t("arrival.title")}
            </Button>
          )}
          {/* Legacy "Add To Route" turns into "Remove From Route" once the point is on it. */}
          {removable ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!navigation.startedAt && routeIndex >= 0) {
                  const removed =
                    plannedIndex >= 0 && waypointIndex < 0
                      ? routeEditKeys(plan!.points)[plannedIndex]
                      : undefined;
                  update({
                    waypoints: waypointsAfterRouteRemoval(
                      route,
                      flight.waypoints,
                      routeIndex,
                      waypointIndex,
                    ),
                    ...(removed
                      ? {
                          removedRoutePoints: [
                            ...flight.removedRoutePoints,
                            removed,
                          ],
                        }
                      : {}),
                  });
                } else if (waypointIndex >= 0)
                  update({
                    waypoints: flight.waypoints.filter(
                      (_, i) => i !== waypointIndex,
                    ),
                  });
                if (activeIndex >= 0)
                  navigation.removeWaypoint(activeIndex, error ? null : fix);
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
          {(airport || onRoute) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode(mode === "weather" ? null : "weather")}
            >
              {t("maptools.weather")}
            </Button>
          )}
          {airport &&
            (["notams", "charts"] as const).map((action) => (
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
        {airport && <AirportFuel icao={airportCode} />}
        {mode === "hold" && (
          <HoldingPanel
            point={point}
            now={now}
            preview={previewHolding}
            accept={acceptHolding}
            remove={removeHolding}
            cancel={() => setMode(null)}
          />
        )}
        {(mode === "departure" || mode === "arrival") && airportRecord && (
          <AirportProcedurePanel
            key={`${airportRecord.ident}:${flight.flightRules}:${mode}`}
            airport={airportRecord}
            operation={mode === "departure" ? "leave" : "join"}
            departureTargetAltitudeFt={departureTargetAltitudeFt}
            preview={previewPattern}
            accept={acceptPattern}
            cancel={() => setMode(null)}
            remove={() =>
              removePattern(mode === "departure" ? "leave" : "join")
            }
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
            point={{ ...point, ident: airport ? airportCode : point.ident }}
            role="selected"
            onInsertPirep={onRoute ? () => setWxOpen(true) : undefined}
            showAtis={airport}
          />
        )}
        {mode === "notams" && <AirportNotams icao={airportCode} />}
        {mode === "charts" &&
          (charts.length ? (
            charts.map((chart) => (
              <button
                type="button"
                key={chart.id}
                className="text-primary text-left underline"
                onClick={() => openChart(airportCode, chart.id)}
              >
                {chart.title}
              </button>
            ))
          ) : (
            <p>{t("maptools.noData")}</p>
          ))}
      </div>
      {airportRecord && navigation.startedAt && (
        <aside data-testid="airport-runway-side-panel">
          <AirportLandingCard
            key={airportRecord.ident}
            airport={airportRecord}
            fix={error ? null : fix}
            now={now}
            turns={turnPerformance}
          />
        </aside>
      )}
    </div>
  );
}
