import { describe, expect, it, vi } from "vitest";

import { newFlight } from "~/data/flight";
import { type AircraftState } from "~/stores/aircraft-state";
import { settingsDefaults } from "~/stores/settings";

import {
  aircraftItems,
  airframeStateItems,
  flightItems,
  importBatches,
  importLocalData,
  mthNumber,
  rejectedLines,
  settingsBody,
  wasImported,
} from "./import";
import { importResultSchema } from "./schemas";

const state = (patch: Partial<AircraftState>): AircraftState => ({
  fuelIndicationMode: null,
  mth: "",
  fuelRemainingL: null,
  fuelAddedL: null,
  fuelUsedL: null,
  updatedAt: null,
  ...patch,
});

describe("import mapping", () => {
  it("maps airframe state keys: TYPE::DEFAULT has no registration, MTH text becomes a number", () => {
    const items = airframeStateItems({
      "SR20::SPABC": state({
        fuelIndicationMode: "exact",
        mth: "120.5",
        fuelRemainingL: 33,
        updatedAt: Date.UTC(2026, 9, 20, 10),
      }),
      "C172S::DEFAULT": state({ mth: "", fuelAddedL: 20 }),
      "A-1A HUSKY::SPXYZ": state({ mth: "7" }),
      "no-separator": state({ mth: "1" }),
    });
    expect(items).toEqual([
      {
        type: "SR20",
        registration: "SPABC",
        fuel_indication_mode: "exact",
        mth: 120.5,
        fuel_remaining_l: 33,
        fuel_added_l: null,
        fuel_used_l: null,
        updated_at: "2026-10-20T10:00:00.000Z",
      },
      {
        type: "C172S",
        registration: "",
        fuel_indication_mode: null,
        mth: null,
        fuel_remaining_l: null,
        fuel_added_l: 20,
        fuel_used_l: null,
      },
      {
        type: "A-1A HUSKY",
        registration: "SPXYZ",
        fuel_indication_mode: null,
        mth: 7,
        fuel_remaining_l: null,
        fuel_added_l: null,
        fuel_used_l: null,
      },
    ]);
    expect(items[1]).not.toHaveProperty("updated_at"); // never recorded: no invented time
  });

  it("converts MTH text and leaves unknown as null, not zero", () => {
    expect(mthNumber("1234.50")).toBe(1234.5);
    expect(mthNumber("0")).toBe(0);
    expect(mthNumber("")).toBeNull();
    expect(mthNumber("n/a")).toBeNull();
  });

  it("sends settings in the server's shape: empty home airport is null, voices are left out", () => {
    const body = settingsBody({
      ...settingsDefaults,
      language: "en",
      homeAirportIcao: "",
      pilotWeightKg: 82,
      pilotSurname: "Nowak",
      checklistVoiceUris: { "female.pl-pl": "voice://x" },
    });
    expect(body).toEqual({
      language: "en",
      home_airport_icao: null,
      pilot_weight_kg: 82,
      atis_autoscroll: true,
      checklist_autoscroll: true,
      checklist_voice_gender: "female",
    });
    expect(
      settingsBody({ ...settingsDefaults, homeAirportIcao: " epkk " }),
    ).toMatchObject({ home_airport_icao: "EPKK" });
    // The server only knows 4-letter codes: free text stays on the device.
    expect(
      settingsBody({ ...settingsDefaults, homeAirportIcao: "Kraków" }),
    ).toMatchObject({ home_airport_icao: null });
  });

  it("sends a flight as its own document under its id, a draft under the id kept beside it", () => {
    const flight = newFlight();
    expect(flightItems([flight])).toEqual([
      { id: flight.id, document: flight, schema_version: 1 },
    ]);
    const draft = { id: "d-1", baseId: null, type: "X" } as never;
    const noId = { baseId: null, type: "Y" } as never;
    expect(aircraftItems([draft, noId])).toEqual([
      { id: "d-1", document: draft, schema_version: 1 },
    ]);
  });

  it("splits into batches within the documented limits, settings in the first", () => {
    const flights = Array.from({ length: 1201 }, (_, i) => ({
      id: String(i),
      document: {},
      schema_version: 1,
    }));
    const batches = importBatches({
      flights,
      custom_aircraft: [],
      airframe_states: [],
      favorites: Array.from({ length: 1001 }, (_, i) => `f${i}`),
      settings: settingsBody(settingsDefaults),
    });
    expect(batches.map((b) => b.flights?.length ?? 0)).toEqual([500, 500, 201]);
    expect(batches.map((b) => b.favorites?.length ?? 0)).toEqual([1000, 1, 0]);
    expect(batches[0]).toHaveProperty("settings");
    expect(batches[1]).not.toHaveProperty("settings");
  });
});

describe("import run", () => {
  const empty = {
    flights: [],
    custom_aircraft: [],
    airframe_states: [],
    favorites: [],
    settings: settingsBody(settingsDefaults),
  };
  const storage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
    };
  };

  it("runs once per user and device, and lists what the server refused", async () => {
    const store = storage();
    const importData = vi.fn(async () =>
      importResultSchema.parse({
        flights: {
          imported: 1,
          skipped: 0,
          rejected: [{ id: "abc", error: "id is not a UUID" }],
        },
        airframe_states: {
          imported: 0,
          skipped: 0,
          rejected: [{ id: 0, error: [{ msg: "mth too large" }] }],
        },
        settings: "skipped",
      }),
    );
    const rejected = await importLocalData({
      api: { importData },
      username: "pilot",
      local: empty,
      storage: store,
    });
    expect(rejected).toEqual([
      "flights abc: id is not a UUID",
      'airframe_states 0: [{"msg":"mth too large"}]',
    ]);
    expect(wasImported("pilot", store)).toBe(true);
    expect(wasImported("other", store)).toBe(false);

    expect(
      await importLocalData({
        api: { importData },
        username: "pilot",
        local: empty,
        storage: store,
      }),
    ).toBeNull();
    expect(importData).toHaveBeenCalledTimes(1);
  });

  it("is not marked done when a batch fails, so the idempotent import repeats next start", async () => {
    const store = storage();
    const importData = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(
      importLocalData({
        api: { importData },
        username: "pilot",
        local: empty,
        storage: store,
      }),
    ).rejects.toThrow("offline");
    expect(wasImported("pilot", store)).toBe(false);
  });

  it("reads rejected settings errors too", () => {
    expect(
      rejectedLines(
        importResultSchema.parse({ settings: ["language: invalid"] }),
      ),
    ).toEqual(["settings: language: invalid"]);
  });
});
