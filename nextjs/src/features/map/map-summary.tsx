import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { type AirspaceFeature } from "~/api/aviation/schemas";
import { type FlightPoint } from "~/data/flight";
import {
  airspaceKind,
  nearestRouteSegment,
  routeCrossesPolygon,
} from "~/domain/map-navigation";
import { zoneRadioRows } from "~/domain/map-radio";
import { distanceNm } from "~/domain/geo";
import { useT } from "~/i18n/use-t";
import { usePlan } from "~/features/plan/use-plan";

/** Map route/radio/zone inventory shares the planner and API reference data. */
export function MapSummary({
  route,
  zones,
  crossed,
  plan,
}: {
  route: FlightPoint[];
  zones: AirspaceFeature[];
  crossed: AirspaceFeature[];
  plan: string;
}) {
  const t = useT();
  const { plan: routePlan } = usePlan();
  const endpoint = (index: number) =>
    routePlan?.points.find(
      (p) => p.lat === route[index]?.lat && p.lon === route[index]?.lon,
    )?.airportIcao ??
    route[index]?.ident ??
    "";
  const departure = endpoint(0),
    arrival = endpoint(route.length - 1);
  const dep = useQuery(
    api.frequencies.byAirport.queryOptions({ airport: departure }),
  );
  const arr = useQuery(
    api.frequencies.byAirport.queryOptions({ airport: arrival }),
  );
  const progress = (zone: AirspaceFeature) => {
    const ring = zone.geometry.coordinates[0];
    if (!ring?.length) return Infinity;
    const p = {
      lat: ring.reduce((v, p) => v + p[1], 0) / ring.length,
      lon: ring.reduce((v, p) => v + p[0], 0) / ring.length,
    };
    const leg = nearestRouteSegment(route, p);
    if (!leg) return Infinity;
    return (
      route
        .slice(0, leg.index)
        .reduce(
          (nm, point, index) => nm + distanceNm(point, route[index + 1]!),
          0,
        ) +
      distanceNm(route[leg.index]!, route[leg.index + 1]!) * leg.fraction
    );
  };
  const enroute = zones
    .filter(
      (z) =>
        /^(FIS|FIR)$/.test(
          airspaceKind(z.properties.name, z.properties.class),
        ) || /\bFIR\b/i.test(z.properties.name),
    )
    .filter((z) => routeCrossesPolygon(route, z.geometry.coordinates))
    .sort((a, b) => progress(a) - progress(b));
  const phases = [
    ["DEP ATIS", departure, dep.data?.filter((f) => f.service === "atis")],
    ["DEP DEL", departure, dep.data?.filter((f) => f.service === "delivery")],
    ["DEP GND", departure, dep.data?.filter((f) => f.service === "ground")],
    [
      "DEP TWR/RDO",
      departure,
      dep.data?.filter((f) => f.service === "tower" || f.service === "radio"),
    ],
    [
      "DEP APP",
      departure,
      dep.data?.filter(
        (f) => f.service === "zblizanie" || f.service === "radar",
      ),
    ],
    [
      "ENR FIR/FIS",
      "",
      enroute.flatMap((z) =>
        zoneRadioRows(z.properties).map((f) => ({
          ...f,
          sector: f.sector ?? z.properties.name,
        })),
      ),
    ],
    ["ARR ATIS", arrival, arr.data?.filter((f) => f.service === "atis")],
    [
      "ARR APP",
      arrival,
      arr.data?.filter(
        (f) => f.service === "zblizanie" || f.service === "radar",
      ),
    ],
    [
      "ARR TWR/RDO",
      arrival,
      arr.data?.filter((f) => f.service === "tower" || f.service === "radio"),
    ],
    ["ARR GND", arrival, arr.data?.filter((f) => f.service === "ground")],
  ] as const;
  return (
    <details>
      <summary>{t("maptools.summary")}</summary>
      <Tabs defaultValue="route" className="max-h-72 overflow-auto">
        <TabsList>
          <TabsTrigger value="route">{t("maptools.route")}</TabsTrigger>
          <TabsTrigger value="radio">{t("maptools.radio")}</TabsTrigger>
          <TabsTrigger value="zones">{t("map.layer.airspace")}</TabsTrigger>
        </TabsList>
        <TabsContent value="route">
          {route.map((p, i) => (
            <div key={i}>
              {i + 1}. {p.ident} · {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
            </div>
          ))}
          {routePlan?.warnings.map((w, i) => (
            <div key={i} className="text-destructive">
              {t("maptools.unresolved")}: {"token" in w ? w.token : w.code}
            </div>
          ))}
        </TabsContent>
        <TabsContent value="radio">
          {phases
            .filter((p) => p[2]?.length)
            .map(([title, airport, rows]) => (
              <section key={title}>
                <strong>
                  {title} {airport}
                </strong>
                {rows?.map((f, i) => (
                  <div key={i}>
                    {[f.callsign, f.sector].filter(Boolean).join(" / ")} ·{" "}
                    {f.frequencyMhz}
                  </div>
                ))}
              </section>
            ))}
          {!phases.some((p) => p[2]?.length) && t("maptools.noData")}
        </TabsContent>
        <TabsContent value="zones">
          {crossed.map((z, i) => (
            <div
              key={i}
              className={z.properties.active_now ? "text-destructive" : ""}
            >
              {airspaceKind(z.properties.name, z.properties.class)} ·{" "}
              {z.properties.name} · {z.properties.lower}–{z.properties.upper}
            </div>
          ))}
          <div>
            AUP:{" "}
            {plan === "none"
              ? t("maptools.none")
              : t(plan === "next" ? "map.planNext" : "map.planCurrent")}
          </div>
          {crossed
            .flatMap((z) => z.properties.activations)
            .map((a, i) => (
              <div key={i}>
                {a.starts_at} · {a.ends_at}
              </div>
            ))}
        </TabsContent>
      </Tabs>
    </details>
  );
}
