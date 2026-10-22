import { afterEach, expect, test, vi } from "vitest";
import {
  buildLayers,
  emptyScene,
  type TrafficDatum,
  type OwnshipDatum,
} from "~/features/map/deck/scene";
import type { IconLayer } from "@deck.gl/layers";

vi.mock("~/features/map/deck/atlas", () => ({
  iconAtlas: () => ({ url: "", mapping: {} }),
}));
afterEach(() => vi.unstubAllGlobals());
test("both advisory levels enlarge the complete traffic symbol by 1.5", () => {
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  const layers = buildLayers(
    { ...emptyScene(), basemap: "osm" },
    () => undefined,
    () => undefined,
  );
  const layer = layers.find(
    (l) => l.id === "traffic",
  ) as IconLayer<TrafficDatum>;
  const size = layer.props.getSize as (datum: Partial<TrafficDatum>) => number;
  expect(size({})).toBe(24);
  expect(size({ advisory: "ta" })).toBe(36);
  expect(size({ advisory: "close" })).toBe(36);
});

test.each([false, true])(
  "traffic clock stays aligned to ownship in terrain=%s",
  (terrain3d) => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const aircraft: OwnshipDatum = {
      position: [19, 50],
      track: 67,
      alpha: 0.8,
      trafficClock: true,
    };
    const layers = buildLayers(
      { ...emptyScene(), basemap: "osm", terrain3d, ownship: [aircraft] },
      () => undefined,
      () => undefined,
    );
    const clock = layers.find((l) =>
      l.id.startsWith("traffic-clock"),
    ) as IconLayer<OwnshipDatum>;
    const ownship = layers.find((l) =>
      l.id.startsWith("ownship"),
    ) as IconLayer<OwnshipDatum>;
    expect(clock.props.data).toEqual([aircraft]);
    expect(clock.props.getSize).toBe(104);
    expect(clock.props.sizeUnits).toBe("pixels");
    expect(clock.props.pickable).toBe(false);
    expect(clock.props.billboard).toBe(ownship.props.billboard);
    const angle = clock.props.getAngle as (d: OwnshipDatum) => number;
    const ownAngle = ownship.props.getAngle as (d: OwnshipDatum) => number;
    expect(angle(aircraft)).toBe(ownAngle(aircraft));
    expect(angle(aircraft)).toBe(-67);
  },
);
