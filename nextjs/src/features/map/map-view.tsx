"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { cn } from "cn";
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
  activeRouteWithTrafficPattern,
} from "~/domain/traffic-pattern";
import { flyByRoute } from "~/domain/fly-by";
import { useTurnPerformance } from "~/features/fly/use-turn-performance";
import { TrafficPatternPopup } from "~/features/fly/traffic-pattern-popup";
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
import { TrafficCard } from "./traffic-card";
import { useMapAnimation } from "./use-map-animation";
import { planAirportFixes } from "~/domain/plan-airport-fixes";
import type { DeckMap, DeckScene } from "./deck";
import type { PointDatum, TrafficDatum } from "./deck/scene";
import { AirspaceCaptions } from "./deck/captions";
import { coordinatePaths, toPaths, toPoints, zoneDatum } from "./deck/data";
import { airportLabels, minuteLabels, pointNameLabels } from "./deck/labels";
import { MarkerLayer } from "./deck/markers";
import { palettes, themeOf } from "./deck/theme";
import { mapLabelVisibility } from "~/domain/map-labels";
import { MapScale } from "./map-scale";
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

const NO_ZONES: AirspaceFeature[] = [];
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
  const mapRef = useRef<DeckMap | null>(null);
  const sceneRef = useRef<DeckScene | null>(null);
  const markers = useRef<MarkerLayer | null>(null);
  const captions = useRef(new AirspaceCaptions());
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
  const patternPosition = fix ?? navigation.track.at(-1) ?? null;
  const turns = useTurnPerformance(navigation.startedAt ? fix : null);
  // The hook returns a new object each render; the geometry only depends on these numbers.
  const { tasKt, windDirectionDeg, windSpeedKt } = turns;
  const turnPerformance = useMemo(
    () => ({ tasKt, windDirectionDeg, windSpeedKt }),
    [tasKt, windDirectionDeg, windSpeedKt],
  );
  const routePath = useMemo(
    () => flyByRoute(route, turnPerformance),
    [route, turnPerformance],
  );
  const plannedPath = useMemo(
    () => flyByRoute(plannedRoute, turnPerformance).points,
    [plannedRoute, turnPerformance],
  );
  const previewRoute = useMemo(
    () =>
      patternPreview
        ? navigation.startedAt
          ? activeRouteWithTrafficPattern(
              navigation.route,
              navigation.activeLeg,
              patternPreview,
              patternPosition,
            ).route
          : routeWithTrafficPattern(plannedRoute, patternPreview)
        : [],
    [
      patternPreview,
      navigation.startedAt,
      navigation.route,
      navigation.activeLeg,
      patternPosition,
      plannedRoute,
    ],
  );
  const previewPath = useMemo(
    () => flyByRoute(previewRoute, turnPerformance),
    [previewRoute, turnPerformance],
  );
  const entryIndex = previewRoute.findIndex(
    (point) => point.patternId === patternPreview?.id,
  );
  const previewStart = previewPath.legs.findIndex(
    (leg) => leg >= Math.max(0, entryIndex - 1),
  );
  const lastPreviewPattern = previewRoute
    .map((point) => point.patternId)
    .lastIndexOf(patternPreview?.id);
  const previewExit =
    patternPreview?.operation === "leave"
      ? previewPath.legs.findIndex((leg) => leg > lastPreviewPattern)
      : -1;
  const turnIssues = patternPreview ? previewPath.issues : routePath.issues;
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
    sceneRef,
    ready,
    aircraft: traffic.data?.aircraft,
    trafficEnabled: layers.traffic,
    fix,
    following: settings.following,
    trackUp: settings.trackUp,
    selectedHex,
    // The route source includes the curved DCT leg; a second straight chord would cut its arc.
    directRoute: null,
  });

  // Create the map once. deck.gl needs WebGL and `window`, so it is loaded in the browser only.
  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | undefined;
    void import("./deck").then(({ DeckMap, DeckScene, PICK_LAYERS }) => {
      const root = container.current;
      if (cancelled || !root) return;
      const map = new DeckMap(root, {
        bounds: POLAND,
        padding: 28,
        onLoad: () => {
          if (!cancelled) setReady(true);
        },
      });
      const scene = new DeckScene(map);
      mapRef.current = map;
      sceneRef.current = scene;
      markers.current = new MarkerLayer(map, root);
      map.on("dragstart", () => useMapSettings.getState().follow(false));
      let lastCursorUpdate = 0;
      map.on("mousemove", ({ lngLat }) => {
        if (Date.now() - lastCursorUpdate < 100) return;
        lastCursorUpdate = Date.now();
        setCursorPosition({ lat: lngLat.lat, lon: lngLat.lng });
      });
      let lastViewportUpdate = 0;
      map.on("moveend", () => {
        if (Date.now() - lastViewportUpdate < 1100) return;
        lastViewportUpdate = Date.now();
        const c = map.getCenter();
        const [, , east, north] = map.getBounds();
        // Centre-to-corner distance covers the whole view; the API allows 1–250 NM.
        const radius = distanceNm(
          { lat: c.lat, lon: c.lng },
          { lat: north, lon: east },
        );
        setView({
          lat: Math.round(c.lat * 10) / 10,
          lon: Math.round(c.lng * 10) / 10,
          radiusNm: Math.min(250, Math.max(1, Math.ceil(radius / 10) * 10)),
        });
      });
      map.on("click", ({ point, lngLat }) => {
        // Points are a few pixels wide: search a finger-sized radius. The nearest wins, but within
        // 2 px (a VOR on its airport) the symbol that is more useful to open takes it.
        const hit = map
          .pick(point, PICK_LAYERS)
          .map((info) => {
            const [lon, lat] = (info.object as { position: [number, number] })
              .position;
            const px = map.project([lon, lat]);
            const d = Math.hypot(px.x - point.x, px.y - point.y);
            return {
              info,
              band: Math.floor(d / 2),
              rank: PICK_LAYERS.indexOf(info.layer?.id ?? ""),
              d,
            };
          })
          .sort(
            (a, b) => a.band - b.band || a.rank - b.rank || a.d - b.d,
          )[0]?.info;
        const object = hit?.object as (PointDatum & TrafficDatum) | undefined;
        if (hit?.layer?.id === "traffic") {
          const aircraft = trafficByHex.current.get(object!.hex);
          if (aircraft) {
            setClick({ kind: "traffic", lngLat, hex: aircraft.hex });
            return;
          }
        } else if (object) {
          const [lon, lat] = object.position;
          setClick({
            kind: "point",
            lngLat,
            point: {
              ident: object.ident,
              name: object.name,
              kind: object.kind,
              lat,
              lon,
            },
          });
          return;
        }
        if (map.pick(point, ["route"], 6).length) {
          const segment = nearestRouteSegment(routeRef.current, {
            lat: lngLat.lat,
            lon: lngLat.lng,
          });
          if (segment) {
            setClick({ kind: "segment", lngLat });
            return;
          }
        }
        const activeZones = zonesRef.current.filter((zone) =>
          polygonContainsPoint(zone.geometry.coordinates, {
            lat: lngLat.lat,
            lon: lngLat.lng,
          }),
        );
        if (activeZones.length) {
          setClick({ kind: "airspace", lngLat });
          return;
        }
        setClick(null);
      });
      const camera = () => {
        root.dataset.centerLon = String(map.getCenter().lng);
        root.dataset.centerLat = String(map.getCenter().lat);
        root.dataset.zoom = String(map.getZoom());
      };
      camera();
      map.on("move", camera);
      teardown = () => {
        markers.current?.destroy();
        scene.destroy();
        map.destroy();
        markers.current = sceneRef.current = mapRef.current = null;
        setReady(false);
      };
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  const theme = themeOf(basemap);
  useEffect(() => {
    sceneRef.current?.set({ basemap, theme, visible: layers });
    markers.current?.setVisible(layers.route);
  }, [ready, basemap, theme, layers]);

  useEffect(() => {
    sceneRef.current?.set({
      zones: zones.map((zone) => zoneDatum(zone, theme)),
    });
  }, [ready, zones, theme]);

  useEffect(() => {
    if (airports.data)
      sceneRef.current?.set({
        airports: toPoints(
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
      });
  }, [ready, airports.data]);

  useEffect(() => {
    sceneRef.current?.set({
      vfr: toPoints(
        visibleNavpoints
          .filter((p) => p.kind === "vfr-reporting-point")
          .map((p) => ({ ...p, symbol: "reporting" })),
      ),
      ifr: toPoints(
        visibleNavpoints.filter(
          (p) => p.kind !== "vfr-reporting-point" && p.kind !== "navaid",
        ),
      ),
      navaids: toPoints(
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
    });
  }, [ready, visibleNavpoints]);

  useEffect(() => {
    const aircraft = layers.traffic ? (traffic.data?.aircraft ?? []) : [];
    trafficByHex.current = new Map(aircraft.map((a) => [a.hex, a]));
    sceneRef.current?.set({
      trafficTrail: layers.traffic
        ? coordinatePaths(trafficTrailSegments(selectedHistory))
        : [],
      trafficGap: layers.traffic
        ? coordinatePaths(trafficTrailGaps(selectedHistory))
        : [],
    });
  }, [ready, layers.traffic, traffic.data, selectedHistory]);

  useEffect(() => {
    observe(traffic.data?.aircraft ?? []);
  }, [traffic.data, observe]);

  useEffect(() => {
    sceneRef.current?.set({
      gpsTrail:
        settings.gpsEnabled && settings.gpsTrack.length >= 2
          ? toPaths([settings.gpsTrack])
          : [],
    });
  }, [ready, settings.gpsTrack, settings.gpsEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !settings.command) return;
    if (settings.command === "zoomIn" || settings.command === "zoomOut")
      map.jumpTo({
        zoom:
          map.getZoom() + Math.log2(settings.command === "zoomIn" ? 1.3 : 0.77),
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

  // Text on the chart: shown by zoom stage, placed by deck.gl; airspace names need the view to be placed.
  useEffect(() => {
    const map = mapRef.current,
      scene = sceneRef.current;
    if (!ready || !map || !scene) return;
    const shown = layers.airspace ? zones : NO_ZONES;
    let stage = "";
    const refresh = (settled: boolean) => {
      const visibility = mapLabelVisibility(map.getZoom(), settings.labels);
      const key = JSON.stringify(visibility);
      if (key !== stage) {
        stage = key;
        const airportText = airportLabels(
          airports.data ?? [],
          settings.labels && layers.airports,
          visibility,
          theme,
        );
        scene.set({
          airportTitles: airportText.titles,
          airportDetails: airportText.details,
          pointNames: pointNameLabels(
            visibleNavpoints,
            layers,
            visibility,
            theme,
          ),
        });
      }
      const placed = captions.current.update(
        map,
        shown,
        visibility,
        theme,
        settled,
      );
      if (placed) scene.set(placed);
    };
    refresh(true);
    const moving = () => refresh(false),
      settled = () => refresh(true);
    map.on("move", moving);
    map.on("moveend", settled);
    return () => {
      map.off("move", moving);
      map.off("moveend", settled);
    };
  }, [
    ready,
    airports.data,
    visibleNavpoints,
    zones,
    layers,
    settings.labels,
    theme,
  ]);

  useEffect(() => {
    sceneRef.current?.set({ minutes: fix ? minuteLabels(fix, theme) : [] });
  }, [ready, fix, theme]);

  useEffect(() => {
    sceneRef.current?.set({
      patternPreview:
        previewRoute.length >= 2
          ? toPaths([
              previewPath.points.slice(
                Math.max(0, previewStart),
                previewExit >= 0 ? previewExit + 1 : undefined,
              ),
            ])
          : [],
    });
  }, [
    ready,
    previewRoute.length,
    previewPath.points,
    previewStart,
    previewExit,
  ]);

  // The route line, and its waypoints as DOM labels (keyboard- and screen-reader-reachable).
  useEffect(() => {
    sceneRef.current?.set({
      route: toPaths([
        routePath.points,
        ...(flight.destination && flight.alternate
          ? [[flight.destination, flight.alternate]]
          : []),
      ]),
      plannedRoute:
        route[0]?.ident === "DCT" && !navigation.trafficPattern
          ? toPaths([plannedPath])
          : [],
    });
    markers.current?.set(
      [
        ...route.filter((p) => !p.patternId),
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
            lngLat: { lng: p.lon, lat: p.lat },
            point: {
              ...p,
              name: p.ident,
              kind: airports.data?.some((a) => a.ident === p.ident)
                ? "airport"
                : "route",
            },
          });
        });
        return { element: el, lon: p.lon, lat: p.lat };
      }),
    );
  }, [
    ready,
    route,
    flight.destination,
    flight.alternate,
    airports.data,
    plannedPath,
    navpoints.data,
    routePath.points,
    navigation.trafficPattern,
  ]);

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
      map.animateTo(
        {
          longitude: point.lon,
          latitude: point.lat,
          zoom: Math.max(9, map.getZoom()),
        },
        700,
        true,
      );
    }
  }

  const selectionTime = selectedAircraft ? now : 0;
  useEffect(() => {
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
    sceneRef.current?.set({
      selectedZones:
        click?.kind === "airspace"
          ? inspectionZones.map((zone) => zoneDatum(zone, theme))
          : [],
      selectedPoints:
        click?.kind !== "airspace" && point ? [[point.lon, point.lat]] : [],
    });
  }, [ready, click, selectedAircraft, inspectionZones, selectionTime, theme]);

  return (
    <div
      className={cn(
        "legacy-map absolute inset-0",
        theme === "dark" && "legacy-map--dark",
      )}
      data-pattern-preview={patternPreview ? "true" : "false"}
    >
      {navigation.startedAt && <TrafficPatternPopup />}
      {layers.route && turnIssues.length > 0 && (
        <div
          role="status"
          data-testid="turn-constraint"
          className="bg-card text-card-foreground absolute bottom-12 left-3 z-10 max-w-sm rounded-lg border p-2 text-xs shadow"
        >
          {t("pattern.turnUnavailable", {
            speed: Math.round(turnPerformance.tasKt),
          })}{" "}
          {[
            ...new Set(
              turnIssues.map((issue) => {
                const point = (patternPreview ? previewRoute : route)[
                  issue.index
                ];
                return point?.patternId ? t("pattern.title") : point?.ident;
              }),
            ),
          ].join(", ")}
        </div>
      )}
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
        className="relative h-full w-full overflow-hidden"
        style={{ backgroundColor: palettes[theme].background }}
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
      <MapScale mapRef={mapRef} ready={ready} />
      {basemap !== "dark" && (
        <a
          className="legacy-map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      )}
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
                  if (pattern.operation === "leave")
                    update({ departurePattern: pattern, sid: null });
                  else
                    update({
                      trafficPattern: pattern,
                      destination: { ...pattern.airport },
                      star: null,
                      approach: null,
                    });
                  if (navigation.startedAt)
                    navigation.joinTrafficPattern(pattern, patternPosition);
                  settings.update({
                    layers: { ...settings.layers, route: true },
                  });
                  setPatternPreview(null);
                  setClick(null);
                }}
                removePattern={() => {
                  const leaving = click.point.ident === flight.departure?.ident;
                  update(
                    leaving
                      ? { departurePattern: null }
                      : { trafficPattern: null },
                  );
                  if (navigation.startedAt)
                    navigation.clearTrafficPattern(leaving ? "leave" : "join");
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
