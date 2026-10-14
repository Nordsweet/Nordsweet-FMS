import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type FlightPoint } from "~/data/flight";
import { formatRoutePoint, pointKey } from "~/domain/route-plan";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { useGps } from "~/features/fly/use-gps";
import { AirportBriefing } from "~/features/plan/briefing";
import { WaypointWxDialog } from "~/features/plan/route-dialogs";
import { usePlan } from "~/features/plan/use-plan";

export function PointDetails({
  point,
  addPoint,
  now,
}: {
  point: FlightPoint & { name: string; kind: string };
  now: number;
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
  const onRoute = route.some(
    (p) =>
      p.ident === point.ident && p.lat === point.lat && p.lon === point.lon,
  );
  const routePoint = plan?.points.find(
    (p) => formatRoutePoint(p) === point.ident || p.id === point.ident,
  );
  const key = routePoint
    ? pointKey(routePoint)
    : point.ident.trim().toUpperCase();
  const restriction = flight.pointRestrictions[key];
  const [wxOpen, setWxOpen] = useState(false);
  const [mode, setMode] = useState<
    "restriction" | "weather" | "notams" | "charts" | null
  >(null);
  const airportCode =
    routePoint?.airportIcao ?? (point.kind === "airport" ? point.ident : "");
  const airport = /^[A-Z]{4}$/.test(airportCode);
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
      <span>{point.name}</span>
      <span className="text-muted-foreground text-xs">
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
        <Button size="sm" onClick={() => addPoint(point, "waypoint")}>
          {t("plan.route.addWaypoint")}
        </Button>
        {flight.waypoints.some((p) => p.ident === point.ident) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                waypoints: flight.waypoints.filter(
                  (p) => p.ident !== point.ident,
                ),
              })
            }
          >
            {t("maptools.removePoint")}
          </Button>
        )}
        {onRoute && (
          <Button size="sm" variant="outline" onClick={() => setWxOpen(true)}>
            {t("plan.route.wx.title", { point: point.ident })}
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
      {mode === "restriction" && (
        <form
          key={key + JSON.stringify(restriction)}
          className="grid gap-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget),
              speed = data.get("speed") as string,
              altitude = data.get("altitude") as string,
              altitudeMode = data.get("mode") as string;
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
              altitudeMode:
                altitudeMode === "above"
                  ? ("above" as const)
                  : altitudeMode === "below"
                    ? ("below" as const)
                    : ("at" as const),
            };
            update({
              pointRestrictions: { ...flight.pointRestrictions, [key]: next },
            });
          }}
        >
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
          <Label>
            {t("maptools.restriction")}
            <Select
              name="mode"
              defaultValue={restriction?.altitudeMode ?? "at"}
            >
              <SelectTrigger aria-label={t("maptools.restriction")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["below", "at", "above"] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`maptools.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              {t("maptools.apply")}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
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
      {(mode === "weather" || mode === "notams") && (
        <AirportBriefing
          point={{ ...point, ident: airportCode }}
          role="selected"
        />
      )}
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
