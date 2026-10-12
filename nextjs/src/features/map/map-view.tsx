"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useQuery } from "@tanstack/react-query";
import type * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { type AirspacePlan } from "~/api/aviation/client";
import {
  type AirspaceFeature,
  type TrafficAircraft,
} from "~/api/aviation/schemas";
import { type FlightPoint } from "~/data/flight";
import { distanceNm } from "~/domain/geo";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";

export type Basemap = "osm" | "dark";
export type LayerId = "airspace" | "airports" | "vfr" | "ifr" | "traffic";

type Props = {
  basemap: Basemap;
  layers: Record<LayerId, boolean>;
  plan: AirspacePlan;
};

const POLAND: [number, number] = [19.4, 52.0];
/** The API's coverage (PL, CZ, SK) fits one 250 NM query around central Poland/Czechia. */
const AIRSPACE_QUERY = { lat: 50.8, lon: 18.5, radiusNm: 250 };

const CLASS_COLOR: maplibregl.ExpressionSpecification = [
  "match",
  ["get", "class"],
  ["CTR", "C", "D", "B", "A"],
  "#3b82f6",
  ["R", "P", "Q"],
  "#ef4444",
  ["RMZ", "TMZ"],
  "#a855f7",
  "#9ca3af",
];

type Click =
  | {
      kind: "airspace";
      lngLat: maplibregl.LngLat;
      feature: AirspaceFeature["properties"];
    }
  | {
      kind: "point";
      lngLat: maplibregl.LngLat;
      point: FlightPoint & { name: string; kind: string };
    }
  | { kind: "traffic"; lngLat: maplibregl.LngLat; aircraft: TrafficAircraft };

const toFeatures = (
  rows: {
    ident: string;
    name: string;
    lat: number;
    lon: number;
    kind: string;
  }[],
) => ({
  type: "FeatureCollection" as const,
  features: rows.map((r) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
    properties: { ident: r.ident, name: r.name, kind: r.kind },
  })),
});

