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

/** Legacy serviceShortLabel for each frequency service. */
const SERVICE_TAG: Record<string, string> = {
  atis: "ATIS",
  delivery: "DEL",
  ground: "GND",
  tower: "TWR",
  radio: "RDO",
  zblizanie: "APP",
  radar: "RAD",
  informacja: "INFO",
  fiss: "FIS",
};

type Row = {
  frequencyMhz: string;
  callsign: string;
  sector: string | null;
  service?: string;
  serviceId?: string;
  zone?: string;
};

/** Legacy phaseServiceTitle: TWR/RDO and FIR/FIS titles name only the services present. */
function phaseTitle(title: string, rows: Row[]) {
  const tags = new Set(rows.map((r) => r.zone ?? tag(r)));
  if (title.endsWith("TWR/RDO")) {
    const prefix = title.slice(0, 3);
    if (tags.has("TWR") && tags.has("RDO")) return title;
    if (tags.has("TWR")) return `${prefix} TWR`;
    if (tags.has("RDO")) return `${prefix} RDO`;
  }
  if (title === "ENR FIR/FIS") {
    if (tags.has("FIR") && tags.has("FIS")) return title;
    if (tags.has("FIR")) return "ENR FIR";
    if (tags.has("FIS")) return "ENR FIS";
  }
  return title;
}
const tag = (r: Row) =>
  SERVICE_TAG[r.service ?? r.serviceId ?? ""] ?? r.zone ?? "";

/** Legacy map sidebar: zone/route/crossed counts and the Route / Radio / Zones tabs. */
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
  const at = (data: Row[] | undefined, services: string[]) =>
    data?.filter((f) => f.service && services.includes(f.service)) ?? [];
  const phases: [string, string, Row[]][] = [
    ["DEP ATIS", departure, at(dep.data, ["atis"])],
    ["DEP DEL", departure, at(dep.data, ["delivery"])],
    ["DEP GND", departure, at(dep.data, ["ground"])],
    ["DEP TWR/RDO", departure, at(dep.data, ["tower", "radio"])],
    ["DEP APP", departure, at(dep.data, ["zblizanie", "radar"])],
    [
      "ENR FIR/FIS",
      t("maptools.route").toUpperCase(),
      enroute.flatMap((z) =>
        zoneRadioRows(z.properties).map((f) => ({
          ...f,
          sector: f.sector ?? z.properties.name,
          zone: /\bFIR\b/i.test(z.properties.name)
            ? "FIR"
            : airspaceKind(z.properties.name, z.properties.class),
        })),
      ),
    ],
    ["ARR ATIS", arrival, at(arr.data, ["atis"])],
    ["ARR APP", arrival, at(arr.data, ["zblizanie", "radar"])],
    ["ARR TWR/RDO", arrival, at(arr.data, ["tower", "radio"])],
    ["ARR GND", arrival, at(arr.data, ["ground"])],
  ];
  const radio = phases.filter((p) => p[2].length);
  const empty = (text: string) => (
    <div className="legacy-card">
      <div className="legacy-muted">{text}</div>
    </div>
  );
  return (
    <div className="legacy-map-side">
      <div className="legacy-metrics">
        {(
          [
            [zones.length, "maptools.metric.zones"],
            [route.length, "maptools.metric.points"],
            [crossed.length, "maptools.metric.crossed"],
          ] as const
        ).map(([value, key]) => (
          <div key={key} className="legacy-metric">
            <strong>{value}</strong>
            <span>{t(key)}</span>
          </div>
        ))}
      </div>
      <Tabs defaultValue="route">
        <TabsList>
          <TabsTrigger value="route">{t("maptools.route")}</TabsTrigger>
          <TabsTrigger value="radio">{t("maptools.radio")}</TabsTrigger>
          <TabsTrigger value="zones">{t("map.layer.airspace")}</TabsTrigger>
        </TabsList>
        <TabsContent value="route">
          <div className="legacy-card">
            <div className="legacy-card-title">
              {t("mapplanner.points")}
              <span className="legacy-tag">{route.length}</span>
            </div>
            {route.length ? (
              route.map((p, i) => (
                <div key={i} className="legacy-line">
                  <span className="legacy-tag">{i + 1}</span>
                  <span>{p.ident}</span>
                  <span className="legacy-muted">
                    {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                  </span>
                </div>
              ))
            ) : (
              <div className="legacy-muted">{t("maptools.noRoute")}</div>
            )}
          </div>
          {!!routePlan?.warnings.length && (
            <div className="legacy-card">
              <div className="legacy-card-title">
                {t("maptools.unresolved")}
              </div>
              <div className="legacy-muted">
                {routePlan.warnings
                  .map((w) => ("token" in w ? w.token : w.code))
                  .join(", ")}
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="radio">
          {!route.length
            ? empty(t("maptools.buildFirst"))
            : !radio.length
              ? empty(t("maptools.noFrequencies"))
              : radio.map(([title, context, rows]) => (
                  <div key={title} className="legacy-card">
                    <div className="legacy-card-title">
                      <span>
                        {[phaseTitle(title, rows), context]
                          .filter(Boolean)
                          .join(" - ")}
                      </span>
                      <span className="legacy-tag">{rows.length}</span>
                    </div>
                    {rows.map((f, i) => (
                      <div key={i} className="legacy-line">
                        <span className="legacy-tag">{tag(f)}</span>
                        <span>
                          {[f.callsign, f.sector].filter(Boolean).join(" / ")}
                        </span>
                        <strong>{f.frequencyMhz}</strong>
                      </div>
                    ))}
                  </div>
                ))}
        </TabsContent>
        <TabsContent value="zones">
          <div className="legacy-card">
            <div className="legacy-card-title">
              {t("maptools.crossed")}
              <span className="legacy-tag">{crossed.length}</span>
            </div>
            {crossed.length ? (
              crossed.map((z, i) => (
                <div key={i} className="legacy-line">
                  <span
                    className={
                      z.properties.active_now ? "legacy-tag hot" : "legacy-tag"
                    }
                  >
                    {airspaceKind(z.properties.name, z.properties.class)}
                  </span>
                  <span>{z.properties.name}</span>
                  <span className="legacy-muted">
                    {z.properties.lower}-{z.properties.upper}
                  </span>
                </div>
              ))
            ) : (
              <div className="legacy-muted">{t("maptools.noCrossed")}</div>
            )}
          </div>
          <div className="legacy-card">
            <div className="legacy-card-title">AUP</div>
            <div className="legacy-muted">
              {plan === "none"
                ? t("maptools.none")
                : t(plan === "next" ? "map.planNext" : "map.planCurrent")}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
