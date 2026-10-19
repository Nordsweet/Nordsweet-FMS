import { afterEach, expect, test, vi } from "vitest";
import { trafficAircraftIdentity } from "~/api/traffic-details";
import { isOwnTraffic, ownRegistration } from "~/domain/traffic-identity";
import { trafficAlertLevel } from "~/domain/map-navigation";

afterEach(() => vi.unstubAllGlobals());
const payload = {
  response: {
    aircraft: { registration: "G-EUUU", mode_s: "405455", icao_type: "A320" },
  },
};

test("database lookup verifies registration and resolves compact country separators", async () => {
  const fetch = vi.fn(async (url: string) =>
    url.endsWith("/GEUUU")
      ? new Response(null, { status: 404 })
      : Response.json(payload),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await trafficAircraftIdentity({ registration: "g euuu" })).toEqual({
    registration: "G-EUUU",
    hex: "405455",
    icaoType: "A320",
    model: null,
  });
  expect(fetch.mock.calls.map((call) => call[0])).toEqual([
    "https://api.adsbdb.com/v0/aircraft/GEUUU",
    "https://api.adsbdb.com/v0/aircraft/G-EUUU",
  ]);
});

test("unknown registrations and invalid input do not produce an identity", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  expect(await trafficAircraftIdentity({ registration: "" })).toBeNull();
  expect(
    await trafficAircraftIdentity({ registration: "../../405455" }),
  ).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(
    await trafficAircraftIdentity({ registration: "SP-UNKNOWN" }),
  ).toBeNull();
});

test("unrelated database replies and invalid Mode S addresses are rejected", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(payload)),
  );
  await expect(
    trafficAircraftIdentity({ registration: "G-EUUV" }),
  ).rejects.toThrow("registration mismatch");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        response: { aircraft: { registration: "G-EUUU", mode_s: "000000" } },
      }),
    ),
  );
  await expect(
    trafficAircraftIdentity({ registration: "G-EUUU" }),
  ).rejects.toThrow();
});

test("typed registration wins; an unchanged profile registration supplies canonical separators", () => {
  expect(ownRegistration(" ", "SP-TDI")).toBe("SP-TDI");
  expect(ownRegistration("sp tdi", "SP-TDI")).toBe("SP-TDI");
  expect(ownRegistration("SP-GUN", "SP-TDI")).toBe("SP-GUN");
  expect(ownRegistration("", null)).toBe("");
});

test("owner-confirmed SP-TDI remains identifiable when the public database has no record", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await trafficAircraftIdentity({ registration: "SPTDI" })).toEqual({
    registration: "SP-TDI",
    hex: "48e9fa",
    icaoType: "C172",
  });
  expect(fetch).not.toHaveBeenCalled();
});

test("Mode S is authoritative even with a different callsign or conflicting registration", () => {
  const own = { registration: "SP-TDI", hex: "48e9fa" };
  expect(isOwnTraffic({ hex: "48E9FA", callsign: "TRAINING" }, own)).toBe(true);
  expect(isOwnTraffic({ hex: "48e9fb", registration: "SP-TDI" }, own)).toBe(
    false,
  );
  expect(isOwnTraffic({ hex: "48e9fb" }, null)).toBe(false);
});

test("unresolved registrations fall back to exact registration or an otherwise absent registration's callsign", () => {
  const own = { registration: "SP-TDI", hex: null };
  expect(isOwnTraffic({ registration: "sptdi" }, own)).toBe(true);
  expect(isOwnTraffic({ registration: null, callsign: "SPTDI" }, own)).toBe(
    true,
  );
  expect(isOwnTraffic({ registration: "SP-GUN", callsign: "SPTDI" }, own)).toBe(
    false,
  );
  expect(isOwnTraffic({ callsign: "SPTDI2" }, own)).toBe(false);
});

test("own ADS-B report is normal while a different aircraft keeps its CPA alert", () => {
  const own = { lat: 0, lon: 0, altitudeFt: 3000, speedKt: 0, trackDeg: 0 };
  const target = {
    lat: 0,
    lon: 30 / 3600,
    altitudeFt: 3000,
    speedKt: 60,
    trackDeg: 270,
    hex: "48e9fa",
    registration: null,
    callsign: "TRAINING",
  };
  expect(trafficAlertLevel(own, target)).toBe("red");
  expect(
    trafficAlertLevel(own, target, { registration: "SP-TDI", hex: "48e9fa" }),
  ).toBe("normal");
  expect(
    trafficAlertLevel(own, target, { registration: "SP-GUN", hex: "48e9fb" }),
  ).toBe("red");
});