export function MapView({ basemap, layers, plan }: Props) {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [click, setClick] = useState<Click | null>(null);
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);

  const airports = useQuery(api.airports.list.queryOptions(undefined));
  const navpoints = useQuery(api.navpoints.list.queryOptions(undefined));
  const airspace = useQuery(
    api.airspace.around.queryOptions({ ...AIRSPACE_QUERY, plan }),
  );
  // Traffic in the visible area (rounded so small pans do not refetch), every 10 s while shown.
  const [view, setView] = useState({
    lat: POLAND[1],
    lon: POLAND[0],
    radiusNm: 250,
  });
  const traffic = useQuery({
    ...api.traffic.around.queryOptions(view),
    enabled: ready && layers.traffic,
    refetchInterval: 10_000,
  });
  const trafficByHex = useRef(new Map<string, TrafficAircraft>());

  // Create the map once. maplibre-gl touches `window`, so it is loaded in the browser only.
  useEffect(() => {
    let cancelled = false;
    void import("maplibre-gl").then((ml) => {
      if (cancelled || !container.current) return;
      // Bundlers miss MapLibre's worker; dev/build copy it to public/.
      ml.setWorkerUrl("/maplibre-gl-worker.mjs");
      const map = new ml.Map({
        container: container.current,
        center: POLAND,
        zoom: 5.5,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 18,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#0b0f14" },
            },
            {
              id: "osm",
              type: "raster",
              source: "osm",
              paint: { "raster-brightness-max": 0.75 },
            },
          ],
        },
      });
      map.addControl(
        new ml.NavigationControl({ visualizePitch: false }),
        "top-right",
      );
      map.addControl(new ml.ScaleControl({ unit: "nautical" }), "bottom-left");
      map.on("load", () => {
        const empty = { type: "FeatureCollection" as const, features: [] };
        for (const id of [
          "airspace",
          "airports",
          "vfr",
          "ifr",
          "route",
          "traffic",
        ])
          map.addSource(id, { type: "geojson", data: empty });
        map.addLayer({
          id: "airspace-fill",
          type: "fill",
          source: "airspace",
          paint: {
            "fill-color": [
              "case",
              ["==", ["get", "active_now"], true],
              "#ef4444",
              CLASS_COLOR,
            ],
            "fill-opacity": [
              "case",
              ["==", ["get", "active_now"], true],
              0.3,
              0.06,
            ],
          },
        });
        map.addLayer({
          id: "airspace-line",
          type: "line",
          source: "airspace",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "active_now"], true],
              "#ef4444",
              CLASS_COLOR,
            ],
            "line-width": ["case", ["==", ["get", "active_now"], true], 2, 1],
          },
        });
        map.addLayer({
          id: "ifr",
          type: "circle",
          source: "ifr",
          minzoom: 7,
          paint: { "circle-radius": 3, "circle-color": "#94a3b8" },
        });
        map.addLayer({
          id: "vfr",
          type: "circle",
          source: "vfr",
          minzoom: 7,
          paint: {
            "circle-radius": 4,
            "circle-color": "#22c55e",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#052e16",
          },
        });
        map.addLayer({
          id: "airports",
          type: "circle",
          source: "airports",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 7],
            "circle-color": "#38bdf8",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#082f49",
          },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": "#f472b6", "line-width": 3 },
        });
        map.addLayer({
          id: "traffic",
          type: "circle",
          source: "traffic",
          paint: {
            "circle-radius": 5,
            "circle-color": ["case", ["get", "onGround"], "#a3a3a3", "#facc15"],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#000000",
          },
        });
        map.on("moveend", () => {
          const c = map.getCenter();
          const corner = map.getBounds().getNorthEast();
          // Centre-to-corner distance covers the whole view; the API allows 1–250 NM.
          const radius = distanceNm(
            { lat: c.lat, lon: c.lng },
            { lat: corner.lat, lon: corner.lng },
          );
          setView({
            lat: Math.round(c.lat * 10) / 10,
            lon: Math.round(c.lng * 10) / 10,
            radiusNm: Math.min(250, Math.max(1, Math.ceil(radius / 10) * 10)),
          });
        });

        map.on("click", (e: maplibregl.MapMouseEvent) => {
          // Points are a few pixels wide: search a finger-sized box and take the nearest.
          const r = 10;
          const hit = map
            .queryRenderedFeatures(
              [
                [e.point.x - r, e.point.y - r],
                [e.point.x + r, e.point.y + r],
              ],
              { layers: ["traffic", "airports", "vfr", "ifr"] },
            )
            .map((f) => {
              const [lon, lat] = (
                f.geometry as unknown as { coordinates: [number, number] }
              ).coordinates;
              const px = map.project([lon, lat]);
              return { f, d: Math.hypot(px.x - e.point.x, px.y - e.point.y) };
            })
            .sort((a, b) => a.d - b.d)[0]?.f;
          const aircraft =
            hit?.layer.id === "traffic"
              ? trafficByHex.current.get(String(hit.properties.hex))
              : undefined;
          if (aircraft) {
            setClick({ kind: "traffic", lngLat: e.lngLat, aircraft });
            return;
          }
          if (hit) {
            const [lon, lat] = (
              hit.geometry as unknown as { coordinates: [number, number] }
            ).coordinates;
            const props = hit.properties as {
              ident: string;
              name: string;
              kind: string;
            };
            setClick({
              kind: "point",
              lngLat: e.lngLat,
              point: { ...props, lat, lon },
            });
            return;
          }
          const zone = map.queryRenderedFeatures(e.point, {
            layers: ["airspace-fill"],
          })[0];
          if (zone) {
            const p = zone.properties;
            // GeoJSON properties come back flattened: nested arrays arrive as JSON strings.
            const activations =
              typeof p.activations === "string"
                ? (JSON.parse(p.activations) as unknown[])
                : [];
            setClick({
              kind: "airspace",
              lngLat: e.lngLat,
              feature: {
                ...(p as AirspaceFeature["properties"]),
                activations:
                  activations as AirspaceFeature["properties"]["activations"],
              },
            });
            return;
          }
          setClick(null);
        });
        for (const layer of ["airports", "vfr", "ifr", "traffic"]) {
          map.on(
            "mouseenter",
            layer,
            () => (map.getCanvas().style.cursor = "pointer"),
          );
          map.on(
            "mouseleave",
            layer,
            () => (map.getCanvas().style.cursor = ""),
          );
        }
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const source = (id: string) =>
    mapRef.current?.getSource<maplibregl.GeoJSONSource>(id);

  useEffect(() => {
    if (ready && airspace.data) void source("airspace")?.setData(airspace.data);
  }, [ready, airspace.data]);

  useEffect(() => {
    if (ready && airports.data)
      void source("airports")?.setData(
        toFeatures(airports.data.map((a) => ({ ...a, kind: "airport" }))),
      );
  }, [ready, airports.data]);

  useEffect(() => {
    if (!ready || !navpoints.data) return;
    void source("vfr")?.setData(
      toFeatures(
        navpoints.data.filter((p) => p.kind === "vfr-reporting-point"),
      ),
    );
    void source("ifr")?.setData(
      toFeatures(
        navpoints.data.filter((p) => p.kind !== "vfr-reporting-point"),
      ),
    );
  }, [ready, navpoints.data]);

  useEffect(() => {
    if (!ready) return;
    const aircraft = layers.traffic ? (traffic.data?.aircraft ?? []) : [];
    trafficByHex.current = new Map(aircraft.map((a) => [a.hex, a]));
    void source("traffic")?.setData({
      type: "FeatureCollection",
      features: aircraft.map((a) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.lon, a.lat] },
        properties: { hex: a.hex, onGround: a.on_ground },
      })),
    });
  }, [ready, layers.traffic, traffic.data]);

  // Route line and labelled markers (DOM markers need no glyph server, so they work offline).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const points = [
      flight.departure,
      ...flight.waypoints,
      flight.destination,
    ].filter((p) => p !== null);
    void source("route")?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: points.map((p) => [p.lon, p.lat]),
          },
        },
        ...(flight.destination && flight.alternate
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "LineString" as const,
                  coordinates: [
                    [flight.destination.lon, flight.destination.lat],
                    [flight.alternate.lon, flight.alternate.lat],
                  ],
                },
              },
            ]
          : []),
      ],
    });
    markers.current.forEach((m) => m.remove());
    void import("maplibre-gl").then((ml) => {
      markers.current = [
        ...points,
        ...(flight.alternate ? [flight.alternate] : []),
      ].map((p) => {
        const el = document.createElement("div");
        el.className =
          "rounded bg-pink-500 px-1 text-[11px] font-semibold text-white shadow";
        el.textContent = p.ident;
        return new ml.Marker({ element: el, anchor: "bottom", offset: [0, -4] })
          .setLngLat([p.lon, p.lat])
          .addTo(map);
      });
    });
  }, [
    ready,
    flight.departure,
    flight.waypoints,
    flight.destination,
    flight.alternate,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty(
      "osm",
      "visibility",
      basemap === "osm" ? "visible" : "none",
    );
    const show = (id: string, on: boolean) =>
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    show("airspace-fill", layers.airspace);
    show("airspace-line", layers.airspace);
    show("airports", layers.airports);
    show("vfr", layers.vfr);
    show("ifr", layers.ifr);
    show("traffic", layers.traffic);
  }, [ready, basemap, layers]);

  const addPoint = (
    point: FlightPoint,
    as: "departure" | "destination" | "waypoint",
  ) => {
    const p = { ident: point.ident, lat: point.lat, lon: point.lon };
    if (as === "waypoint") update({ waypoints: [...flight.waypoints, p] });
    else update({ [as]: p });
    setClick(null);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" data-testid="map" />
      {airspace.isError && (
        <p className="bg-background/90 absolute top-2 left-2 rounded px-2 py-1 text-sm text-red-400">
          {t("map.airspaceUnavailable")}
        </p>
      )}
      {click && (
        <div
          className="bg-popover absolute right-2 bottom-8 left-2 z-10 max-h-[45%] overflow-y-auto rounded-lg border p-3 text-sm shadow-lg sm:left-auto sm:w-80"
          role="dialog"
          aria-label={t("map.details")}
        >
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground float-right pointer-coarse:min-h-10 pointer-coarse:px-2"
            onClick={() => setClick(null)}
            aria-label={t("map.close")}
          >
            ✕
          </button>
          {click.kind === "traffic" ? (
            <div className="grid gap-1" data-testid="traffic-card">
              <div className="font-mono font-semibold">
                {click.aircraft.callsign ??
                  click.aircraft.registration ??
                  click.aircraft.hex}
              </div>
              <div className="text-muted-foreground">
                {[click.aircraft.registration, click.aircraft.type]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div className="tabular-nums">
                {click.aircraft.on_ground
                  ? t("map.traffic.onGround")
                  : `${click.aircraft.altitude_ft ?? "—"} ft`}{" "}
                ·{" "}
                {click.aircraft.ground_speed_kt === null
                  ? "—"
                  : Math.round(click.aircraft.ground_speed_kt)}{" "}
                kt ·{" "}
                {click.aircraft.track_deg === null
                  ? "—"
                  : `${Math.round(click.aircraft.track_deg)}°T`}
                {click.aircraft.squawk ? ` · ${click.aircraft.squawk}` : ""}
              </div>
              <div className="text-muted-foreground text-xs">
                {t("map.traffic.source")}
              </div>
            </div>
          ) : click.kind === "point" ? (
            <div className="grid gap-2">
              <div>
                <div className="font-mono font-semibold">
                  {click.point.ident}
                </div>
                <div className="text-muted-foreground">
                  {click.point.name} ·{" "}
                  {t(`plan.point.${click.point.kind}` as "plan.point.airport")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {click.point.kind === "airport" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addPoint(click.point, "departure")}
                    >
                      {t("plan.route.departure")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addPoint(click.point, "destination")}
                    >
                      {t("plan.route.destination")}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addPoint(click.point, "waypoint")}
                >
                  {t("plan.route.addWaypoint")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-1">
              <div className="font-semibold">{click.feature.name}</div>
              <div className="text-muted-foreground">
                {t("map.class")} {click.feature.class} · {click.feature.lower} –{" "}
                {click.feature.upper}
              </div>
              {click.feature.activations.length === 0 ? (
                <div className="text-muted-foreground">
                  {t("map.notBooked")}
                </div>
              ) : (
                <ul className="grid gap-1">
                  {click.feature.activations.map((a, i) => (
                    <li
                      key={i}
                      className={click.feature.active_now ? "text-red-400" : ""}
                    >
                      {a.starts_at.slice(11, 16)}–{a.ends_at.slice(11, 16)} UTC
                      · {a.lower}–{a.upper}
                      {a.remarks ? ` · ${a.remarks}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {click.feature.active_now && (
                <div className="font-medium text-red-400">
                  {t("map.activeNow")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
