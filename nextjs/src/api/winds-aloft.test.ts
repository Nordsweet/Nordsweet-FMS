import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWindsAloft } from "./winds-aloft";

const location = (speed: number, direction: number) => ({
  hourly: {
    time: ["2026-10-11T20:00"],
    wind_speed_900hPa: [speed],
    wind_direction_900hPa: [direction],
  },
});

afterEach(() => vi.unstubAllGlobals());

describe("fetchWindsAloft", () => {
  it("asks for the nearest pressure level and returns one wind per point", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([location(20, 260), location(18.4, 259)])),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await fetchWindsAloft(
      [
        { lat: 49.46, lon: 20.05 },
        { lat: 50.08, lon: 19.78 },
      ],
      3000, // ISA 908 hPa → 900 hPa level
    );
    expect(String(fetch.mock.calls[0]![0])).toContain("wind_speed_900hPa");
    expect(result).toEqual({
      levelHpa: 900,
      validAt: "2026-10-11T20:00Z",
      winds: [
        { directionDeg: 260, speedKt: 20 },
        { directionDeg: 259, speedKt: 18.4 },
      ],
    });
  });

  it("fails loudly on missing data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ hourly: { time: ["x"] } })),
        ),
    );
    await expect(
      fetchWindsAloft([{ lat: 50, lon: 20 }], 3000),
    ).rejects.toThrow();
  });
});
