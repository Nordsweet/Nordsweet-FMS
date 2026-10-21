"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { routeHistoryPaths } from "~/domain/route-history";
import { flyByRoute } from "~/domain/fly-by";
import { navigationRoute } from "~/domain/navigation-route";
import { ownRegistration } from "~/domain/traffic-identity";
import { useTurnPerformance } from "~/features/fly/use-turn-performance";
import { FlightNotifications } from "~/features/fly/flight-notifications";
import {
  NotificationBell,
  NotificationHistory,
} from "~/features/fly/notification-history";
import { HoldingStatus } from "~/features/fly/holding-status";
import { type Holding } from "~/data/holding";
import { holdingGeometry } from "~/domain/holding";
import {
  anchoredWaypoint,
  optimalWaypointIndex,
  sameFlightPoint,
} from "~/domain/waypoint-insertion";
import {
  pointKey,
  formatRoutePoint,
  speedRestrictionKt,
  buildRoutePlan,
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
import { GlideStatus } from "~/features/emergency/glide-status";
import { useEmergencyMap } from "~/features/emergency/use-emergency-map";
import { MapSummary } from "./map-summary";
import { PointDetails } from "./point-details";
import { TrafficCard } from "./traffic-card";
import { useMapAnimation } from "./use-map-animation";
import { planAirportFixes } from "~/domain/plan-airport-fixes";
import type { DeckMap, DeckScene } from "./deck";
import type { PointDatum, TrafficDatum } from "./deck/scene";
import { isDeparturePatternTarget } from "~/domain/departure-pattern";
import { mapProfilePoints } from "~/domain/map-profile";
import { withoutRoutePoints } from "~/domain/map-route-points";
import { AirspaceCaptions } from "./deck/captions";
import { coordinatePaths, toPaths, toPoints, zoneDatum } from "./deck/data";
import { airportLabels, minuteLabels, pointNameLabels } from "./deck/labels";
import { MarkerLayer } from "./deck/markers";
import { BRIGHT_BACKGROUND } from "./deck/bright";
import { FJORD_BACKGROUND } from "./deck/fjord";
import { DARK_MATTER_BACKGROUND } from "./deck/dark-matter";
import { palettes, themeOf } from "./deck/theme";
import { mapLabelVisibility } from "~/domain/map-labels";
import { MapScale } from "./map-scale";
import { WindTile } from "./wind-tile";
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
  const profileMarkers = useRef<MarkerLayer | null>(null);
  const captions = useRef(new AirspaceCaptions());
  const [ready, setReady] = useState(false);
  const [notificationHistoryOpen, setNotificationHistoryOpen] = useState(false);
  const [localClick, setLocalClick] = useState<Click | null>(null);
  const pointRequest = useMapSettings((s) => s.pointRequest);
  const click = useMemo<Click | null>(
    () =>
      pointRequest
        ? pointRequest.centerOnly
          ? null
          : {
              kind: "point",
              point: pointRequest,
              lngLat: { lng: pointRequest.lon, lat: pointRequest.lat },
            }
        : localClick,
    [pointRequest, localClick],
  );
  const setClick = useCallback((value: Click | null) => {
    useMapSettings.getState().inspectPoint(null);
    setLocalClick(value);
  }, []);
  useEffect(() => {
    if (!ready || !pointRequest || !mapRef.current) return;
    mapRef.current.animateTo(
      {
        longitude: pointRequest.lon,
        latitude: pointRequest.lat,
        zoom: Math.max(9, mapRef.current.getZoom()),
      },
      700,
      true,
    );
  }, [ready, pointRequest]);
  const [holdingPreview, setHoldingPreview] = useState<Holding | null>(null);
  const [patternPreview, setPatternPreview] = useState<TrafficPattern | null>(
    null,
  );
  const [insertingPoint, setInsertingPoint] = useState<FlightPoint | null>(
    null,
  );
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const {
    route: plannedRoute,
    plan: routePlan,
    cruiseSpeedKt,
    aircraft: ownAircraft,
    routeInput,
    routeData,
  } = usePlan();
  const registration = ownRegistration(
    flight.registration,
    ownAircraft?.registration,
  );
  const identityQuery = useQuery({
    ...api.traffic.aircraftIdentity.queryOptions({ registration }),
    enabled: !!registration,
    retry: false,
  });
  const ownHex = identityQuery.data?.hex ?? null;
  const ownIdentity = useMemo(
    () => ({ registration, hex: ownHex }),
    [registration, ownHex],
  );
  const settings = useMapSettings();
  const navigation = useInFlight();
  const { fix, error: gpsError } = useGps(
    settings.gpsEnabled || navigation.startedAt !== null,
  );
  const route = navigation.startedAt ? navigation.route : plannedRoute;
  const holding = navigation.startedAt
    ? (navigation.holding?.config ?? null)
    : flight.holding;
  const holdingEntry = navigation.startedAt
    ? navigation.holding?.entry
    : undefined;
  useEffect(() => {
    const geometry = holding ? holdingGeometry(holding, holdingEntry) : null;
    const preview = holdingPreview ? holdingGeometry(holdingPreview) : null;
    sceneRef.current?.set({
      holding: geometry
        ? toPaths([geometry.racetrack, geometry.entryPath])
        : [],
      holdingPreview: preview
        ? toPaths([preview.racetrack, preview.entryPath])
        : [],
    });
  }, [ready, holding, holdingEntry, holdingPreview]);
  const patternPosition = fix ?? navigation.track.at(-1) ?? null;
  useEffect(() => {
    mapRef.current?.setFollowing(settings.following);
  }, [ready, settings.following]);
  const turns = useTurnPerformance(navigation.startedAt ? fix : null);
  // The hook returns a new object each render; the geometry only depends on these numbers.
  const { tasKt, windDirectionDeg, windSpeedKt, departureTasKt } = turns;
  const turnPerformance = useMemo(
    () => ({ tasKt, windDirectionDeg, windSpeedKt, departureTasKt }),
    [tasKt, windDirectionDeg, windSpeedKt, departureTasKt],
  );
  const routePath = useMemo(
    () =>
      flyByRoute(
        route.map((point) =>
          holding && sameFlightPoint(point, holding.fix)
            ? { ...point, flyOver: true }
            : point,
        ),
        turnPerformance,
      ),
    [route, turnPerformance, holding],
  );
  const plannedPath = useMemo(
    () =>
      flyByRoute(
        plannedRoute.map((point) =>
          flight.holding && sameFlightPoint(point, flight.holding.fix)
            ? { ...point, flyOver: true }
            : point,
        ),
        turnPerformance,
      ).points,
    [plannedRoute, turnPerformance, flight.holding],
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
          : routeData && routeInput
            ? (() => {
                const preview = buildRoutePlan(routeData, {
                  ...routeInput,
                  ...(patternPreview.operation === "leave"
                    ? { departurePattern: patternPreview }
                    : { trafficPattern: patternPreview }),
                });
                return preview
                  ? navigationRoute(preview)
                  : routeWithTrafficPattern(plannedRoute, patternPreview);
              })()
            : routeWithTrafficPattern(plannedRoute, patternPreview)
        : [],
    [
      patternPreview,
      navigation.startedAt,
      navigation.route,
      navigation.activeLeg,
      patternPosition,
      plannedRoute,
      routeInput,
      routeData,
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
  const [terrainError, setTerrainError] = useState(false);
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
  const emergencyMap = useEmergencyMap(airports.data ?? [], fix, gpsError, now);
  useEffect(() => {
    sceneRef.current?.set({
      emergencyRoute: emergencyMap.preview ? [] : toPaths([emergencyMap.path]),
      emergencyPreview: emergencyMap.preview
        ? toPaths([emergencyMap.path])
        : [],
      emergencyRange: emergencyMap.footprint.map((polygon) => ({ polygon })),
      emergencyBoundary: emergencyMap.boundary.map((path) => ({ path })),
      emergencyAirports: emergencyMap.reachable.map((a) => [a.lon, a.lat]),
    });
  }, [
    ready,
    emergencyMap.path,
    emergencyMap.preview,
    emergencyMap.footprint,
    emergencyMap.boundary,
    emergencyMap.reachable,
  ]);
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
  const markedRoute = useMemo(
    () => [...route, ...(flight.alternate ? [flight.alternate] : [])],
    [route, flight.alternate],
  );
  const chartNavpoints = useMemo(
    () => withoutRoutePoints(visibleNavpoints, markedRoute, layers.route),
    [visibleNavpoints, markedRoute, layers.route],
  );
  const chartAirports = useMemo(
    () => withoutRoutePoints(airports.data ?? [], markedRoute, layers.route),
    [airports.data, markedRoute, layers.route],
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
    ...api.traffic.around.queryOptions({
      ...view,
      sources: settings.trafficSources,
    }),
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
    ownIdentity,
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
      const scene = new DeckScene(map, () => setTerrainError(true));
      mapRef.current = map;
      sceneRef.current = scene;
      const syncZoom = () => {
        // A quarter-step change rebuilds every layer: wait until the pinch/inertia is over.
        if (map.interacting) return;
        const zoom = Math.round(map.getZoom() * 4) / 4;
        if (zoom !== scene.state.zoom) scene.set({ zoom });
      };
      syncZoom();
      map.on("move", syncZoom);
      map.on("moveend", syncZoom);
      markers.current = new MarkerLayer(map, root);
      profileMarkers.current = new MarkerLayer(map, root);
      map.on("dragstart", () => useMapSettings.getState().follow(false));
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
              rank: PICK_LAYERS.indexOf(
                info.layer?.id.replace(/-terrain$/, "") ?? "",
              ),
              d,
            };
          })
          .sort(
            (a, b) => a.band - b.band || a.rank - b.rank || a.d - b.d,
          )[0]?.info;
        const object = hit?.object as (PointDatum & TrafficDatum) | undefined;
        if (hit?.layer?.id.replace(/-terrain$/, "") === "traffic") {
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
        root.dataset.centerElevationM = String(map.getCenter().elevationM);
        root.dataset.zoom = String(map.getZoom());
      };
      camera();
      map.on("move", camera);
      teardown = () => {
        markers.current?.destroy();
        profileMarkers.current?.destroy();
        profileMarkers.current = null;
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
  }, [setClick]);

  const theme = themeOf(basemap);
  useEffect(() => {
    sceneRef.current?.set({
      basemap,
      theme,
      visible: layers,
      terrain3d: settings.terrain3d,
    });
    mapRef.current?.setTerrain(settings.terrain3d);
    markers.current?.setVisible(layers.route);
    profileMarkers.current?.setVisible(layers.route);
  }, [ready, basemap, theme, layers, settings.terrain3d]);

  useEffect(() => {
    sceneRef.current?.set({
      zones: zones.map((zone) => zoneDatum(zone, theme)),
    });
  }, [ready, zones, theme]);

  useEffect(() => {
    sceneRef.current?.set({
      airports: toPoints(
        chartAirports.map((a) => ({
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
  }, [ready, chartAirports]);

  useEffect(() => {
    sceneRef.current?.set({
      vfr: toPoints(
        chartNavpoints
          .filter((p) => p.kind === "vfr-reporting-point")
          .map((p) => ({ ...p, symbol: "reporting" })),
      ),
      ifr: toPoints(
        chartNavpoints.filter(
          (p) => p.kind !== "vfr-reporting-point" && p.kind !== "navaid",
        ),
      ),
      navaids: toPoints(
        chartNavpoints
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
  }, [ready, chartNavpoints]);

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

  const ownTrack = navigation.startedAt ? navigation.track : settings.gpsTrack;
  const showOwnTrack = navigation.startedAt !== null || settings.gpsEnabled;
  useEffect(() => {
    sceneRef.current?.set({
      gpsTrail: showOwnTrack && ownTrack.length >= 2 ? toPaths([ownTrack]) : [],
    });
  }, [ready, ownTrack, showOwnTrack]);

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
          chartAirports,
          settings.labels && layers.airports,
          visibility,
          theme,
        );
        scene.set({
          airportTitles: airportText.titles,
          airportDetails: airportText.details,
          pointNames: pointNameLabels(
            chartNavpoints,
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
    chartAirports,
    chartNavpoints,
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
      routeHistory: toPaths(
        navigation.startedAt
          ? routeHistoryPaths(navigation.routeHistory, route)
          : [],
      ),
      route: toPaths([
        routePath.points,
        ...(flight.destination && flight.alternate
          ? [[flight.destination, flight.alternate]]
          : []),
      ]),
      plannedRoute:
        route[0]?.ident === "DCT" &&
        !navigation.trafficPattern &&
        !navigation.routeHistory
          ? toPaths([plannedPath])
          : [],
    });
  }, [
    ready,
    route,
    routePath.points,
    navigation.startedAt,
    navigation.routeHistory,
    flight.destination,
    flight.alternate,
    plannedPath,
    navigation.trafficPattern,
  ]);

  // Camera/speed updates redraw geometry without replacing a button during a click/tap.
  useEffect(() => {
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
        const hitTarget = document.createElement("span");
        hitTarget.className = "legacy-route-hit-target";
        hitTarget.setAttribute("aria-hidden", "true");
        el.append(hitTarget);
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
  }, [ready, route, flight.alternate, airports.data, navpoints.data, setClick]);

  useEffect(() => {
    profileMarkers.current?.set(
      mapProfilePoints(
        routePlan?.points ?? [],
        navigation.startedAt ? route : undefined,
        routePath.points,
      ).map((point) => {
        const element = document.createElement("div");
        element.className = "legacy-route-marker";
        element.dataset.profileMarker = point.id;
        const label = document.createElement("span");
        label.className = "legacy-route-label";
        label.textContent = point.id;
        label.style.position = "relative";
        label.style.top = point.id === "TOC" ? "-12px" : "12px";
        element.append(label);
        element.title = t(
          point.id === "TOC" ? "maptools.topOfClimb" : "maptools.topOfDescent",
        );
        element.setAttribute("aria-label", element.title);
        return { element, lat: point.lat, lon: point.lon, interactive: false };
      }),
    );
  }, [ready, routePlan, navigation.startedAt, route, routePath, t]);

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
          sources: settings.trafficSources,
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
      data-route-history-paths={
        navigation.startedAt
          ? routeHistoryPaths(navigation.routeHistory, route).length
          : 0
      }
      data-route-history-last-fix={navigation.routeHistory?.lastPassed.ident}
      data-pattern-preview={patternPreview ? "true" : "false"}
      data-holding-preview={holdingPreview ? "true" : "false"}
      data-terrain-3d={settings.terrain3d ? "true" : "false"}
      data-glide-cells={emergencyMap.footprint.length}
    >
      {navigation.startedAt && !emergencyMap.active && (
        <FlightNotifications
          plan={routePlan}
          cruiseAltitudeFt={flight.cruiseAltitudeFt}
          fix={fix}
          turns={turnPerformance}
          aircraft={layers.traffic ? traffic.data?.aircraft : undefined}
          identity={ownIdentity}
        />
      )}
      {navigation.startedAt && !emergencyMap.active && <HoldingStatus />}
      {emergencyMap.active && (
        <div
          role="status"
          data-testid="emergency-map-status"
          className="bg-card/95 text-card-foreground absolute bottom-56 left-3 z-10 max-w-[calc(100%-6rem)] rounded-lg border border-red-500 p-2 text-xs shadow sm:bottom-44 sm:max-w-xs"
        >
          <strong>
            EMER ·{" "}
            {emergencyMap.target
              ? `${emergencyMap.target.airport} RW${emergencyMap.target.runway}`
              : t("emer.noRoute")}
          </strong>
          <p>{emergencyMap.preview ? t("emer.preview") : t("emer.final")}</p>
          <GlideStatus />
          {emergencyMap.glide.reach && emergencyMap.reachable.length === 0 && (
            <p>{t("emer.noReachable")}</p>
          )}
        </div>
      )}
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
            if (navigation.startedAt)
              navigation.insertWaypoint(index, point, gpsError ? null : fix);
            setInsertingPoint(null);
          }}
        />
      )}
      {fix && !gpsError && !settings.following && (
        <Button
          className="bg-card/95 absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full text-white shadow-lg backdrop-blur"
          variant="outline"
          data-testid="map-recenter"
          onClick={() => settings.follow(true)}
        >
          {t("maptools.center")}
        </Button>
      )}
      {!embedded && (
        <Button
          aria-label={t("mapsearch.title")}
          title={t("mapsearch.title")}
          aria-expanded={settings.searchOpen}
          className="legacy-flight-tool bg-card/90 absolute top-3 left-3 z-30 backdrop-blur"
          variant="outline"
          disabled={!ready}
          onClick={() => {
            setNotificationHistoryOpen(false);
            settings.setSearchOpen(!settings.searchOpen);
          }}
        >
          <SearchIcon className="size-6 text-white" />
        </Button>
      )}
      {!embedded && (
        <NotificationBell
          open={notificationHistoryOpen}
          className="absolute top-20 left-3 z-30"
          onClick={() => {
            settings.setSearchOpen(false);
            setNotificationHistoryOpen(!notificationHistoryOpen);
          }}
        />
      )}
      {!embedded && notificationHistoryOpen && (
        <section
          role="dialog"
          aria-label={t("fly.history.title")}
          className="bg-card/95 text-card-foreground absolute top-36 right-20 left-3 z-40 grid max-h-[calc(100%-10rem)] gap-3 overflow-y-auto rounded-2xl border p-4 shadow-lg backdrop-blur sm:right-auto sm:w-96"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{t("fly.history.title")}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNotificationHistoryOpen(false)}
            >
              {t("map.close")}
            </Button>
          </div>
          <NotificationHistory />
        </section>
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
        style={{
          backgroundColor:
            basemap === "bright"
              ? BRIGHT_BACKGROUND
              : basemap === "fjord"
                ? FJORD_BACKGROUND
                : basemap === "dark-matter"
                  ? DARK_MATTER_BACKGROUND
                  : palettes[theme].background,
        }}
        data-testid="map"
        data-map-ready={ready}
        data-track-points={showOwnTrack ? ownTrack.length : 0}
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
      {(settings.terrain3d || emergencyMap.glide.reach) && (
        <a
          className="bg-card/90 text-muted-foreground absolute right-20 bottom-8 z-10 max-w-[65%] rounded px-1 text-right text-[10px]"
          href="/terrain-attribution.html"
          target="_blank"
          rel="noreferrer"
        >
          {t("terrain.source")}
        </a>
      )}
      {(basemap !== "dark" || settings.terrain3d) && (
        <div className="legacy-map-attribution">
          {basemap === "bright" && (
            <>
              <a
                href="/bright-attribution.html"
                target="_blank"
                rel="noreferrer"
              >
                OSM OpenMapTiles
              </a>
              {" · "}
            </>
          )}
          {basemap === "dark-matter" && (
            <>
              <a
                href="/dark-matter-attribution.html"
                target="_blank"
                rel="noreferrer"
              >
                Dark Matter
              </a>
              {" · "}
            </>
          )}
          {(basemap === "bright" ||
            basemap === "fjord" ||
            basemap === "dark-matter") && (
            <>
              <a
                href="https://openmaptiles.org/"
                target="_blank"
                rel="noreferrer"
              >
                © OpenMapTiles
              </a>
              {" · "}
              <a
                href="https://openfreemap.org/"
                target="_blank"
                rel="noreferrer"
              >
                OpenFreeMap
              </a>
              {" · "}
            </>
          )}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors
          </a>
        </div>
      )}
      {settings.terrain3d && terrainError && (
        <div
          role="status"
          className="bg-card/90 absolute bottom-20 left-3 z-10 max-w-xs rounded border p-2 text-xs"
        >
          {t("terrain.error3d")}
        </div>
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
      <WindTile mapRef={mapRef} ready={ready} />
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
            draggable={click.kind === "traffic" || click.kind === "point"}
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
                previewHolding={setHoldingPreview}
                acceptHolding={(holding) => {
                  const plannedIndex = plannedRoute.findIndex(
                    (p, i) => i > 0 && sameFlightPoint(p, holding.fix),
                  );
                  const waypoint = anchoredWaypoint(
                    plannedRoute,
                    holding.fix,
                    optimalWaypointIndex(plannedRoute, holding.fix),
                  );
                  update({
                    holding,
                    ...(plannedIndex < 0
                      ? { waypoints: [...flight.waypoints, waypoint] }
                      : {}),
                  });
                  if (navigation.startedAt) {
                    if (
                      !navigation.route.some(
                        (p, i) =>
                          i > navigation.activeLeg &&
                          sameFlightPoint(p, holding.fix),
                      )
                    ) {
                      const suffix = navigation.route.slice(
                        navigation.activeLeg,
                      );
                      const index =
                        navigation.activeLeg +
                        Math.max(1, optimalWaypointIndex(suffix, holding.fix));
                      navigation.insertWaypoint(index, holding.fix);
                    }
                    navigation.setHolding(holding);
                  }
                  settings.update({
                    layers: { ...settings.layers, route: true },
                  });
                  setHoldingPreview(null);
                  setClick(null);
                }}
                removeHolding={() => {
                  update({ holding: null });
                  navigation.exitHolding(
                    !gpsError &&
                      fix &&
                      Date.now() - Date.parse(fix.time) <= 20000
                      ? fix
                      : null,
                  );
                  setHoldingPreview(null);
                  setClick(null);
                }}
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
                  const leaving = isDeparturePatternTarget(
                    flight,
                    navigation,
                    click.point.ident,
                  );
                  update(
                    leaving
                      ? { departurePattern: null }
                      : {
                          trafficPattern: null,
                          arrivalToArp: true,
                          star: null,
                          approach: null,
                        },
                  );
                  if (navigation.startedAt)
                    navigation.clearTrafficPattern(
                      leaving ? "leave" : "join",
                      patternPosition,
                    );
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
