"use client";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { AirportField } from "~/features/plan/airport-field";
import { NumberField, fmt } from "~/features/plan/fields";
import { usePlan } from "~/features/plan/use-plan";
import { distanceNm } from "~/domain/geo";
import { formatHhMm } from "~/domain/fuel-planning";
import { useFlight } from "~/stores/flight";
import { useMapSettings } from "~/stores/map";
import { useT } from "~/i18n/use-t";

/** Preparation map edits the same draft as the flight form; it never starts navigation. */
export function PreparationPlanner() {
  const t = useT();
  const { flight, plan, route, eteMinutes, cruiseSpeedKt } = usePlan();
  const update = useFlight((s) => s.update);
  const request = useMapSettings((s) => s.request);
  const follow = useMapSettings((s) => s.follow);
  const plannedDistance =
    plan?.totalDistanceNm ??
    (route.length >= 2
      ? route
          .slice(1)
          .reduce(
            (total, point, index) => total + distanceNm(route[index]!, point),
            0,
          )
      : NaN);
  const plannedMinutes = plan
    ? eteMinutes
    : (plannedDistance / cruiseSpeedKt) * 60;
  return (
    <aside
      aria-label={t("mapplanner.title")}
      className="bg-card grid content-start gap-4 border-b p-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:border-r lg:border-b-0"
    >
      <h1 className="text-primary font-semibold">{t("mapplanner.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("mapplanner.hint")}</p>
      <AirportField
        label={t("plan.route.departure")}
        value={flight.departure}
        placeholder="ICAO"
        onSelect={(departure) => update({ departure, sid: null })}
      />
      <AirportField
        label={t("plan.route.arrival")}
        value={flight.destination}
        placeholder="ICAO"
        onSelect={(destination) =>
          update({ destination, star: null, approach: null })
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t("plan.route.altitude")}
          value={flight.cruiseAltitudeFt}
          onChange={(cruiseAltitudeFt) => update({ cruiseAltitudeFt })}
          min={0}
        />
        <NumberField
          label={t("plan.route.airspeed")}
          value={cruiseSpeedKt}
          onChange={(cruiseTasKt) =>
            update({ cruiseTasKt, cruiseSpeedEco: false })
          }
          min={30}
        />
      </div>
      <dl
        className="grid grid-cols-2 gap-1 text-sm"
        data-testid="map-planner-summary"
      >
        <dt>{t("plan.route.tile.totalDistance")}</dt>
        <dd>
          {Number.isFinite(plannedDistance) ? fmt(plannedDistance, 1) : "—"} NM
        </dd>
        <dt>ETE</dt>
        <dd>
          {Number.isFinite(plannedMinutes) ? formatHhMm(plannedMinutes) : "—"}
        </dd>
        <dt>{t("plan.route.airspeed")}</dt>
        <dd>{fmt(cruiseSpeedKt)} kt</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            follow(false);
            request("fit");
          }}
        >
          {t("maptools.fit")}
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">{t("nav.plan")}</Link>
        </Button>
      </div>
      <h2 className="font-medium">{t("mapplanner.points")}</h2>
      <ol className="grid gap-2 text-sm" data-testid="map-planner-points">
        {route.map((p, i) => (
          <li key={`${p.ident}|${i}`} className="rounded-md border p-2">
            {i + 1}. {p.ident}
          </li>
        ))}
        {(!flight.departure || !flight.destination) && (
          <li className="text-muted-foreground">{t("mapplanner.empty")}</li>
        )}
      </ol>
      {!!flight.waypoints.length && (
        <>
          <h2 className="font-medium">{t("mapplanner.added")}</h2>
          {flight.waypoints.map((point, index) => (
            <div
              key={`${point.ident}|${index}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>{point.ident}</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("mapplanner.remove", { point: point.ident })}
                onClick={() =>
                  update({
                    waypoints: flight.waypoints.filter((_, i) => i !== index),
                  })
                }
              >
                {t("maptools.removePoint")}
              </Button>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}
