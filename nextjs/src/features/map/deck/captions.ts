import { type AirspaceFeature } from "~/api/aviation/schemas";
import {
  airspaceCaption,
  airspaceCaptionPlacement,
} from "~/domain/airspace-labels";
import { airspaceStyle } from "~/domain/airspace-style";
import { type mapLabelVisibility } from "~/domain/map-labels";
import { cssColor, type Rgba } from "./color";
import { lighten, palettes, type Theme } from "./theme";
import { type DeckMap } from "./deck-map";
import { type ParachuteDatum, type Scene, type TextDatum } from "./scene";

type Visibility = ReturnType<typeof mapLabelVisibility>;
type Pos = [number, number];
type Caption = {
  position: Pos;
  title: string;
  name: string | null;
  color: Rgba;
  active: boolean;
  parachuting: boolean;
};
type Bounds = [number, number, number, number];

/** How far beyond the screen (as a share of its size) captions are prepared, so panning rarely recomputes. */
const MARGIN = 0.5;
const measure = (() => {
  let ctx: CanvasRenderingContext2D | undefined;
  return (font: string, text: string) => {
    ctx ??= document.createElement("canvas").getContext("2d")!;
    ctx.font = font;
    return ctx.measureText(text).width;
  };
})();

const intersects = (a: Bounds, b: Bounds) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const contains = (outer: Bounds, inner: Bounds) =>
  outer[0] <= inner[0] &&
  outer[1] <= inner[1] &&
  outer[2] >= inner[2] &&
  outer[3] >= inner[3];

/**
 * Airspace names sit where the zone's outline leaves room for the text, which depends on the zoom
 * and rotation, so they are placed on the screen and then pinned to the map. Placements are cached
 * per zone and view; they are redone when the view settles at a new scale or leaves the prepared area.
 */
export class AirspaceCaptions {
  private readonly cache = new WeakMap<
    AirspaceFeature,
    { key: string; caption: Caption | null }
  >();
  private zones: unknown = null;
  private flags = "";
  private scale = "";
  private prepared: Bounds | null = null;

  /** The new scene parts, or null when nothing needs to change. */
  update(
    map: DeckMap,
    zones: AirspaceFeature[],
    visibility: Visibility,
    theme: Theme,
    settled: boolean,
  ): Pick<
    Scene,
    "captionTitles" | "captionActiveTitles" | "captionNames" | "parachutes"
  > | null {
    const flags = `${visibility.airspaceNames}|${visibility.airspaceFullNames}|${theme}`;
    const scale = `${map.getZoom().toFixed(3)}|${map.getBearing()}`;
    const bounds = map.getBounds();
    const inputsChanged = zones !== this.zones || flags !== this.flags;
    const rescaled = settled && scale !== this.scale;
    const left =
      scale === this.scale &&
      !!this.prepared &&
      !contains(this.prepared, bounds);
    if (!inputsChanged && !rescaled && !left && this.prepared) return null;

    const dw = (bounds[2] - bounds[0]) * MARGIN,
      dh = (bounds[3] - bounds[1]) * MARGIN;
    const area: Bounds = [
      bounds[0] - dw,
      bounds[1] - dh,
      bounds[2] + dw,
      bounds[3] + dh,
    ];
    this.zones = zones;
    this.flags = flags;
    this.scale = scale;
    this.prepared = area;

    const key = `${scale}|${flags}`;
    const captions: Caption[] = [];
    for (const zone of zones) {
      if (!intersects(zone.bbox, area)) continue;
      const style = airspaceStyle(zone.properties);
      if (!visibility.airspaceNames && !style.parachuting) continue;
      let entry = this.cache.get(zone);
      if (entry?.key !== key) {
        entry = { key, caption: this.place(map, zone, visibility, theme) };
        this.cache.set(zone, entry);
      }
      if (entry.caption) captions.push(entry.caption);
    }
    return this.scene(captions, visibility);
  }

  private place(
    map: DeckMap,
    zone: AirspaceFeature,
    visibility: Visibility,
    theme: Theme,
  ) {
    const style = airspaceStyle(zone.properties);
    const rings = zone.geometry.coordinates.map((ring) =>
      ring.map((p) => {
        const point = map.project([p[0], p[1]]);
        return [point.x, point.y];
      }),
    );
    if (!rings[0]?.length) return null;
    const caption = airspaceCaption(
      zone.properties.name,
      zone.properties.class,
    );
    const active = !!zone.properties.active_now;
    const width = Math.max(
      measure(
        `${active ? 700 : 600} ${active ? 11 : 10}px system-ui,sans-serif`,
        caption.title,
      ),
      measure("600 10px system-ui,sans-serif", caption.name),
    );
    const placed = airspaceCaptionPlacement(
      rings,
      width,
      visibility.airspaceNames &&
        visibility.airspaceFullNames &&
        !!caption.name,
    );
    if (!placed) return null;
    const at = map.unproject(placed);
    return {
      position: [at.lng, at.lat] as Pos,
      title: caption.title,
      name: placed.fullName ? caption.name : null,
      color: lighten(cssColor(style.stroke), palettes[theme].lift),
      active,
      parachuting: style.parachuting,
    };
  }

  private scene(captions: Caption[], visibility: Visibility) {
    const captionTitles: TextDatum[] = [],
      captionActiveTitles: TextDatum[] = [],
      captionNames: TextDatum[] = [],
      parachutes: ParachuteDatum[] = [];
    for (const c of captions) {
      if (c.parachuting)
        parachutes.push({
          position: c.position,
          offset: [0, visibility.airspaceNames ? -26 : 0],
        });
      if (!visibility.airspaceNames) continue;
      (c.active ? captionActiveTitles : captionTitles).push({
        position: c.position,
        text: c.title,
        color: c.color,
        offset: [0, c.name ? -7 : 0],
      });
      if (c.name)
        captionNames.push({
          position: c.position,
          text: c.name,
          color: c.color,
          offset: [0, 7],
        });
    }
    return { captionTitles, captionActiveTitles, captionNames, parachutes };
  }
}
