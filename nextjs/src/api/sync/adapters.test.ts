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
  useFlight.getState().reset();
});

describe("settings", () => {
  it("carries only the pilot surname (the rest travels through /me/settings) and keeps local fields", async () => {
    const settings = adapter("settings");
    useSettings.setState({
      language: "en",
      pilotSurname: "Kowalski",
      checklistVoiceUris: { "female.pl-pl": "voice://x" },
    });
    expect(await settings.get("main")).toEqual({ pilotSurname: "Kowalski" });
    // Fields of an item written by an older release are ignored, not applied.
    const remote = settings.parse(
      { language: "pl", pilotWeightKg: 80, pilotSurname: "Nowak" },
      1,
    )!;
    expect(remote).toEqual({ pilotSurname: "Nowak" });
    await settings.put("main", remote);
    expect(useSettings.getState()).toMatchObject({
      language: "en",
      pilotSurname: "Nowak",
      checklistVoiceUris: { "female.pl-pl": "voice://x" },
    });
  });

  it("refuses data of the wrong shape", () => {
    expect(adapter("settings").parse({ pilotSurname: 3 }, 1)).toBeNull();
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
