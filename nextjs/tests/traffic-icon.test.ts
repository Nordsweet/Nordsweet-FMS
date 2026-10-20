import { afterEach, expect, test, vi } from "vitest";
import {
  buildLayers,
  emptyScene,
  type TrafficDatum,
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
