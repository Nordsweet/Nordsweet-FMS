"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import type * as maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { type AirspacePlan } from "~/api/aviation/client";
import {
  type TrafficAircraft,
  type AirspaceFeature,
} from "~/api/aviation/schemas";
import {
  findMapObjects,
  mapSearchKey,
  type MapSearchResult,
} from "~/domain/map-search";
import { MapSearch } from "./map-search";
import { WaypointInsertionDialog } from "./waypoint-insertion-dialog";
import { type TrafficPattern } from "~/data/traffic-pattern";
import {
  routeWithTrafficPattern,
  trafficPatternGeometry,
} from "~/domain/traffic-pattern";
import { TrafficPatternPopup } from "~/features/fly/traffic-pattern-popup";
import { airspaceStyle } from "~/domain/airspace-style";
import { anchoredWaypoint } from "~/domain/waypoint-insertion";
import {
  pointKey,
  formatRoutePoint,
  speedRestrictionKt,
} from "~/domain/route-plan";
import { type FlightPoint } from "~/data/flight";
import { distanceNm, initialBearingDeg } from "~/domain/geo";
import {
  airspaceKind,
  plannedAltitudeForZone,
  nearestRouteSegment,
  nextWaypointIdent,
  polygonContainsPoint,
  projectedPosition,
  routeCrossesPolygon,
  routeSegmentMinutes,
} from "~/domain/map-navigation";
import {
  currentCallsignHistory,
  trafficCallsign,
  trafficTrailSegments,
  trafficTrailGaps,
} from "~/domain/traffic-history";
import { useTrafficSession } from "~/stores/traffic-session";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings, type Basemap, type LayerId } from "~/stores/map";
import { useGps } from "~/features/fly/use-gps";
import { MapSummary } from "./map-summary";
import { PointDetails } from "./point-details";
import { aircraftSymbol, pointSymbol, pointSymbols } from "./symbols";
import { TrafficCard } from "./traffic-card";
import { useMapAnimation } from "./use-map-animation";
import { planAirportFixes } from "~/domain/plan-airport-fixes";
import { useChartLabels } from "./use-chart-labels";
import { FloatingDetails } from "./floating-details";
import { AirspaceDetails } from "./airspace-details";
import { useT } from "~/i18n/use-t";
import { usePlan } from "~/features/plan/use-plan";
import { useFlight } from "~/stores/flight";

export type { Basemap, LayerId } from "~/stores/map";

type Props = {
  embedded?: boolean;
  basemap: Basemap;
  layers: Record<LayerId, boolean>;
  plan: AirspacePlan | "none";
  /** The info box (counts, filters, summary); the in-flight map shows it only with Layers open. */
  overlay?: boolean;
  toolsContainer?: HTMLDivElement | null;
};

const POLAND: [[number, number], [number, number]] = [
  [13.75, 48.65],
  [24.45, 55.15],
];
/** The API's coverage (PL, CZ, SK) fits one 250 NM query around central Poland/Czechia. */
/** The airspace the map loads; the flight COMMs panel reads the same cached query. */
export const AIRSPACE_QUERY = { lat: 50.8, lon: 18.5, radiusNm: 250 };

type Click =
  | {
      kind: "segment";
      lngLat: { lng: number; lat: number };
    }
  | {
      kind: "airspace";
      lngLat: { lng: number; lat: number };
      zone?: AirspaceFeature;
    }
  | {
      kind: "point";
      lngLat: { lng: number; lat: number };
      point: FlightPoint & { name: string; kind: string };
    }
  | {
      kind: "traffic";
      lngLat: { lng: number; lat: number };
      hex: string;
      aircraft?: TrafficAircraft;
    };

const toFeatures = (
  rows: {
    ident: string;
    name: string;
    lat: number;
    lon: number;
    kind: string;
    symbol?: string;
    heading?: number;
  }[],
) => ({
  type: "FeatureCollection" as const,
  features: rows.map((r) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [r.lon, r.lat] },
    properties: {
      ident: r.ident,
      name: r.name,
      kind: r.kind,
      symbol: r.symbol ?? "ifr",
      heading: r.heading ?? 0,
    },
  })),
});

