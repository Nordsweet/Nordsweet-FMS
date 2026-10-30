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

import { useAircraftState } from "~/stores/aircraft-state";

import { startAirframeSync } from "./airframes";
import { UserDataError } from "./client";

const KEY = "SR20::SPABC";
const T = Date.UTC(2026, 9, 20, 10);
const frame = (patch: object = {}) => ({
  fuelIndicationMode: null,
  mth: "",
  fuelRemainingL: null,
  fuelAddedL: null,
  fuelUsedL: null,
  updatedAt: null,
  ...patch,
});
const serverAirframe = (state: object | null, mode: string | null = null) => ({
  id: "af-1",
  type: "SR20",
  registration: "SPABC",
  fuel_indication_mode: mode,
  state: state && {
    reading_id: "r-0",
    recorded_at: new Date(T).toISOString(),
    mth: null,
    fuel_remaining_l: null,
    fuel_added_l: null,
    fuel_used_l: null,
    ...state,
  },
});

type ReadingResult = {
  reading: { id: string };
  warnings: { code: string; previous_mth?: number }[];
};

function setup(server: ReturnType<typeof serverAirframe>[] = []) {
  const api = {
    airframes: vi.fn(async () => ({ items: server, has_more: false })),
    resolveAirframe: vi.fn(async () => server[0] ?? serverAirframe(null)),
    addReading: vi.fn(
      async (
        _id: string,
        _body: Record<string, unknown>,
      ): Promise<ReadingResult> => ({ reading: { id: "r" }, warnings: [] }),
    ),
    setFuelIndicationMode: vi.fn(async () => serverAirframe(null)),
  };
  const report = vi.fn();
  const notify = vi.fn();
  const start = () =>
    startAirframeSync({
      api: api as never,
      username: "pilot",
      report,
      notify,
    });
  return { api, report, notify, start };
}

beforeEach(() => {
  values.clear();
  useAircraftState.setState({ states: {}, covered: {} });
});

describe("airframe sync", () => {
  it("records a manual change as a full snapshot with a client-minted id, and a retry keeps that id", async () => {
    useAircraftState.setState({
      states: {
        [KEY]: frame({ mth: "120.5", fuelRemainingL: 33, updatedAt: T }),
      },
    });
    const { api, start } = setup();
    api.addReading.mockRejectedValueOnce(new UserDataError(0, "offline"));

    let stop = start();
    await vi.waitFor(() => expect(api.addReading).toHaveBeenCalledTimes(1));
    expect(api.resolveAirframe).toHaveBeenCalledWith({
      type: "SR20",
      registration: "SPABC",
    });
    const [id, body] = api.addReading.mock.calls[0]!;
    expect(id).toBe("af-1");
    expect(body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      recorded_at: new Date(T).toISOString(),
      mth: 120.5,
      fuel_remaining_l: 33,
      fuel_added_l: null, // every value, null = unknown
      fuel_used_l: null,
      source: "manual",
    });

    stop();
    stop = start(); // back online
    await vi.waitFor(() => expect(api.addReading).toHaveBeenCalledTimes(2));
    expect(api.addReading.mock.calls[1]![1].id).toBe(body.id);
    stop();
  });

  it("does not send a debrief's reading itself: it travels inside the flight log", async () => {
    const { api, start } = setup();
    useAircraftState
      .getState()
      .record(
        KEY,
        { mth: "101.40", fuelRemainingL: 78 },
        { viaFlightLog: true },
      );
    const stop = start();
    await vi.waitFor(() => expect(api.airframes).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(api.addReading).not.toHaveBeenCalled();
    stop();
  });

  it("shows a lower MTH as a notice, not an error", async () => {
    useAircraftState.setState({
      states: { [KEY]: frame({ mth: "100", updatedAt: T }) },
    });
    const { api, notify, start } = setup();
    api.addReading.mockResolvedValue({
      reading: { id: "r" },
      warnings: [{ code: "mth_decreased", previous_mth: 120.5 }],
    });
    const stop = start();
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify.mock.calls[0]![0]).toMatchObject({
      kind: "mth_decreased",
      airframe: "SR20 SPABC",
      previousMth: 120.5,
    });
    stop();
  });

  it("does not send again what the server already holds (the import put it there)", async () => {
    useAircraftState.setState({
      states: {
        [KEY]: frame({ mth: "120.5", fuelRemainingL: 33, updatedAt: T }),
      },
    });
    const { api, start } = setup([
      serverAirframe({ mth: 120.5, fuel_remaining_l: 33 }),
    ]);
    const stop = start();
    await vi.waitFor(() => expect(api.airframes).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(api.addReading).not.toHaveBeenCalled();
    stop();
  });

  it("takes the server's newer reading, keeps a newer local one and sends it", async () => {
    // Server newer: another pilot flew the airframe.
    useAircraftState.setState({
      states: { [KEY]: frame({ mth: "100", updatedAt: T - 60_000 }) },
    });
    const newer = setup([
      serverAirframe({ mth: 130.25, fuel_remaining_l: 20 }),
    ]);
    let stop = newer.start();
    await vi.waitFor(() =>
      expect(useAircraftState.getState().states[KEY]).toMatchObject({
        mth: "00130.25",
        fuelRemainingL: 20,
        updatedAt: T,
      }),
    );
    expect(newer.api.addReading).not.toHaveBeenCalled();
    stop();

    // Local newer: it is not overwritten, it is sent.
    values.clear();
    useAircraftState.setState({
      states: { [KEY]: frame({ mth: "140", updatedAt: T + 60_000 }) },
    });
    const older = setup([serverAirframe({ mth: 130.25 })]);
    stop = older.start();
    await vi.waitFor(() =>
      expect(older.api.addReading).toHaveBeenCalledTimes(1),
    );
    expect(useAircraftState.getState().states[KEY]!.mth).toBe("140");
    expect(older.api.addReading.mock.calls[0]![1]).toMatchObject({ mth: 140 });
    stop();
  });

  it("learns airframes other pilots created, and the fuel indication mode", async () => {
    const { start } = setup([serverAirframe({ mth: 5 }, "estimated")]);
    const stop = start();
    await vi.waitFor(() =>
      expect(useAircraftState.getState().states[KEY]).toMatchObject({
        fuelIndicationMode: "estimated",
        mth: "00005.00",
      }),
    );
    stop();
  });

  it("sends the fuel indication mode as its own setting", async () => {
    const { api, start } = setup([serverAirframe(null)]);
    const stop = start();
    await vi.waitFor(() => expect(api.airframes).toHaveBeenCalled());
    useAircraftState.getState().setFuelIndicationMode(KEY, "exact");
    await vi.waitFor(
      () =>
        expect(api.setFuelIndicationMode).toHaveBeenCalledWith("af-1", "exact"),
      { timeout: 4000 },
    );
    expect(api.addReading).not.toHaveBeenCalled();
    stop();
  });

  it("drops a reading the server will never take, says so and does not retry it", async () => {
    useAircraftState.setState({
      states: { [KEY]: frame({ mth: "100", updatedAt: T }) },
    });
    const { api, report, start } = setup();
    api.addReading.mockRejectedValue(new UserDataError(422, "mth too large"));
    const stop = start();
    await vi.waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "idle",
          rejected: [`${KEY}: mth too large`],
        }),
      ),
    );
    expect(api.addReading).toHaveBeenCalledTimes(1);
    stop();
  });
});
