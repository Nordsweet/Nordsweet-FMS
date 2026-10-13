import fs from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
const memory = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  createStore: vi.fn(),
  get: async (key: string) => memory.get(key),
  set: async (key: string, value: unknown) => {
    memory.set(key, value);
  },
  del: async (key: string) => {
    memory.delete(key);
  },
  entries: async () => [...memory.entries()],
}));
vi.mock("./datasets", () => ({
  loadDataset: async (name: string) =>
    JSON.parse(fs.readFileSync(`public/data/${name}.json`, "utf8")) as unknown,
}));
import { newFlight } from "~/data/flight";
import {
  legacyDraft,
  saveFlight,
  renameFlight,
  importFlight,
  listFlights,
} from "./flights";
let values: Record<string, string>;
beforeEach(() => {
  memory.clear();
  values = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values[key] ?? null,
  });
});
it("preserves a snapshot date when renaming and importing an independent copy", async () => {
  const saved = await saveFlight({ ...newFlight(), name: "First" });
  const renamed = await renameFlight({ id: saved.id, name: " New name " });
  expect(renamed.name).toBe("New name");
  expect(renamed.savedAt).toBe(saved.savedAt);
  const text = fs.readFileSync(
    "tests/fixtures/nord/P2006T0508261012.nord",
    "utf8",
  );
  const first = await importFlight({ text, fileName: "first.nord" });
  const second = await importFlight({ text, fileName: "second.nord" });
  expect(second.id).not.toBe(first.id);
  expect(await listFlights()).toHaveLength(3);
});
it("migrates the legacy draft profile, route, loading and manual fuel rows", async () => {
  values = {
    "nordsweet.aircraftType.v1": "P2006T",
    "nordsweet.aircraftRegistration.v1": "SP-TEST",
    "nordsweet.lastRoute.v1": fs.readFileSync(
      "tests/fixtures/nord/P2006T0508261012.nord",
      "utf8",
    ),
  };
  const doc = JSON.parse(values["nordsweet.lastRoute.v1"]!) as {
    route: unknown;
  };
  values["nordsweet.lastRoute.v1"] = JSON.stringify(doc.route);
  values["nordsweet.weightBalance.v1"] = JSON.stringify({
    pilotWeightKg: "88",
    coPilotWeightKg: "70",
    firstPassengerWeightKg: "60",
    secondPassengerWeightKg: "50",
    usableFuelLiters: "90",
  });
  values["nordsweet.fuelPlanning.v1"] = JSON.stringify({
    plannedTrip: { time: "01:20", fuelLiters: "42" },
    climb: { time: "", fuelLiters: "" },
  });
  const draft = await legacyDraft();
  expect(draft).toMatchObject({
    aircraftId: "P2006T",
    registration: "SP-TEST",
    departure: { ident: "EPNT" },
    destination: { ident: "EPML" },
    fuel: { blockL: 90 },
    stationsKg: {
      pilot: 88,
      coPilot: 70,
      firstPassenger: 60,
      secondPassenger: 50,
    },
    fuelOverrides: { plannedTrip: { minutes: 80, fuelL: 42 } },
  });
  expect(draft?.fuelOverrides.climb).toBeUndefined();
});
it("resolves code-only legacy drafts and tolerates corrupt data", async () => {
  expect(await legacyDraft()).toBeNull();
  values["nordsweet.lastRoute.v1"] = JSON.stringify({
    departureIcao: "EPKK",
    destinationIcao: "EPNT",
    plan: null,
  });
  expect(await legacyDraft()).toMatchObject({
    departure: { ident: "EPKK" },
    destination: { ident: "EPNT" },
  });
  values["nordsweet.weightBalance.v1"] = "broken";
  values["nordsweet.aircraftType.v1"] = "P2006T";
  expect((await legacyDraft())?.stationsKg.pilot).toBe(85);
});
