import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.hoisted(() => new Map<string, string>());
vi.stubGlobal("localStorage", {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, value),
  removeItem: (key: string) => void values.delete(key),
});
vi.stubGlobal("window", {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});

import { newFlight } from "~/data/flight";
import { useAircraftState } from "~/stores/aircraft-state";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { settingsDefaults, useSettings } from "~/stores/settings";

import { syncAdapters } from "./adapters";
import { MAX_ITEM_BYTES } from "./contract";

const adapter = (name: string) =>
  syncAdapters.find((a) => a.collection === name)!;

beforeEach(() => {
  values.clear();
  useSettings.setState(settingsDefaults);
  useAircraftState.setState({ states: {} });
  useFlight.getState().reset();
});

describe("settings", () => {
  it("leaves this device's voices out and keeps them when remote settings arrive", async () => {
    const settings = adapter("settings");
    useSettings.setState({
      language: "en",
      checklistVoiceUris: { "female.pl-pl": "voice://x" },
    });
    const local = (await settings.get("main"))!;
    expect(local.language).toBe("en");
    expect(local).not.toHaveProperty("checklistVoiceUris");
    const remote = settings.parse({ language: "pl", pilotWeightKg: 80 }, 1)!;
    expect(remote).toEqual({ language: "pl", pilotWeightKg: 80 }); // missing keys stay local
    await settings.put("main", remote);
    expect(useSettings.getState()).toMatchObject({
      language: "pl",
      pilotWeightKg: 80,
      checklistVoiceUris: { "female.pl-pl": "voice://x" },
    });
  });

  it("refuses data of the wrong shape", () => {
    expect(adapter("settings").parse({ language: "xx" }, 1)).toBeNull();
  });
});

describe("aircraft-state", () => {
  const frame = (mth: string, updatedAt: number | null) => ({
    fuelIndicationMode: null,
    mth,
    fuelRemainingL: null,
    fuelAddedL: null,
    fuelUsedL: null,
    updatedAt,
  });
  it("merges per airframe and prefers the later reading", () => {
    const merged = adapter("aircraft-state").merge(
      { states: { "P2006T::SP-A": frame("1.0", 1) } },
      {
        states: {
          "P2006T::SP-A": frame("1.5", 5),
          "P2006T::SP-B": frame("9.0", 2),
        },
      },
      {
        states: {
          "P2006T::SP-A": frame("1.2", 3),
          "C172::DEFAULT": frame("4.0", 1),
        },
      },
    ) as { states: Record<string, { mth: string }> };
    expect(
      Object.fromEntries(
        Object.entries(merged.states).map(([k, v]) => [k, v.mth]),
      ),
    ).toEqual({
      "P2006T::SP-A": "1.5",
      "P2006T::SP-B": "9.0",
      "C172::DEFAULT": "4.0",
    });
  });

  it("is not uploaded while empty", async () => {
    expect(await adapter("aircraft-state").ids()).toEqual([]);
  });
});

describe("custom-aircraft", () => {
  const draft = (type: string, extra: object = {}) => ({
    baseId: null,
    type,
    ...extra,
  });
  it("wraps the list in an object and merges drafts by aircraft", () => {
    const merged = adapter("custom-aircraft").merge(
      { drafts: [draft("A", { n: 1 })] },
      { drafts: [draft("A", { n: 2 }), draft("B")] },
      { drafts: [draft("A", { n: 1 }), draft("C")] },
    ) as { drafts: { type: string; n?: number }[] };
    expect(merged.drafts.map((d) => `${d.type}${d.n ?? ""}`).sort()).toEqual([
      "A2",
      "B",
      "C",
    ]);
  });

  it("round-trips through the local copy", async () => {
    const a = adapter("custom-aircraft");
    expect(await a.ids()).toEqual([]);
    await a.put("main", { drafts: [draft("Mine")] });
    expect(await a.ids()).toEqual(["main"]);
    expect(Array.isArray(await a.get("main"))).toBe(false);
    await a.remove("main");
    expect(await a.ids()).toEqual([]);
  });
});

describe("draft", () => {
  it("adopts a remote draft and merges field by field", async () => {
    const draftAdapter = adapter("draft");
    const remote = { ...newFlight(), name: "From the iPad" };
    await draftAdapter.put("main", draftAdapter.parse(remote, 1)!);
    expect(useFlight.getState().flight.name).toBe("From the iPad");
    expect(draftAdapter.parse({ name: 3 }, 1)).toBeNull();
  });
});

describe("live-flight", () => {
  const startFlight = (points: number) => {
    const track = Array.from({ length: points }, (_, i) => ({
      lat: 52 + i / 1000,
      lon: 21,
      altitudeFt: 1000,
      time: new Date(1_700_000_000_000 + i * 5000).toISOString(),
    }));
    useInFlight.setState({ startedAt: "2026-10-20T10:00:00.000Z", track });
  };
  const live = adapter("live-flight");

  it("exists only while a flight is in progress, with the track trimmed far below the size limit", async () => {
    expect(await live.ids()).toEqual([]);
    startFlight(5000); // about 7 h of fixes
    expect(await live.ids()).toEqual(["current"]);
    const data = (await live.get("current")) as {
      track: unknown[];
      deviceName: string;
    };
    expect(data.track).toHaveLength(60);
    expect(data.deviceName).not.toBe("");
    expect(JSON.stringify(data).length).toBeLessThan(MAX_ITEM_BYTES / 10);
  });

  it("taking it over restores the plan and the flight, and finishing elsewhere stops it here", async () => {
    startFlight(10);
    const data = (await live.get("current"))!;
    useInFlight.setState({ startedAt: null, track: [] });
    useFlight.getState().reset();
    await live.put(
      "current",
      live.parse(
        JSON.parse(JSON.stringify(data)) as Record<string, unknown>,
        1,
      )!,
    );
    expect(useInFlight.getState().startedAt).toBe("2026-10-20T10:00:00.000Z");
    expect(useInFlight.getState().track).toHaveLength(10);
    expect(useFlight.getState().flight.id).toBe(
      (data as { flight: { id: string } }).flight.id,
    );
    expect(live.deleteWins!(data, data)).toBe(true);
    expect(live.deleteWins!(null, data)).toBe(false);
    await live.remove("current");
    expect(useInFlight.getState().startedAt).toBeNull();
  });
});
