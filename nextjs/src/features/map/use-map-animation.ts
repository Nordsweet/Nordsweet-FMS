import { useEffect, type RefObject } from "react";
import { type Map, type Marker, type GeoJSONSource } from "maplibre-gl";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { destinationPoint } from "~/domain/geo";
import { projectedPosition, trafficAlertLevel } from "~/domain/map-navigation";
import { type GpsFix } from "~/features/fly/use-gps";

/** Animate the map adapter at the legacy 24 FPS without recomputing the React planner each frame. */
export function useMapAnimation({
  mapRef,
  ready,
  aircraft,
  trafficEnabled,
  fix,
  following,
  trackUp,
  labels,
  selectedHex,
  directRoute,
}: {
  mapRef: RefObject<Map | null>;
  ready: boolean;
  aircraft: TrafficAircraft[] | undefined;
  trafficEnabled: boolean;
  fix: GpsFix | null;
  following: boolean;
  trackUp: boolean;
  labels: RefObject<globalThis.Map<string, Marker>>;
  selectedHex: string;
  directRoute: { lat: number; lon: number }[] | null;
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let request = 0,
      lastFrame = 0;
    const draw = (frame: number) => {
      if (frame - lastFrame < 1000 / 24) {
        request = requestAnimationFrame(draw);
        return;
      }
      lastFrame = frame;
      const now = Date.now();
      const own = fix
        ? projectedPosition(fix, fix.time, fix.groundSpeedKt, fix.trackDeg, now)
        : null;
      const estimates: number[][][] = [];
      const traffic = trafficEnabled
        ? (aircraft ?? []).flatMap((a) => {
            const position = projectedPosition(
              a,
              a.position_time,
              a.ground_speed_kt,
              a.track_deg,
              now,
            );
            if (!position) return [];
            labels.current.get(a.hex)?.setLngLat([position.lon, position.lat]);
            estimates.push([
              [a.lon, a.lat],
              [position.lon, position.lat],
            ]);
            return [
              {
                type: "Feature" as const,
                geometry: {
                  type: "Point" as const,
                  coordinates: [position.lon, position.lat],
                },
                properties: {
                  alert: trafficAlertLevel(
                    own && fix
                      ? {
                          ...own,
                          altitudeFt: fix.altitudeFt,
                          speedKt: fix.groundSpeedKt,
                          trackDeg: fix.trackDeg,
                        }
                      : null,
                    {
                      ...position,
                      altitudeFt: a.altitude_ft,
                      speedKt: a.ground_speed_kt,
                      trackDeg: a.track_deg,
                    },
                  ),
                  hex: a.hex,
                  onGround: a.on_ground,
                  alpha: position.alpha,
                  track: a.track_deg ?? 0,
                  flarm: a.sources.some((source) => /flarm|ogn/i.test(source)),
                },
              },
            ];
          })
        : [];
      void map
        .getSource<GeoJSONSource>("traffic")
        ?.setData({ type: "FeatureCollection", features: traffic });
      void map.getSource<GeoJSONSource>("traffic-estimate")?.setData({
        type: "FeatureCollection",
        features: estimates.length
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "MultiLineString", coordinates: estimates },
              },
            ]
          : [],
      });
      const selected = trafficEnabled
        ? aircraft?.find((a) => a.hex === selectedHex)
        : null;
      const target = selected
        ? projectedPosition(
            selected,
            selected.position_time,
            selected.ground_speed_kt,
            selected.track_deg,
            now,
          )
        : null;
      const end =
        target && selected?.track_deg != null
          ? destinationPoint(
              target,
              selected.track_deg,
              ((selected.ground_speed_kt ?? 0) * 2) / 60,
            )
          : null;
      void map.getSource<GeoJSONSource>("traffic-vector")?.setData({
        type: "FeatureCollection",
        features:
          target && end
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      [target.lon, target.lat],
                      [end.lon, end.lat],
                    ],
                  },
                },
              ]
            : [],
      });
      const position = fix
        ? projectedPosition(fix, fix.time, fix.groundSpeedKt, fix.trackDeg, now)
        : null;
      void map.getSource<GeoJSONSource>("ownship")?.setData({
        type: "FeatureCollection",
        features: position
          ? [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [position.lon, position.lat],
                },
                properties: {
                  alpha: position.alpha,
                  track: fix?.trackDeg ?? 0,
                },
              },
            ]
          : [],
      });
      const accuracy =
        position && fix && Number.isFinite(fix.accuracyM) && fix.accuracyM > 0
          ? Array.from({ length: 73 }, (_, i) => {
              const edge = destinationPoint(
                position,
                i * 5,
                fix.accuracyM / 1852,
              );
              return [edge.lon, edge.lat];
            })
          : [];
      void map.getSource<GeoJSONSource>("gps-accuracy")?.setData({
        type: "FeatureCollection",
        features: accuracy.length
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Polygon", coordinates: [accuracy] },
              },
            ]
          : [],
      });
      void map.getSource<GeoJSONSource>("direct-to")?.setData({
        type: "FeatureCollection",
        features:
          position && directRoute?.[1]
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      [position.lon, position.lat],
                      [directRoute[1].lon, directRoute[1].lat],
                    ],
                  },
                },
              ]
            : [],
      });
      const gpsEnd =
        position && fix?.trackDeg != null
          ? destinationPoint(
              position,
              fix.trackDeg,
              ((fix.groundSpeedKt ?? 0) * 5) / 60,
            )
          : null;
      void map.getSource<GeoJSONSource>("gps-vector")?.setData({
        type: "FeatureCollection",
        features:
          position && gpsEnd
            ? [
                {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      [position.lon, position.lat],
                      [gpsEnd.lon, gpsEnd.lat],
                    ],
                  },
                },
              ]
            : [],
      });
      const ticks: number[][][] = [];
      if (
        position &&
        fix &&
        fix.trackDeg !== null &&
        (fix.groundSpeedKt ?? 0) >= 1
      ) {
        for (let minute = 1; minute <= 5; minute++) {
          const point = destinationPoint(
            position,
            fix.trackDeg,
            (fix.groundSpeedKt! * minute) / 60,
          );
          const pixel = map.project([point.lon, point.lat]);
          const angle = ((fix.trackDeg - map.getBearing()) * Math.PI) / 180;
          const dx = Math.cos(angle) * 5,
            dy = Math.sin(angle) * 5;
          const a = map.unproject([pixel.x - dx, pixel.y - dy]),
            b = map.unproject([pixel.x + dx, pixel.y + dy]);
          ticks.push([
            [a.lng, a.lat],
            [b.lng, b.lat],
          ]);
        }
      }
      void map.getSource<GeoJSONSource>("gps-ticks")?.setData({
        type: "FeatureCollection",
        features: ticks.length
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "MultiLineString", coordinates: ticks },
              },
            ]
          : [],
      });
      if (position && following)
        map.jumpTo({
          center: [position.lon, position.lat],
          bearing: trackUp ? (fix?.trackDeg ?? map.getBearing()) : 0,
          padding: {
            top: map.getCanvas().clientHeight * 0.5,
            bottom: 0,
            left: 0,
            right: 0,
          },
        });
      if (position || traffic.length) request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, [
    mapRef,
    ready,
    aircraft,
    trafficEnabled,
    fix,
    following,
    trackUp,
    labels,
    selectedHex,
    directRoute,
  ]);
}
