import { useEffect, useRef, type RefObject } from "react";
import { type Map } from "maplibre-gl";
import { type Airport, type Navpoint } from "~/data/schemas";
import {
  type AirspaceFeature,
  type TrafficAircraft,
} from "~/api/aviation/schemas";
import { type GpsFix } from "~/features/fly/use-gps";
import { type LayerId } from "~/stores/map";
import { airspaceKind, projectedPosition } from "~/domain/map-navigation";
import { trafficCallsign } from "~/domain/traffic-history";
import { destinationPoint } from "~/domain/geo";
import { airspacePalette } from "./symbols";
import { airportChartLabel, mapLabelVisibility } from "~/domain/map-labels";

type Labels = {
  airports: Airport[];
  points: Navpoint[];
  zones: AirspaceFeature[];
  aircraft: TrafficAircraft[];
  layers: Record<LayerId, boolean>;
  enabled: boolean;
  fix: GpsFix | null;
};

/** Canvas preserves the original fonts without thousands of DOM markers or a remote glyph server. */
export function useChartLabels(
  mapRef: RefObject<Map | null>,
  ready: boolean,
  data: Labels,
) {
  const current = useRef(data);
  useEffect(() => {
    current.current = data;
  });
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const surfaces = ["static", "moving"].map((kind) => {
      const canvas = document.createElement("canvas");
      canvas.dataset.chartLabels = kind;
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      map.getCanvasContainer().append(canvas);
      return { canvas, ctx: canvas.getContext("2d")! };
    });
    const stationary = surfaces[0]!,
      moving = surfaces[1]!;
    let lastFrame = 0,
      camera = "",
      cached: Labels | null = null;
    const draw = () => {
      const now = performance.now();
      if (now - lastFrame < 1000 / 24) return;
      lastFrame = now;
      const d = current.current,
        width = map.getContainer().clientWidth,
        height = map.getContainer().clientHeight;
      if (!width || !height) return;
      const visibility = mapLabelVisibility(
        map.getZoom(),
        d.enabled,
        map.getBounds().getEast() - map.getBounds().getWest(),
      );
      const ratio = window.devicePixelRatio || 1;
      let resized = false;
      for (const { canvas, ctx } of surfaces) {
        if (
          canvas.width !== Math.round(width * ratio) ||
          canvas.height !== Math.round(height * ratio)
        ) {
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round(height * ratio);
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          resized = true;
        }
      }
      const center = map.getCenter(),
        nextCamera = `${center.lng},${center.lat},${map.getZoom()},${map.getBearing()},${width},${height}`;
      const label = (
        ctx: CanvasRenderingContext2D,
        lat: number,
        lon: number,
        text: string,
        color: string,
        font: string,
        dx: number,
        dy: number,
        halo = false,
        centered = false,
      ) => {
        const point = map.project([lon, lat]);
        if (
          point.x < -250 ||
          point.x > width + 30 ||
          point.y < -30 ||
          point.y > height + 30
        )
          return;
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate((-map.getBearing() * Math.PI) / 180);
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textBaseline = centered ? "middle" : "alphabetic";
        ctx.textAlign = centered ? "center" : "left";
        if (halo) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,255,255,.92)";
          ctx.strokeText(text, dx, dy);
        }
        ctx.fillText(text, dx, dy);
        ctx.restore();
      };
      if (
        resized ||
        nextCamera !== camera ||
        cached?.airports !== d.airports ||
        cached.points !== d.points ||
        cached.zones !== d.zones ||
        cached.layers !== d.layers ||
        cached.enabled !== d.enabled
      ) {
        camera = nextCamera;
        cached = d;
        const ctx = stationary.ctx;
        ctx.clearRect(0, 0, width, height);
        if (d.enabled) {
          if (d.layers.airports)
            for (const p of d.airports) {
              const text = airportChartLabel(p, visibility);
              if (!text) continue;
              label(
                ctx,
                p.lat,
                p.lon,
                text.title,
                "#126cac",
                "700 10px system-ui,sans-serif",
                10,
                -4,
              );
              if (text.details) {
                label(
                  ctx,
                  p.lat,
                  p.lon,
                  text.details,
                  "#2479ae",
                  "600 8px system-ui,sans-serif",
                  10,
                  6,
                );
              }
            }
          if (visibility.pointNames)
            for (const p of d.points) {
              const layer =
                p.kind === "vfr-reporting-point"
                  ? "vfr"
                  : p.kind === "navaid"
                    ? "navaids"
                    : "ifr";
              if (!d.layers[layer]) continue;
              const color =
                layer === "ifr"
                  ? "#1f5794"
                  : layer === "vfr" || /VOR|DME|NDB/i.test(p.navaid?.type ?? "")
                    ? "#111827"
                    : "#6923a5";
              label(
                ctx,
                p.lat,
                p.lon,
                p.name || p.ident,
                color,
                "600 9px system-ui,sans-serif",
                6,
                -5,
              );
            }
          if (d.layers.airspace && visibility.airspaceNames)
            for (const z of d.zones) {
              const ring = z.geometry.coordinates[0];
              if (!ring?.length) continue;
              const lon = ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
                lat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
              const active = z.properties.active_now;
              const color = active
                ? "#b41532"
                : (airspacePalette[
                    airspaceKind(z.properties.name, z.properties.class)
                  ] ?? airspacePalette.OTHER)!.stroke;
              label(
                ctx,
                lat,
                lon,
                z.properties.name,
                color,
                active
                  ? "700 11px system-ui,sans-serif"
                  : "600 10px system-ui,sans-serif",
                3,
                -3,
              );
            }
        }
      }
      const ctx = moving.ctx;
      ctx.clearRect(0, 0, width, height);
      const time = Date.now();
      if (d.layers.traffic && visibility.trafficNames)
        for (const a of d.aircraft) {
          const p = projectedPosition(
            a,
            a.position_time,
            a.ground_speed_kt,
            a.track_deg,
            time,
          );
          if (!p) continue;
          ctx.globalAlpha = p.alpha;
          label(
            ctx,
            p.lat,
            p.lon,
            trafficCallsign(a.callsign) || (a.registration ?? a.hex),
            "#064f67",
            "700 10px system-ui,sans-serif",
            8,
            -7,
            true,
          );
          const track =
            a.track_deg == null
              ? "TRK --"
              : `${Math.round(a.track_deg).toString().padStart(3, "0")} deg`;
          const altitude =
              a.altitude_ft == null
                ? "ALT --"
                : `${Math.round(a.altitude_ft)} ft`,
            speed =
              a.ground_speed_kt == null
                ? "SPD --"
                : `${Math.round(a.ground_speed_kt)} kt`;
          label(
            ctx,
            p.lat,
            p.lon,
            `${track} / ${altitude} / ${speed}`,
            "#17633f",
            "700 9px system-ui,sans-serif",
            8,
            6,
            true,
          );
        }
      ctx.globalAlpha = 1;
      if (d.fix?.trackDeg != null && (d.fix.groundSpeedKt ?? 0) >= 1)
        for (let minute = 1; minute <= 5; minute++) {
          const p = destinationPoint(
            d.fix,
            d.fix.trackDeg,
            (d.fix.groundSpeedKt! * minute) / 60,
          );
          label(
            ctx,
            p.lat,
            p.lon,
            String(minute),
            "#244f86",
            "700 10px system-ui,sans-serif",
            Math.cos((d.fix.trackDeg * Math.PI) / 180) * 12,
            Math.sin((d.fix.trackDeg * Math.PI) / 180) * 12,
            true,
            true,
          );
        }
    };
    map.on("render", draw);
    draw();
    return () => {
      map.off("render", draw);
      surfaces.forEach(({ canvas }) => canvas.remove());
    };
  }, [mapRef, ready]);
}
