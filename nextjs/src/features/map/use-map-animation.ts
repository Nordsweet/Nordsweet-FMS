import { useEffect, type RefObject } from "react";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { destinationPoint } from "~/domain/geo";
import { mapLabelVisibility } from "~/domain/map-labels";
import { projectedPosition } from "~/domain/map-navigation";
import { trafficAdvisory } from "~/domain/traffic-advisory";
import { type GpsFix } from "~/features/fly/use-gps";
import type { AircraftIdentity } from "~/domain/traffic-identity";
import type { DeckMap, DeckScene, Scene } from "./deck";
import { trafficLabels } from "./deck/labels";
import { toPaths } from "./deck/data";
import type { Path, TextDatum, TrafficDatum } from "./deck/scene";

/** Animate the map at the legacy 24 FPS without recomputing the React planner each frame. */
export function useMapAnimation({
  mapRef,
  sceneRef,
  ready,
  aircraft,
  trafficEnabled,
  fix,
  following,
  trackUp,
  selectedHex,
  directRoute,
  ownIdentity,
}: {
  mapRef: RefObject<DeckMap | null>;
  sceneRef: RefObject<DeckScene | null>;
  ready: boolean;
  aircraft: TrafficAircraft[] | undefined;
  trafficEnabled: boolean;
  fix: GpsFix | null;
  following: boolean;
  trackUp: boolean;
  selectedHex: string;
  directRoute: { lat: number; lon: number }[] | null;
  ownIdentity: AircraftIdentity;
}) {
  useEffect(() => {
    const map = mapRef.current,
      scene = sceneRef.current;
    if (!ready || !map || !scene) return;
    let request = 0,
      lastFrame = 0,
      lastTraffic = -Infinity,
      lastCamera = "";
    // Identical data is skipped: every update re-uploads to the GPU and redraws the whole map.
    const sent = new Map<string, string>();
    let patch: Partial<Scene> = {};
    const put = <K extends keyof Scene>(key: K, value: Scene[K]) => {
      const json = JSON.stringify(value);
      if (sent.get(key) === json) return;
      sent.set(key, json);
      patch[key] = value;
    };
    const draw = (frame: number) => {
      if (frame - lastFrame < 1000 / 24) {
        request = requestAnimationFrame(draw);
        return;
      }
      lastFrame = frame;
      const now = Date.now();
      const own = fix
        ? projectedPosition(
            fix,
            fix.time,
            fix.paused ? 0 : fix.groundSpeedKt,
            fix.trackDeg,
            now,
          )
        : null;
      // Traffic moves well under a pixel per 24 FPS frame; 8 Hz keeps it smooth at a third of the cost.
      const trafficDue = frame - lastTraffic >= 1000 / 8;
      if (trafficDue) lastTraffic = frame;
      if (trafficDue) {
        const traffic: TrafficDatum[] = [],
          callsigns: TextDatum[] = [],
          details: TextDatum[] = [],
          estimates: Path[] = [];
        // Callsign and flight data appear from the point-name zoom.
        const trafficNames = mapLabelVisibility(
          map.getZoom(),
          true,
        ).trafficNames;
        if (trafficEnabled)
          for (const a of aircraft ?? []) {
            const position = projectedPosition(
              a,
              a.position_time,
              a.ground_speed_kt,
              a.track_deg,
              now,
            );
            if (!position) continue;
            const at: [number, number] = [position.lon, position.lat];
            estimates.push({ path: [[a.lon, a.lat], at] });
            const alert = trafficAdvisory(fix, a, now, ownIdentity);
            traffic.push({
              position: at,
              hex: a.hex,
              icon: "aircraft",
              advisory: alert?.level,
              alpha: position.alpha,
              track: a.track_deg ?? 0,
            });
            if (trafficNames) {
              const label = trafficLabels(
                a,
                at,
                position.alpha,
                scene.state.theme,
              );
              callsigns.push(label.callsign);
              details.push(label.details);
            }
          }
        put("traffic", traffic);
        put("trafficEstimate", estimates);
        put("trafficCallsigns", callsigns);
        put("trafficDetails", details);
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
        put("trafficVector", toPaths(target && end ? [[target, end]] : []));
      }
      const position = own;
      put(
        "ownship",
        position
          ? [
              {
                position: [position.lon, position.lat],
                alpha: position.alpha,
                track: fix?.trackDeg ?? 0,
              },
            ]
          : [],
      );
      const accuracy =
        position && fix && Number.isFinite(fix.accuracyM) && fix.accuracyM > 0
          ? Array.from({ length: 73 }, (_, i): [number, number] => {
              const edge = destinationPoint(
                position,
                i * 5,
                fix.accuracyM / 1852,
              );
              return [edge.lon, edge.lat];
            })
          : [];
      put("gpsAccuracy", accuracy.length ? [{ polygon: accuracy }] : []);
      put(
        "directTo",
        toPaths(
          position && directRoute?.[1] ? [[position, directRoute[1]]] : [],
        ),
      );
      const gpsEnd =
        position && fix?.trackDeg != null
          ? destinationPoint(
              position,
              fix.trackDeg,
              ((fix.groundSpeedKt ?? 0) * 5) / 60,
            )
          : null;
      put("gpsVector", toPaths(position && gpsEnd ? [[position, gpsEnd]] : []));
      // One-minute ticks are 10 px across the track, whatever the zoom or rotation.
      const ticks: Path[] = [];
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
          const a = map.unproject({ x: pixel.x - dx, y: pixel.y - dy }),
            b = map.unproject({ x: pixel.x + dx, y: pixel.y + dy });
          ticks.push({
            path: [
              [a.lng, a.lat],
              [b.lng, b.lat],
            ],
          });
        }
      }
      put("gpsTicks", ticks);
      const bearing = trackUp ? (fix?.trackDeg ?? map.getBearing()) : 0,
        size = map.getSize(),
        camera = `${position?.lon},${position?.lat},${bearing},${size.width}x${size.height}`;
      // Only move the camera when the target changed: every move redraws the whole map.
      if (position && following && camera !== lastCamera) {
        lastCamera = camera;
        // Own-ship rides in the lower half so the way ahead stays on screen.
        map.follow([position.lon, position.lat], bearing, [0.5, 0.75]);
      }
      if (Object.keys(patch).length) {
        scene.set(patch);
        patch = {};
      }
      if (position || (trafficEnabled && aircraft?.length))
        request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, [
    mapRef,
    sceneRef,
    ready,
    aircraft,
    trafficEnabled,
    fix,
    following,
    trackUp,
    selectedHex,
    directRoute,
    ownIdentity,
  ]);
}
