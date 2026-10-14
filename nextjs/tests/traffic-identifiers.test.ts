import { afterEach, expect, test, vi } from "vitest";
import { trafficIdentifiers } from "~/api/traffic-details";
afterEach(() => vi.unstubAllGlobals());
test("resolves the exact queried flight number to published callsign aliases", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            response: {
              flightroute: {
                callsign: "FR1923",
                callsign_iata: "FR1923",
                callsign_icao: "RYR6AJ",
                destination: { icao_code: "EPKK", name: "Kraków" },
              },
            },
          }),
        ),
    ),
  );
  expect(await trafficIdentifiers({ callsign: "FR1923" })).toContain("RYR6AJ");
});
test("rejects unrelated provider replies rather than selecting a different flight", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            response: {
              flightroute: {
                callsign: "FR1924",
                callsign_iata: "FR1924",
                callsign_icao: "RYR6AK",
                destination: { icao_code: "EPKK", name: "Kraków" },
              },
            },
          }),
        ),
    ),
  );
  await expect(trafficIdentifiers({ callsign: "FR1923" })).rejects.toThrow(
    "Callsign mismatch",
  );
});
