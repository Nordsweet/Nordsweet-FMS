import { afterEach, expect, test, vi } from "vitest";
import {
  WebMercatorViewport,
  MapController,
  type MapViewState,
  type LinearInterpolator,
} from "@deck.gl/core";
import { DeckMap } from "~/features/map/deck/deck-map";
import type * as DeckModule from "@deck.gl/core";

const camera: { props: Record<string, unknown> } = vi.hoisted(() => ({
  props: {},
}));
vi.mock("@deck.gl/core", async (original) => ({
  ...(await original<typeof DeckModule>()),
  Deck: class {
    constructor(props: Record<string, unknown>) {
      camera.props = props;
    }
    setProps(props: Record<string, unknown>) {
      Object.assign(camera.props, props);
    }
    finalize = vi.fn();
  },
}));
vi.mock("~/api/terrain", () => ({ cachedTerrainElevation: () => null }));
afterEach(() => {
  vi.unstubAllGlobals();
});

test.each([
  { bearing: 0, terrain: false },
  { bearing: 73, terrain: false },
  { bearing: 0, terrain: true },
  { bearing: 73, terrain: true },
])(
  "the rendered transition keeps the aircraft anchored at bearing $bearing, terrain $terrain",
  ({ bearing, terrain }) => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    const map = new DeckMap(
      {
        clientWidth: 1000,
        clientHeight: 600,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as HTMLElement,
      {
        bounds: [
          [19, 49],
          [21, 51],
        ],
        padding: 0,
        onLoad: vi.fn(),
      },
    );
    try {
      map.setTerrain(terrain);
      map.setFollowing(true);
      let position: [number, number] = [20, 50];
      map.follow(position, bearing, [0.5, 0.75]);
      const start = camera.props.viewState as MapViewState;
      const change = camera.props.onViewStateChange as (event: unknown) => void;
      for (const delta of [1, -1, 0.7]) {
        const before = camera.props.viewState as MapViewState;
        change({
          viewState: {
            ...before,
            zoom: before.zoom + delta,
            transitionDuration: 250,
          },
          interactionState: { isZooming: true },
        });
        const target = camera.props.viewState as MapViewState;
        const interpolator =
          target.transitionInterpolator as LinearInterpolator;
        const { start: from, end: to } = interpolator.initializeProps(
          before,
          target,
        );
        for (const t of [0, 0.1, 0.3, 0.6, 1]) {
          // The controller renders its interpolation result before the app's view-state callback.
          const rendered = {
            ...target,
            ...interpolator.interpolateProps(from, to, t),
          };
          const pixel = new WebMercatorViewport({
            ...rendered,
            width: 1000,
            height: 600,
          }).project(position);
          // deck's 3D pan solver is approximate; flat Mercator is exact.
          expect(Math.hypot(pixel[0]! - 500, pixel[1]! - 450)).toBeLessThan(
            terrain ? 2 : 0.00001,
          );
          expect(rendered.zoom).toBeCloseTo(before.zoom + delta * t, 8);
          position = [position[0] + 0.0001, position[1] + 0.0001];
          map.follow(position, bearing, [0.5, 0.75]);
        }
        expect(
          interpolator.arePropsEqual(target, {
            ...target,
            longitude: target.longitude + 0.01,
          }),
        ).toBe(true);
      }
      expect(start.zoom).toBeGreaterThan(0);
    } finally {
      map.destroy();
    }
  },
);

test("a moving pinch ending in the same telemetry tick leaves the camera usable for another pan", () => {
  vi.stubGlobal("window", { setTimeout: () => 0 });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  const map = new DeckMap(
    {
      clientWidth: 1000,
      clientHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement,
    {
      bounds: [
        [19, 49],
        [21, 51],
      ],
      padding: 0,
      onLoad: vi.fn(),
    },
  );
  type Options = ConstructorParameters<typeof MapController>[0];
  let current = {
    ...(camera.props.viewState as MapViewState),
    x: 0,
    y: 0,
    width: 1000,
    height: 600,
  };
  const controller = new MapController({
    timeline: { getTime: () => 0 } as Options["timeline"],
    eventManager: {
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as Options["eventManager"],
    makeViewport: (props) => new WebMercatorViewport(props),
    onStateChange: vi.fn(),
    onViewStateChange: ({ viewState }) => {
      current = { ...current, ...(viewState as MapViewState) };
    },
  });
  try {
    controller.setProps({
      dragMode: "pan",
      ...current,
      position: undefined,
      ...(camera.props.controller as object),
      id: "map",
    });
    const send = (type: string, scale: number, x: number) =>
      controller.handleEvent({
        type,
        scale,
        offsetCenter: { x, y: 200 },
        rotation: 0,
        deltaTime: 100,
        pointerType: "touch",
        srcEvent: { preventDefault: vi.fn() },
        stopPropagation: vi.fn(),
      } as unknown as Parameters<MapController["handleEvent"]>[0]);
    send("pinchstart", 1, 200);
    send("pinchmove", 1.3, 225);
    send("pinchend", 1.4, 230);
    for (const key of ["longitude", "latitude", "zoom"] as const)
      expect(Number.isFinite(current[key])).toBe(true);
    const before = current.longitude;
    controller.setProps({
      dragMode: "pan",
      ...current,
      position: undefined,
      ...(camera.props.controller as object),
      id: "map",
    });
    send("panstart", 1, 230);
    send("panmove", 1, 280);
    expect(Math.abs(current.longitude - before)).toBeGreaterThan(0.001);
  } finally {
    controller.finalize();
    map.destroy();
  }
});