export function MapView({
  embedded = false,
  basemap,
  layers,
  plan,
  overlay = true,
  toolsContainer,
}: Props) {
  const t = useT();
  const client = useQueryClient();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const planeLabels = useRef(new Map<string, maplibregl.Marker>());
  const [cursorPosition, setCursorPosition] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [click, setClick] = useState<Click | null>(null);
  const [patternPreview, setPatternPreview] = useState<TrafficPattern | null>(
    null,
  );
  const [insertingPoint, setInsertingPoint] = useState<FlightPoint | null>(
    null,
  );
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const { route: plannedRoute, plan: routePlan, cruiseSpeedKt } = usePlan();
  const settings = useMapSettings();
  const navigation = useInFlight();
  const { fix, error: gpsError } = useGps(
    settings.gpsEnabled || navigation.startedAt !== null,
  );
  const route = navigation.startedAt ? navigation.route : plannedRoute;
  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  }, [route]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const imported = useQuery(api.map.importedAirspace.queryOptions(undefined));
  const { histories, observe } = useTrafficSession();
  const selectedHex = click?.kind === "traffic" ? click.hex : "";
  const selectedHistoryQuery = useQuery({
    ...api.traffic.history.queryOptions({ hex: selectedHex }),
    enabled: !!selectedHex,
    retry: false,
    refetchInterval: selectedHex ? 15000 : false,
  });

  const airports = useQuery(api.airports.list.queryOptions(undefined));
  const navpoints = useQuery(api.navpoints.list.queryOptions(undefined));
  const procedures = useQuery(api.procedures.all.queryOptions(undefined));
  const activeEndpoint = navigation.startedAt
    ? navigation.route.at(-1)?.ident
    : null;
  const diversionAirport = navigation.startedAt
    ? (navigation.divertAirport ??
      (airports.data?.some((airport) => airport.ident === activeEndpoint)
        ? activeEndpoint
        : null))
    : null;
  const visibleNavpoints = useMemo(
    () =>
      planAirportFixes(
        navpoints.data ?? [],
        procedures.data ?? [],
        (airports.data ?? [])
          .filter((airport) => airport.isIcao)
          .map((airport) => airport.ident),
        [flight.departure?.ident, flight.destination?.ident, diversionAirport],
      ),
    [
      navpoints.data,
      procedures.data,
      airports.data,
      flight.departure?.ident,
      flight.destination?.ident,
      diversionAirport,
    ],
  );
  const airspace = useQuery(
    api.airspace.around.queryOptions({
      ...AIRSPACE_QUERY,
      plan: plan === "none" ? "current" : plan,
    }),
  );
  // Traffic in the visible area (rounded so small pans do not refetch), every 15 s while shown.
  const [view, setView] = useState({
    lat: 51.9,
    lon: 19.1,
    radiusNm: 250,
  });
  const traffic = useQuery({
    ...api.traffic.around.queryOptions(view),
    enabled: ready && layers.traffic,
    refetchInterval: 15_000,
    // A new viewport is a new query key; keep the old aircraft on screen until it loads.
    placeholderData: keepPreviousData,
  });
  const zones = useMemo(
    () =>
      [...(airspace.data?.features ?? []), ...(imported.data ?? [])]
        .map((zone) =>
          plan === "none"
            ? {
                ...zone,
                properties: {
                  ...zone.properties,
                  activations: [],
                  active_now: null,
                },
              }
            : zone,
        )
        .filter(
          (zone) =>
            !settings.hiddenClasses.includes(
              airspaceKind(zone.properties.name, zone.properties.class),
            ),
        ),
    [airspace.data, imported.data, plan, settings.hiddenClasses],
  );
  const zonesRef = useRef(zones);
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);
  const crossed = useMemo(
    () =>
      zones.filter((zone) =>
        routeCrossesPolygon(route, zone.geometry.coordinates),
      ),
    [zones, route],
  );
  const selectedAircraft =
    click?.kind === "traffic" && layers.traffic
      ? (traffic.data?.aircraft.find((a) => a.hex === click.hex) ??
        (click.aircraft &&
        now - Date.parse(click.aircraft.position_time) < 60_000
          ? click.aircraft
          : null))
      : null;
  const selectedSegment =
    click?.kind === "segment"
      ? nearestRouteSegment(route, {
          lat: click.lngLat.lat,
          lon: click.lngLat.lng,
        })
      : null;
  const inspectionZones = useMemo(
    () =>
      click?.kind === "airspace"
        ? click.zone
          ? [click.zone]
          : zones.filter((zone) =>
              polygonContainsPoint(zone.geometry.coordinates, {
                lat: click.lngLat.lat,
                lon: click.lngLat.lng,
              }),
            )
        : [],
    [click, zones],
  );
  const selectedHistory = useMemo(
    () =>
      selectedAircraft
        ? currentCallsignHistory(
            selectedHistoryQuery.data ?? [],
            [
              ...(histories.get(selectedAircraft.hex) ?? []),
              {
                lat: selectedAircraft.lat,
                lon: selectedAircraft.lon,
                sampledAt: Date.parse(selectedAircraft.position_time),
                callsign: trafficCallsign(selectedAircraft.callsign),
              },
            ],
            trafficCallsign(selectedAircraft.callsign),
          )
        : [],
    [selectedAircraft, selectedHistoryQuery.data, histories],
  );
  const trafficByHex = useRef(new Map<string, TrafficAircraft>());

  useMapAnimation({
    mapRef,
    ready,
    aircraft: traffic.data?.aircraft,
    trafficEnabled: layers.traffic,
    fix,
    following: settings.following,
    trackUp: settings.trackUp,
    labels: planeLabels,
    selectedHex,
    directRoute: route[0]?.ident === "DCT" ? route : null,
  });

  // Create the map once. maplibre-gl touches `window`, so it is loaded in the browser only.
  useEffect(() => {
    let cancelled = false;
    void import("maplibre-gl").then((ml) => {
      if (cancelled || !container.current) return;
      // Bundlers miss MapLibre's worker; dev/build copy it to public/.
      ml.setWorkerUrl("/maplibre-gl-worker.mjs");
      const map = new ml.Map({
        container: container.current,
        bounds: POLAND,
        fitBoundsOptions: { padding: 28 },
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
              paint: { "background-color": "#faf9f4" },
            },
            {
              id: "osm",
              type: "raster",
              source: "osm",
              paint: { "raster-brightness-max": 1 },
            },
          ],
        },
      });
      mapRef.current = map;
      map.addControl(new ml.ScaleControl({ unit: "nautical" }), "bottom-left");
      // Overlay initialization must not wait for remote raster tiles (offline/slow networks).
      map.once("style.load", () => {
        if (cancelled) return;
        const empty = { type: "FeatureCollection" as const, features: [] };
        for (const id of [
          "airspace",
          "airports",
          "vfr",
          "ifr",
          "route",
          "traffic",
          "ownship",
          "gps-trail",
          "gps-vector",
          "gps-accuracy",
          "gps-ticks",
          "traffic-trail",
          "traffic-gap",
          "traffic-vector",
          "traffic-estimate",
          "direct-to",
          "navaids",
          "planned-route",
          "pattern-preview",
        ])
          map.addSource(id, { type: "geojson", data: empty });
        map.addLayer({
          id: "airspace-fill",
          type: "fill",
          source: "airspace",
          paint: {
            "fill-color": ["get", "fill"],
            "fill-opacity": ["get", "fillOpacity"],
          },
        });
        map.addLayer({
          id: "airspace-line",
          type: "line",
          source: "airspace",
          paint: {
            "line-color": ["get", "stroke"],
            "line-width": ["get", "lineWidth"],
          },
        });
        for (const symbol of pointSymbols)
          map.addImage(`point-${symbol}`, pointSymbol(symbol), {
            pixelRatio: 2,
          });
        for (const id of ["ifr", "vfr", "airports", "navaids"])
          map.addLayer({
            id,
            type: "symbol",
            source: id,
            layout: {
              "icon-image": ["concat", "point-", ["get", "symbol"]],
              "icon-rotate": ["get", "heading"],
              "icon-rotation-alignment": "map",
              "icon-allow-overlap": true,
            },
          });
        map.addLayer({
          id: "route-halo",
          type: "line",
          source: "route",
          paint: { "line-color": "rgba(255,0,255,.36)", "line-width": 4 },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": "#ff00ff", "line-width": 1.6 },
        });
        map.addLayer({
          id: "planned-route",
          type: "line",
          source: "planned-route",
          paint: {
            "line-color": "#ff00ff",
            "line-width": 2,
            "line-opacity": 0.4,
            "line-dasharray": [4, 3],
          },
        });
        map.addLayer({
          id: "pattern-preview",
          type: "line",
          source: "pattern-preview",
          paint: {
            "line-color": "#ff00ff",
            "line-width": 2.5,
            "line-dasharray": [4, 3],
          },
        });
        map.addImage("aircraft", aircraftSymbol([17, 17, 17]), {
          pixelRatio: 2,
        });
        map.addImage("aircraft-flarm", aircraftSymbol([17, 17, 17]), {
          pixelRatio: 2,
        });
        map.addImage("aircraft-ground", aircraftSymbol([17, 17, 17]), {
          pixelRatio: 2,
        });
        map.addImage("aircraft-red", aircraftSymbol([220, 38, 38]), {
          pixelRatio: 2,
        });
        map.addImage("aircraft-amber", aircraftSymbol([245, 158, 11]), {
          pixelRatio: 2,
        });
        map.addImage("aircraft-caution", aircraftSymbol([255, 255, 255]), {
          pixelRatio: 2,
        });
        map.addImage("aircraft-ownship", aircraftSymbol([36, 79, 134], true), {
          pixelRatio: 2,
        });
        map.addLayer({
          id: "traffic",
          type: "symbol",
          source: "traffic",
          layout: {
            "icon-image": [
              "case",
              ["==", ["get", "alert"], "red"],
              "aircraft-red",
              ["==", ["get", "alert"], "amber"],
              "aircraft-amber",
              ["==", ["get", "alert"], "caution"],
              "aircraft-caution",
              ["get", "onGround"],
              "aircraft-ground",
              ["get", "flarm"],
              "aircraft-flarm",
              "aircraft",
            ],
            "icon-rotate": ["get", "track"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
          },
          paint: { "icon-opacity": ["get", "alpha"] },
        });

        map.addLayer({
          id: "gps-trail-halo",
          type: "line",
          source: "gps-trail",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "rgba(118,242,164,.28)", "line-width": 7 },
        });
        map.addLayer({
          id: "traffic-trail-halo",
          type: "line",
          source: "traffic-trail",
          paint: { "line-color": "rgba(255,255,255,.82)", "line-width": 5.2 },
        });
        for (const [id, color, dash] of [
          ["gps-trail", "rgba(118,242,164,.94)", false],
          ["gps-vector", "rgba(36,79,134,.9)", false],
          ["traffic-trail", "#f59e0b", false],
          ["traffic-gap", "#f59e0b", true],
          ["traffic-vector", "#f59e0b", true],
          ["traffic-estimate", "#00a6c7", true],
          ["direct-to", "#ff00ff", false],
        ] as const) {
          map.addLayer({
            id,
            type: "line",
            source: id,
            paint: {
              "line-color": color,
              "line-width":
                id === "gps-trail" ? 2.8 : id === "traffic-trail" ? 2.6 : 2,
              ...(dash ? { "line-dasharray": [4, 3] } : {}),
            },
          });
        }
        map.addLayer({
          id: "gps-accuracy",
          type: "fill",
          source: "gps-accuracy",
          paint: { "fill-color": "#244f86", "fill-opacity": 0.1 },
        });
        map.addLayer({
          id: "gps-accuracy-line",
          type: "line",
          source: "gps-accuracy",
          paint: {
            "line-color": "#244f86",
            "line-opacity": 0.35,
            "line-width": 1.2,
          },
        });
        map.addLayer({
          id: "gps-ticks",
          type: "line",
          source: "gps-ticks",
          paint: { "line-color": "rgba(36,79,134,.9)", "line-width": 2 },
        });
        map.addLayer({
          id: "ownship",
          type: "symbol",
          source: "ownship",
          layout: {
            "icon-image": "aircraft-ownship",
            "icon-rotate": ["get", "track"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
          },
          paint: { "icon-opacity": ["get", "alpha"] },
        });

        map.on("dragstart", () => useMapSettings.getState().follow(false));
        let lastCursorUpdate = 0;
        map.on("mousemove", (event) => {
          if (Date.now() - lastCursorUpdate < 100) return;
          lastCursorUpdate = Date.now();
          setCursorPosition({ lat: event.lngLat.lat, lon: event.lngLat.lng });
        });
        let lastViewportUpdate = 0;
        map.on("moveend", () => {
          if (Date.now() - lastViewportUpdate < 1100) return;
          lastViewportUpdate = Date.now();
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
              { layers: ["traffic", "airports", "vfr", "ifr", "navaids"] },
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
            setClick({ kind: "traffic", lngLat: e.lngLat, hex: aircraft.hex });
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
          const routeHit = map.queryRenderedFeatures(
            [
              [e.point.x - 6, e.point.y - 6],
              [e.point.x + 6, e.point.y + 6],
            ],
            { layers: ["route"] },
          )[0];
          if (routeHit) {
            const segment = nearestRouteSegment(routeRef.current, {
              lat: e.lngLat.lat,
              lon: e.lngLat.lng,
            });
            if (segment) {
              setClick({ kind: "segment", lngLat: e.lngLat });
              return;
            }
          }
          const activeZones = zonesRef.current.filter((zone) =>
            polygonContainsPoint(zone.geometry.coordinates, {
              lat: e.lngLat.lat,
              lon: e.lngLat.lng,
            }),
          );
          if (activeZones.length) {
            setClick({
              kind: "airspace",
              lngLat: e.lngLat,
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
        const camera = () => {
          if (!container.current) return;
          container.current.dataset.centerLon = String(map.getCenter().lng);
          container.current.dataset.centerLat = String(map.getCenter().lat);
          container.current.dataset.zoom = String(map.getZoom());
        };
        camera();
        map.on("move", camera);
        mapRef.current = map;
        map.addSource("search-selection", { type: "geojson", data: empty });
        map.addLayer({
          id: "search-selection-fill",
          type: "fill",
          source: "search-selection",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#ffb000", "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "search-selection-line",
          type: "line",
          source: "search-selection",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "line-color": "#ffb000", "line-width": 3 },
        });
        map.addLayer({
          id: "search-selection-point",
          type: "circle",
          source: "search-selection",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 17,
            "circle-color": "#ffb000",
            "circle-opacity": 0.2,
            "circle-stroke-color": "#ffb000",
            "circle-stroke-width": 3,
          },
        });
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
    if (ready)
      void source("airspace")?.setData({
        type: "FeatureCollection",
        features: zones.map((zone) => ({
          ...zone,
          properties: {
            ...zone.properties,
            ...airspaceStyle(zone.properties),
            kind: airspaceKind(zone.properties.name, zone.properties.class),
          },
        })),
      });
  }, [ready, zones]);

  useEffect(() => {
    if (ready && airports.data)
      void source("airports")?.setData(
        toFeatures(
          airports.data.map((a) => ({
            ...a,
            kind: "airport",
            symbol:
              a.type === "controlled"
                ? "controlled"
                : a.isIcao
                  ? "runway"
                  : "airport",
            heading: a.runways[0]?.trueHeadingDeg ?? 0,
          })),
        ),
      );
  }, [ready, airports.data]);

  useEffect(() => {
    if (!ready) return;
    void source("vfr")?.setData(
      toFeatures(
        visibleNavpoints
          .filter((p) => p.kind === "vfr-reporting-point")
          .map((p) => ({ ...p, symbol: "reporting" })),
      ),
    );
    void source("ifr")?.setData(
      toFeatures(
        visibleNavpoints.filter(
          (p) => p.kind !== "vfr-reporting-point" && p.kind !== "navaid",
        ),
      ),
    );
    void source("navaids")?.setData(
      toFeatures(
        visibleNavpoints
          .filter((p) => p.kind === "navaid")
          .map((p) => ({
            ...p,
            symbol: /VOR.*DME/i.test(p.navaid?.type ?? "")
              ? "vordme"
              : /VOR/i.test(p.navaid?.type ?? "")
                ? "vor"
                : /DME/i.test(p.navaid?.type ?? "")
                  ? "dme"
                  : /NDB/i.test(p.navaid?.type ?? "")
                    ? "ndb"
                    : "navaid",
          })),
      ),
    );
  }, [ready, visibleNavpoints]);

  useEffect(() => {
    if (!ready) return;
    const aircraft = layers.traffic ? (traffic.data?.aircraft ?? []) : [];
    trafficByHex.current = new Map(aircraft.map((a) => [a.hex, a]));
    for (const [id, coordinates] of [
      ["traffic-trail", trafficTrailSegments(selectedHistory)],
      ["traffic-gap", trafficTrailGaps(selectedHistory)],
    ] as const)
      void source(id)?.setData({
        type: "FeatureCollection",
        features:
          layers.traffic && coordinates.length > 0
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "MultiLineString",
                    coordinates,
                  },
                },
              ]
            : [],
      });
  }, [ready, layers.traffic, traffic.data, selectedHistory]);

  useEffect(() => {
    observe(traffic.data?.aircraft ?? []);
  }, [traffic.data, observe]);

  useEffect(() => {
    if (!ready) return;
    void source("gps-trail")?.setData({
      type: "FeatureCollection",
      features:
        settings.gpsEnabled && settings.gpsTrack.length >= 2
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: settings.gpsTrack.map((p) => [p.lon, p.lat]),
                },
              },
            ]
          : [],
    });
  }, [ready, settings.gpsTrack, settings.gpsEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !settings.command) return;
    if (settings.command === "zoomIn" || settings.command === "zoomOut")
      map.easeTo({
        zoom:
          map.getZoom() + Math.log2(settings.command === "zoomIn" ? 1.3 : 0.77),
        duration: 0,
      });
    if (settings.command === "reset")
      map.fitBounds(POLAND, { padding: 28, bearing: 0, duration: 0 });
    else if (settings.command === "fit" && route.length) {
      const xs = route.map((p) => p.lon),
        ys = route.map((p) => p.lat);
      map.fitBounds(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        { padding: 60, maxZoom: 12 },
      );
    }
    settings.request(null);
  }, [ready, settings, route]);

  useChartLabels(mapRef, ready, {
    airports: airports.data ?? [],
    points: visibleNavpoints,
    zones,
    aircraft: traffic.data?.aircraft ?? [],
    layers,
    enabled: settings.labels,
    fix,
  });

  useEffect(() => {
    if (!ready) return;
    const previewRoute = patternPreview
      ? navigation.startedAt && fix
        ? [
            { ident: "DCT", ...fix },
            ...trafficPatternGeometry(patternPreview).points,
          ]
        : routeWithTrafficPattern(plannedRoute, patternPreview)
      : [];
    void source("pattern-preview")?.setData({
      type: "FeatureCollection",
      features:
        previewRoute.length >= 2
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: previewRoute.map((p) => [p.lon, p.lat]),
                },
              },
            ]
          : [],
    });
  }, [ready, patternPreview, fix, navigation.startedAt, plannedRoute]);

  // Route line and labelled markers (DOM markers need no glyph server, so they work offline).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const points = route;
    void source("route")?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: (points[0]?.ident === "DCT"
              ? points.slice(1)
              : points
            ).map((p) => [p.lon, p.lat]),
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
    void source("planned-route")?.setData({
      type: "FeatureCollection",
      features:
        route[0]?.ident === "DCT" && plannedRoute.length >= 2
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: plannedRoute.map((p) => [p.lon, p.lat]),
                },
              },
            ]
          : [],
    });
    markers.current.forEach((m) => m.remove());
    let cancelled = false;
    void import("maplibre-gl").then((ml) => {
      if (cancelled) return;
      markers.current = [
        ...points.filter((p) => !p.patternId),
        ...(flight.alternate ? [flight.alternate] : []),
      ].map((p) => {
        const el = document.createElement("div");
        el.className = "legacy-route-marker";
        el.dataset.routeMarker = p.ident;
        el.textContent =
          navpoints.data?.find(
            (point) =>
              point.kind === "vfr-reporting-point" &&
              (point.ident === p.ident || point.aliases.includes(p.ident)),
          )?.aliases[0] ?? p.ident;
        el.style.cursor = "pointer";
        el.style.display = layers.route ? "" : "none";
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", p.ident);
        el.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            el.click();
          }
        });
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          setClick({
            kind: "point",
            lngLat: new ml.LngLat(p.lon, p.lat),
            point: {
              ...p,
              name: p.ident,
              kind: airports.data?.some((a) => a.ident === p.ident)
                ? "airport"
                : "route",
            },
          });
        });
        return new ml.Marker({ element: el, anchor: "left", offset: [0, -11] })
          .setLngLat([p.lon, p.lat])
          .addTo(map);
      });
    });
    return () => {
      cancelled = true;
      markers.current.forEach((marker) => marker.remove());
    };
  }, [
    ready,
    route,
    flight.destination,
    flight.alternate,
    airports.data,
    plannedRoute,
    layers.route,
    navpoints.data,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setLayoutProperty(
      "osm",
      "visibility",
      basemap === "osm" ? "visible" : "none",
    );
    map.setPaintProperty(
      "background",
      "background-color",
      basemap === "dark" ? "#05070b" : "#faf9f4",
    );
    const show = (id: string, on: boolean) =>
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    show("airspace-fill", layers.airspace);
    show("airspace-line", layers.airspace);
    show("airports", layers.airports);
    show("vfr", layers.vfr);
    show("ifr", layers.ifr);
    show("traffic", layers.traffic);
    show("navaids", layers.navaids);
    show("route", layers.route);
    show("route-halo", layers.route);
    show("planned-route", layers.route);

    show("direct-to", layers.route);
    show("traffic-estimate", layers.traffic);
    show("traffic-trail", layers.traffic);
    show("traffic-gap", layers.traffic);
    show("traffic-trail-halo", layers.traffic);
    show("traffic-vector", layers.traffic);
    for (const marker of markers.current)
      marker.getElement().style.display = layers.route ? "" : "none";
  }, [ready, basemap, layers]);

  const segmentTime = (index: number) => {
    const target = route[index + 1],
      from = route[index];
    if (!target || !from) return "--";
    const point = routePlan?.points.find(
      (p) => formatRoutePoint(p) === target.ident,
    );
    const speed = point
      ? speedRestrictionKt(point)
      : (flight.pointRestrictions[target.ident]?.speedKt ?? null);
    const minutes = routeSegmentMinutes(
      distanceNm(from, target),
      cruiseSpeedKt,
      speed,
    );
    return minutes === null
      ? "--"
      : String(Math.floor(minutes / 60)).padStart(2, "0") +
          ":" +
          String(minutes % 60).padStart(2, "0");
  };
  const createWaypoint = (
    segment: NonNullable<ReturnType<typeof nearestRouteSegment>>,
  ) => {
    const ident = nextWaypointIdent(route),
      from = route[segment.index]!,
      to = route[segment.index + 1]!;
    const waypoint = {
      ident,
      ...segment.point,
      anchor: {
        from: from.ident,
        to: to.ident,
        fromPosition: { lat: from.lat, lon: from.lon },
        toPosition: { lat: to.lat, lon: to.lon },
      },
    };
    const altitude = (point: typeof from) => {
      const match = routePlan?.points.find(
        (p) => p.lat === point.lat && p.lon === point.lon,
      );
      return match
        ? (routePlan?.pointAltitudeByKey[pointKey(match)] ??
            flight.cruiseAltitudeFt)
        : flight.cruiseAltitudeFt;
    };
    const altitudeFt = Math.round(
      altitude(from) + (altitude(to) - altitude(from)) * segment.fraction,
    );
    const before = flight.waypoints.findIndex(
      (p) => p.ident === to.ident && p.lat === to.lat && p.lon === to.lon,
    );
    const after = flight.waypoints.findIndex(
      (p) => p.ident === from.ident && p.lat === from.lat && p.lon === from.lon,
    );
    const insertAt =
      before >= 0 ? before : after >= 0 ? after + 1 : flight.waypoints.length;
    update({
      waypoints: [
        ...flight.waypoints.slice(0, insertAt),
        waypoint,
        ...flight.waypoints.slice(insertAt),
      ],
      waypointAltitudes: { ...flight.waypointAltitudes, [ident]: altitudeFt },
    });
    if (navigation.startedAt)
      navigation.insertWaypoint(segment.index + 1, waypoint);
    setClick(null);
  };
  const addPoint = (
    point: FlightPoint,
    as: "departure" | "destination" | "waypoint",
  ) => {
    const p = { ident: point.ident, lat: point.lat, lon: point.lon };
    if (as === "waypoint") setInsertingPoint(p);
    else
      update({
        [as]: p,
        ...(as === "departure"
          ? { sid: null }
          : { star: null, approach: null }),
      });
    setClick(null);
  };

  async function searchObjects(text: string) {
    const [fields, points, publishedProcedures] = await Promise.all([
      client.ensureQueryData(api.airports.list.queryOptions(undefined)),
      client.ensureQueryData(api.navpoints.list.queryOptions(undefined)),
      client.ensureQueryData(api.procedures.all.queryOptions(undefined)),
    ]);
    const allZones = [
      ...(airspace.data?.features ?? []),
      ...(imported.data ?? []),
    ];
    const base = {
      airports: fields,
      points: planAirportFixes(
        points,
        publishedProcedures,
        fields.map((a) => a.ident),
        fields.map((a) => a.ident),
      ),
      zones: allZones,
      aircraft: traffic.data?.aircraft ?? [],
    };
    const local = findMapObjects(text, base);
    // A known static identifier needs no network, including when the device is offline.
    if (local.length && local.every((result) => result.kind !== "traffic"))
      return local;
    if (!airspace.data) {
      const loaded = await client
        .ensureQueryData({
          ...api.airspace.around.queryOptions({
            ...AIRSPACE_QUERY,
            plan: plan === "none" ? "current" : plan,
          }),
          retry: false,
        })
        .catch(() => null);
      base.zones = [...(loaded?.features ?? []), ...(imported.data ?? [])];
      const matches = findMapObjects(text, base);
      if (
        matches.length &&
        matches.every((result) => result.kind !== "traffic")
      )
        return matches;
    }
    const center = mapRef.current?.getCenter();
    const snapshot = await client
      .fetchQuery({
        ...api.traffic.around.queryOptions({
          lat: center?.lat ?? view.lat,
          lon: center?.lng ?? view.lon,
          radiusNm: 250,
        }),
        retry: false,
      })
      .catch(() => null);
    const aircraft = snapshot?.aircraft ?? base.aircraft;
    let results = findMapObjects(text, { ...base, aircraft });
    if (
      !results.length &&
      /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(mapSearchKey(text))
    ) {
      const aliases = await client.fetchQuery({
        ...api.traffic.identifiers.queryOptions({
          callsign: mapSearchKey(text),
        }),
        retry: false,
      });
      results = findMapObjects(text, { ...base, aircraft }, aliases);
    }
    if (!results.length && !snapshot) throw new Error("Traffic unavailable");
    return results;
  }

  function selectSearchResult(result: MapSearchResult) {
    const map = mapRef.current;
    if (!map) return;
    settings.follow(false);
    settings.setSearchOpen(false);
    if (result.kind === "airspace") {
      const [west, south, east, north] = result.zone.bbox;
      setClick({
        kind: "airspace",
        zone: result.zone,
        lngLat: { lng: (west + east) / 2, lat: (south + north) / 2 },
      });
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 90, maxZoom: 11, duration: 700 },
      );
    } else {
      const point =
        result.kind === "point"
          ? result.point
          : (projectedPosition(
              result.aircraft,
              result.aircraft.position_time,
              result.aircraft.ground_speed_kt,
              result.aircraft.track_deg,
              Date.now(),
            ) ?? result.aircraft);
      setClick(
        result.kind === "point"
          ? {
              kind: "point",
              point: result.point,
              lngLat: { lng: point.lon, lat: point.lat },
            }
          : {
              kind: "traffic",
              hex: result.aircraft.hex,
              aircraft: result.aircraft,
              lngLat: { lng: point.lon, lat: point.lat },
            },
      );
      const layer =
        result.kind === "traffic"
          ? "traffic"
          : result.point.kind === "airport"
            ? "airports"
            : result.point.kind === "navaid"
              ? "navaids"
              : result.point.kind === "vfr-reporting-point" ||
                  result.point.kind === "airfield"
                ? "vfr"
                : "ifr";
      settings.update({ layers: { ...settings.layers, [layer]: true } });
      map.flyTo({
        center: [point.lon, point.lat],
        zoom: Math.max(9, map.getZoom()),
        duration: 700,
      });
    }
  }

  const selectionTime = selectedAircraft ? now : 0;
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const source =
      mapRef.current.getSource<maplibregl.GeoJSONSource>("search-selection");
    if (!source) return;
    const point =
      click?.kind === "point"
        ? click.point
        : selectedAircraft
          ? (projectedPosition(
              selectedAircraft,
              selectedAircraft.position_time,
              selectedAircraft.ground_speed_kt,
              selectedAircraft.track_deg,
              selectionTime,
            ) ?? selectedAircraft)
          : null;
    const data =
      click?.kind === "airspace"
        ? inspectionZones
        : point
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "Point" as const,
                  coordinates: [point.lon, point.lat],
                },
              },
            ]
          : [];
    void source.setData({ type: "FeatureCollection", features: data });
  }, [ready, click, selectedAircraft, inspectionZones, selectionTime]);

  return (
    <div
      className="legacy-map absolute inset-0"
      data-pattern-preview={patternPreview ? "true" : "false"}
    >
      {navigation.startedAt && <TrafficPatternPopup />}
      {insertingPoint && (
        <WaypointInsertionDialog
          key={
            insertingPoint.ident +
            route.map((p) => `${p.ident}|${p.lat}|${p.lon}`).join(";")
          }
          point={insertingPoint}
          route={route}
          altitudeFt={(point) => {
            const planned = routePlan?.points.find(
              (p) =>
                Math.abs(p.lat - point.lat) < 0.00001 &&
                Math.abs(p.lon - point.lon) < 0.00001,
            );
            return planned
              ? (routePlan?.pointAltitudeByKey[pointKey(planned)] ??
                  flight.cruiseAltitudeFt)
              : (airports.data?.find((a) => a.ident === point.ident)
                  ?.elevationFt ?? flight.cruiseAltitudeFt);
          }}
          close={() => setInsertingPoint(null)}
          insert={(index) => {
            const point = anchoredWaypoint(route, insertingPoint, index);
            update({ waypoints: [...flight.waypoints, point] });
            if (navigation.startedAt) navigation.insertWaypoint(index, point);
            setInsertingPoint(null);
          }}
        />
      )}
      {!embedded && (
        <Button
          aria-label={t("mapsearch.title")}
          title={t("mapsearch.title")}
          aria-expanded={settings.searchOpen}
          className="legacy-flight-tool bg-card/90 absolute top-3 left-3 z-30 backdrop-blur"
          variant="outline"
          disabled={!ready}
          onClick={() => settings.setSearchOpen(!settings.searchOpen)}
        >
          <SearchIcon className="size-6 text-white" />
        </Button>
      )}
      {settings.searchOpen && (
        <MapSearch
          search={searchObjects}
          select={selectSearchResult}
          close={() => settings.setSearchOpen(false)}
        />
      )}
      <div
        ref={container}
        className="h-full w-full"
        data-testid="map"
        data-map-ready={ready}
        data-selected-kind={click?.kind}
        data-selected-ident={
          click?.kind === "point"
            ? click.point.ident
            : click?.kind === "traffic"
              ? click.hex
              : click?.kind === "airspace"
                ? click.zone?.properties.name
                : undefined
        }
      />
      {toolsContainer &&
        createPortal(
          <div hidden={!overlay} className="legacy-map-info grid gap-2 text-xs">
            {airspace.isError && (
              <span className="text-destructive">
                {t("map.airspaceUnavailable")}
              </span>
            )}
            {layers.traffic && traffic.isError && (
              <span className="text-destructive">
                {t("maptools.trafficUnavailable")}
              </span>
            )}
            {(airspace.isFetching ||
              (layers.traffic && traffic.isFetching)) && (
              <span>{t("maptools.loading")}</span>
            )}
            <details open>
              <summary>{t("maptools.filter")}</summary>
              <div className="flex flex-wrap gap-1">
                {Array.from(
                  new Set(
                    [
                      ...(airspace.data?.features ?? []),
                      ...(imported.data ?? []),
                    ].map((zone) =>
                      airspaceKind(zone.properties.name, zone.properties.class),
                    ),
                  ),
                )
                  .sort()
                  .map((className) => (
                    <label key={className}>
                      <input
                        type="checkbox"
                        checked={!settings.hiddenClasses.includes(className)}
                        onChange={(e) =>
                          settings.update({
                            hiddenClasses: e.target.checked
                              ? settings.hiddenClasses.filter(
                                  (c) => c !== className,
                                )
                              : [...settings.hiddenClasses, className],
                          })
                        }
                      />
                      {className}{" "}
                      <small>
                        {
                          [
                            ...(airspace.data?.features ?? []),
                            ...(imported.data ?? []),
                          ].filter(
                            (z) =>
                              airspaceKind(
                                z.properties.name,
                                z.properties.class,
                              ) === className,
                          ).length
                        }
                      </small>
                    </label>
                  ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => settings.update({ hiddenClasses: [] })}
                >
                  {t("maptools.all")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    settings.update({
                      hiddenClasses: Array.from(
                        new Set(
                          [
                            ...(airspace.data?.features ?? []),
                            ...(imported.data ?? []),
                          ].map((z) =>
                            airspaceKind(z.properties.name, z.properties.class),
                          ),
                        ),
                      ),
                    })
                  }
                >
                  {t("maptools.clear")}
                </Button>
              </div>
            </details>
            <MapSummary
              route={route}
              zones={[
                ...(airspace.data?.features ?? []),
                ...(imported.data ?? []),
              ]}
              crossed={crossed}
              plan={plan}
            />
          </div>,
          toolsContainer,
        )}
      {!embedded && (
        <div className="legacy-map-readout">
          <span>
            {t("maptools.route")}:{" "}
            {route.map((p) => p.ident).join(" - ") || "--"}
          </span>
          <span>
            {cursorPosition
              ? `${cursorPosition.lat.toFixed(5)}, ${cursorPosition.lon.toFixed(5)}`
              : "--"}
          </span>
          <span data-testid="map-gps-status">
            {!settings.gpsEnabled && !navigation.startedAt
              ? "GPS off"
              : gpsError
                ? t(`fly.gps.${gpsError}`)
                : fix
                  ? t("fly.gps.fix", {
                      accuracy: Math.round(fix.accuracyM),
                      time: fix.time.slice(11, 16) + "Z",
                    })
                  : t("fly.gps.waiting")}
          </span>
        </div>
      )}
      {click &&
        (click.kind !== "traffic" || selectedAircraft) &&
        (click.kind !== "segment" || selectedSegment) && (
          <FloatingDetails
            key={
              click.kind === "traffic"
                ? click.hex
                : click.kind === "point"
                  ? click.point.ident
                  : click.kind
            }
            onClose={() => setClick(null)}
            draggable={click.kind === "traffic"}
            mapRef={mapRef}
            anchor={
              selectedAircraft
                ? (projectedPosition(
                    selectedAircraft,
                    selectedAircraft.position_time,
                    selectedAircraft.ground_speed_kt,
                    selectedAircraft.track_deg,
                    now,
                  ) ?? selectedAircraft)
                : click.kind === "point"
                  ? click.point
                  : { lat: click.lngLat.lat, lon: click.lngLat.lng }
            }
          >
            {click.kind === "traffic" && selectedAircraft ? (
              <TrafficCard
                key={selectedAircraft.hex + (selectedAircraft.callsign ?? "")}
                aircraft={selectedAircraft}
                historyCount={selectedHistory.length}
              />
            ) : click.kind === "point" ? (
              <PointDetails
                key={click.point.ident}
                point={click.point}
                now={now}
                addPoint={addPoint}
                previewPattern={setPatternPreview}
                acceptPattern={(pattern) => {
                  if (
                    navigation.startedAt &&
                    (!fix || gpsError || now - Date.parse(fix.time) > 20000)
                  )
                    return;
                  update({
                    trafficPattern: pattern,
                    destination: { ...pattern.airport },
                    star: null,
                    approach: null,
                  });
                  if (navigation.startedAt && fix)
                    navigation.joinTrafficPattern(pattern, fix);
                  settings.update({
                    layers: { ...settings.layers, route: true },
                  });
                  setPatternPreview(null);
                  setClick(null);
                }}
                removePattern={() => {
                  update({ trafficPattern: null });
                  if (navigation.startedAt) navigation.clearTrafficPattern();
                  setPatternPreview(null);
                  setClick(null);
                }}
              />
            ) : click.kind === "segment" ? (
              <div className="grid gap-2">
                <strong>{t("maptools.segment")}</strong>
                <span>
                  {route[selectedSegment!.index]?.ident} →{" "}
                  {route[selectedSegment!.index + 1]?.ident}
                </span>
                <span>
                  {t("maptools.distance")}:{" "}
                  {distanceNm(
                    route[selectedSegment!.index]!,
                    route[selectedSegment!.index + 1]!,
                  ).toFixed(1)}{" "}
                  NM
                </span>
                <span>
                  {t("maptools.track")}:{" "}
                  {Math.round(
                    initialBearingDeg(
                      route[selectedSegment!.index]!,
                      route[selectedSegment!.index + 1]!,
                    ),
                  ) % 360}
                  °T
                </span>
                <span>
                  {t("maptools.time")}: {segmentTime(selectedSegment!.index)}
                </span>
                <Button onClick={() => createWaypoint(selectedSegment!)}>
                  {t("maptools.createWaypoint")}
                </Button>
              </div>
            ) : click.kind === "airspace" ? (
              <AirspaceDetails
                point={{ lat: click.lngLat.lat, lon: click.lngLat.lng }}
                zones={inspectionZones.map((zone) => zone.properties)}
                plannedFtByZone={inspectionZones.map((zone) =>
                  plannedAltitudeForZone(
                    (routePlan?.points ?? []).map((p) => ({
                      ...p,
                      altitudeFt:
                        routePlan?.pointAltitudeByKey[pointKey(p)] ?? null,
                    })),
                    zone.geometry.coordinates,
                    flight.cruiseAltitudeFt,
                  ),
                )}
                plannedFt={routePlan?.altitudeFt ?? flight.cruiseAltitudeFt}
                currentFt={fix?.altitudeFt ?? null}
              />
            ) : null}
          </FloatingDetails>
        )}
    </div>
  );
}
