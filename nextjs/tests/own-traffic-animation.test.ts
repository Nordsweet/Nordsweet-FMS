import { afterEach, expect, test, vi } from "vitest";
import { aircraftSchema } from "~/api/aviation/schemas";
import { useMapAnimation } from "~/features/map/use-map-animation";
import type { DeckMap, DeckScene } from "~/features/map/deck";

vi.mock("react", () => ({ useEffect: (effect: () => void) => effect() }));
afterEach(() => vi.unstubAllGlobals());

test("animation keeps own traffic visible with a normal icon and another aircraft's alarm", () => {
  let draw: FrameRequestCallback = () => undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    draw = callback;
    return 1;
  });
  const set = vi.fn();
  const map = {
    project: ([x, y]: [number, number]) => ({ x, y }),
    unproject: ({ x, y }: { x: number; y: number }) => ({ lng: x, lat: y }),
    getBearing: () => 0,
    getZoom: () => 8,
    getSize: () => ({ width: 1000, height: 800 }),
  };
  const now = new Date().toISOString();
  const aircraft = aircraftSchema.parse({
    hex: "48e9fa",
    registration: null,
    callsign: "TRAINING",
    type: "C172",
    lat: 0,
    lon: 30 / 3600,
    altitude_ft: 3000,
    on_ground: false,
    ground_speed_kt: 60,
    track_deg: 270,
    vertical_rate_fpm: 0,
    squawk: null,
    position_time: now,
    sources: ["adsb.lol"],
  });
  useMapAnimation({
    mapRef: { current: map as unknown as DeckMap },
    sceneRef: {
      current: { set, state: { theme: "light" } } as unknown as DeckScene,
    },
    ready: true,
    aircraft: [aircraft, { ...aircraft, hex: "48e9fb" }],
    trafficEnabled: true,
    fix: {
      lat: 0,
      lon: 0,
      altitudeFt: 3000,
      groundSpeedKt: 60,
      trackDeg: 0,
      accuracyM: 0,
      time: now,
    },
    following: false,
    trackUp: false,
    selectedHex: "",
    directRoute: null,
    ownIdentity: { registration: "SP-TDI", hex: "48e9fa" },
  });
  draw(1000);
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({
      traffic: [
        expect.objectContaining({
          hex: "48e9fa",
          icon: "aircraft",
          advisory: undefined,
        }),
        expect.objectContaining({
          hex: "48e9fb",
          icon: "aircraft",
          advisory: "close",
        }),
      ],
    }),
  );
});
