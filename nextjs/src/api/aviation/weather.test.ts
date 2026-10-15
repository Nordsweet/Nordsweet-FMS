import { afterEach, expect, it, vi } from "vitest";
import { aviationApi } from "./client";

afterEach(() => vi.unstubAllGlobals());
it("loads weather and ATIS in parallel without aggregate airport, charts or NOTAM requests", async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: URL) => {
      requests.push(url.pathname);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            icao: "EPKK",
            metar: null,
            taf: "TAF EPKK",
            atis: [],
            sources: { test: "ok" },
          }),
        ),
      );
    }),
  );
  expect(await aviationApi.briefing("EPKK")).toMatchObject({
    taf: "TAF EPKK",
    atis: [],
  });
  expect(requests.sort()).toEqual([
    "/airports/EPKK/atis",
    "/airports/EPKK/weather",
  ]);
});
it("keeps weather if the ATIS source fails and reports failure if both fail", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: URL) =>
      Promise.resolve(
        url.pathname.endsWith("/atis")
          ? new Response("{}", { status: 502 })
          : new Response(
              JSON.stringify({
                icao: "EPKK",
                metar: null,
                taf: "TAF EPKK",
                sources: { weather: "ok" },
              }),
            ),
      ),
    ),
  );
  expect(await aviationApi.briefing("EPKK")).toMatchObject({
    taf: "TAF EPKK",
    atis: [],
    sources: { atis: "error" },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 502 })),
  );
  await expect(aviationApi.briefing("EPKK")).rejects.toThrow();
});
