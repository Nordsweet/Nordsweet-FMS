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
vi.stubGlobal("document", {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});

import { useInspiration } from "~/stores/inspiration";
import { settingsDefaults, useSettings } from "~/stores/settings";

import { UserDataError } from "./client";
import { startFavoritesSync, startSettingsSync } from "./preferences";
import { type SettingsBody } from "./schemas";

const server = (patch: Partial<SettingsBody> = {}): SettingsBody => ({
  language: "pl",
  home_airport_icao: null,
  pilot_weight_kg: null,
  atis_autoscroll: true,
  checklist_autoscroll: true,
  checklist_voice_gender: "female",
  ...patch,
});

beforeEach(() => {
  values.clear();
  useSettings.setState(settingsDefaults);
  useInspiration.setState({ favorites: [] });
});

describe("settings sync", () => {
  const setup = (current: SettingsBody | null) => {
    const api = {
      settings: vi.fn(async () => current),
      putSettings: vi.fn(async (body: SettingsBody) => body),
    };
    const report = vi.fn();
    const start = () =>
      startSettingsSync({ api: api, username: "pilot", report });
    return { api, report, start };
  };

  it("pushes this device's settings when the server has none yet", async () => {
    useSettings.setState({ language: "en", pilotWeightKg: 82 });
    const { api, start } = setup(null);
    const stop = start();
    await vi.waitFor(() => expect(api.putSettings).toHaveBeenCalledTimes(1));
    expect(api.putSettings).toHaveBeenCalledWith({
      language: "en",
      home_airport_icao: null,
      pilot_weight_kg: 82,
      atis_autoscroll: true,
      checklist_autoscroll: true,
      checklist_voice_gender: "female",
    });
    stop();
  });

  it("applies the server's copy and keeps what the server cannot hold", async () => {
    useSettings.setState({
      homeAirportIcao: "Kraków",
      pilotSurname: "Nowak",
      checklistVoiceUris: { "female.pl-pl": "voice://x" },
    });
    const { api, start } = setup(
      server({ language: "en", pilot_weight_kg: 90, atis_autoscroll: false }),
    );
    const stop = start();
    await vi.waitFor(() =>
      expect(useSettings.getState()).toMatchObject({
        language: "en",
        pilotWeightKg: 90,
        atisAutoscroll: false,
      }),
    );
    expect(useSettings.getState()).toMatchObject({
      homeAirportIcao: "Kraków", // free text has no place on the server
      pilotSurname: "Nowak", // not in /me/settings
      checklistVoiceUris: { "female.pl-pl": "voice://x" },
    });
    expect(api.putSettings).not.toHaveBeenCalled();
    stop();
  });

  it("uploads an edit after a pause, and an edit made while offline wins over the server at the next start", async () => {
    const online = setup(server({ home_airport_icao: "EPKK" }));
    let stop = online.start();
    await vi.waitFor(() =>
      expect(useSettings.getState().homeAirportIcao).toBe("EPKK"),
    );
    useSettings.getState().update({ homeAirportIcao: "EPWA" });
    expect(values.get("nordsweet.settingsPending.pilot.v1")).toBe("1");
    await vi.waitFor(
      () =>
        expect(online.api.putSettings).toHaveBeenCalledWith(
          expect.objectContaining({ home_airport_icao: "EPWA" }),
        ),
      { timeout: 4000 },
    );
    expect(values.has("nordsweet.settingsPending.pilot.v1")).toBe(false);
    stop();

    // Offline edit, app closed: the server still says EPKK, but the edit is pending.
    useSettings.setState({ homeAirportIcao: "EPGD" });
    values.set("nordsweet.settingsPending.pilot.v1", "1");
    const next = setup(server({ home_airport_icao: "EPKK" }));
    stop = next.start();
    await vi.waitFor(() =>
      expect(next.api.putSettings).toHaveBeenCalledTimes(1),
    );
    expect(useSettings.getState().homeAirportIcao).toBe("EPGD");
    stop();
  });

  it("reports offline and keeps the edit pending when the server cannot be reached", async () => {
    const { api, report, start } = setup(null);
    api.settings.mockRejectedValue(new UserDataError(0, "Network unavailable"));
    const stop = start();
    await vi.waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ state: "offline", pending: 1 }),
      ),
    );
    stop();
  });
});

describe("favorites sync", () => {
  const setup = (onServer: string[]) => {
    const api = {
      favorites: vi.fn(async () => ({
        items: onServer.map((item_id) => ({ item_id, created_at: "x" })),
        has_more: false,
      })),
      putFavorite: vi.fn(async (_id: string) => undefined),
      removeFavorite: vi.fn(async (_id: string) => undefined),
    };
    const start = () =>
      startFavoritesSync({
        api: api,
        username: "pilot",
        report: vi.fn(),
      });
    return { api, start };
  };

  it("adds what was starred here to the server and takes in what was starred elsewhere", async () => {
    useInspiration.setState({ favorites: ["a", "c"] });
    values.set("nordsweet.favoritesBase.pilot.v1", JSON.stringify(["a"]));
    const { api, start } = setup(["a", "b"]);
    const stop = start();
    await vi.waitFor(() =>
      expect(useInspiration.getState().favorites).toEqual(["a", "c", "b"]),
    );
    expect(api.putFavorite).toHaveBeenCalledTimes(1);
    expect(api.putFavorite).toHaveBeenCalledWith("c");
    expect(api.removeFavorite).not.toHaveBeenCalled();
    expect(JSON.parse(values.get("nordsweet.favoritesBase.pilot.v1")!)).toEqual(
      ["a", "c", "b"],
    );
    stop();
  });

  it("removes what was un-starred here, and does not bring it back from the server", async () => {
    useInspiration.setState({ favorites: ["a"] });
    values.set("nordsweet.favoritesBase.pilot.v1", JSON.stringify(["a", "b"]));
    const { api, start } = setup(["a", "b"]);
    const stop = start();
    await vi.waitFor(() =>
      expect(api.removeFavorite).toHaveBeenCalledWith("b"),
    );
    expect(useInspiration.getState().favorites).toEqual(["a"]);
    stop();
  });

  it("on a device that never synced, the two lists are joined", async () => {
    useInspiration.setState({ favorites: ["local"] });
    const { api, start } = setup(["remote"]);
    const stop = start();
    await vi.waitFor(() =>
      expect(useInspiration.getState().favorites).toEqual(["local", "remote"]),
    );
    expect(api.putFavorite).toHaveBeenCalledWith("local");
    stop();
  });
});
