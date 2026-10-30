import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.hoisted(() => new Map<string, string>());
const idb = vi.hoisted(() => new Map<string, unknown>());
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
// One database is enough: a test runs one user.
vi.mock("idb-keyval", () => ({
  createStore: vi.fn(),
  get: async (key: string) => idb.get(key),
  set: async (key: string, value: unknown) => void idb.set(key, value),
  del: async (key: string) => void idb.delete(key),
  keys: async () => [...idb.keys()],
  entries: async () => [...idb.entries()],
}));

import { type Debrief } from "~/data/debrief";
import { aircraftStateKey, useAircraftState } from "~/stores/aircraft-state";
import { type EmergencySession, useEmergency } from "~/stores/emergency";
import { useInFlight } from "~/stores/inflight";

import { UserDataError } from "./client";
import {
  MAX_TRACK_POINTS,
  flightLogBody,
  startFlightLogs,
  thinTrack,
} from "./flight-logs";

const FLIGHT = "2f6d7a52-8f55-4d9a-a1d0-6f2c9f0d9b11";
const START = "2026-10-20T10:00:00.000Z";
const T = Date.UTC(2026, 9, 20, 10); // 2026-10-20T10:00:00Z

const debrief = (patch: Partial<Debrief> = {}): Debrief => ({
  sessionId: "session-1",
  startedAt: START,
  username: "pilot",
  pic: "Nowak",
  departure: "EPKK",
  arrival: "EPML",
  flightId: FLIGHT,
  name: "KK-ML",
  aircraftType: "P2006T",
  registration: "SPXYZ",
  mthBefore: 100.5,
  fuelBeforeL: 120,
  endedAt: T + 3_600_000,
  times: {
    offBlockAt: T + 60_000,
    onBlockAt: T + 3_540_000,
    takeoffAt: T + 300_000,
    landingAt: T + 3_300_000,
  },
  accepted: { mthAfter: 101.4, fuelAfterL: 78, at: T + 3_700_000 },
  ...patch,
});
const track = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    lat: 50 + i / 1000,
    lon: 19,
    altitudeFt: i % 2 ? null : 2000,
    time: new Date(T + i * 1000).toISOString(),
  }));
const session = (patch: Partial<EmergencySession>): EmergencySession =>
  ({
    id: "c0a80101-0000-4000-8000-000000000001",
    scope: `${FLIGHT}|none|SPXYZ|${START}`,
    openedAt: T + 1_000_000,
    endedAt: T + 1_200_000,
    family: "engine",
    phase: "cruise",
    previewOnly: false,
    outcome: "landing",
    ...patch,
  }) as EmergencySession;

// Everything LogIn accepts (docs/API.md); the model forbids any other key.
const ALLOWED = new Set([
  "id",
  "flight_id",
  "airframe_id",
  "aircraft_type",
  "registration",
  "started_at",
  "ended_at",
  "off_block_at",
  "takeoff_at",
  "landing_at",
  "on_block_at",
  "mth_before",
  "mth_after",
  "fuel_before_l",
  "fuel_after_l",
  "debrief",
  "pattern_reports",
  "route",
  "track",
  "emergency_sessions",
  "reading",
]);

describe("flightLogBody", () => {
  const source = {
    debrief: debrief(),
    startedAt: START,
    track: track(3),
    route: [{ ident: "EPKK", lat: 50, lon: 19.8 }] as never,
    patternReports: [{ airport: "EPML" }],
    emergencySessions: [
      session({}),
      session({ id: "c0a80101-0000-4000-8000-000000000002", endedAt: null }), // still open
      session({
        id: "c0a80101-0000-4000-8000-000000000003",
        previewOnly: true,
      }),
      session({
        id: "c0a80101-0000-4000-8000-000000000004",
        scope: `another-flight|none|SPXYZ|${START}`,
      }),
    ],
  };

  it("carries the accepted debrief, the track as it is and the reading, and nothing the server forbids", () => {
    const body = flightLogBody(source, "log-1");
    expect(
      Object.keys(body)
        .filter((k) => body[k] !== undefined)
        .every((k) => ALLOWED.has(k)),
    ).toBe(true);
    expect(body).toMatchObject({
      id: "log-1",
      flight_id: FLIGHT,
      aircraft_type: "P2006T",
      registration: "SPXYZ",
      started_at: START,
      ended_at: "2026-10-20T11:00:00.000Z",
      off_block_at: "2026-10-20T10:01:00.000Z",
      takeoff_at: "2026-10-20T10:05:00.000Z",
      landing_at: "2026-10-20T10:55:00.000Z",
      on_block_at: "2026-10-20T10:59:00.000Z",
      mth_before: 100.5,
      mth_after: 101.4,
      fuel_before_l: 120,
      fuel_after_l: 78,
      pattern_reports: [{ airport: "EPML" }],
      reading: {
        recorded_at: new Date(T + 3_700_000).toISOString(),
        mth: 101.4,
        fuel_remaining_l: 78,
        fuel_used_l: 42,
        fuel_added_l: 0,
      },
    });
    expect(body.track).toEqual(source.track); // not reshaped
    expect(body.debrief).toBe(source.debrief);
  });

  it("sends only this flight's finished emergency sessions", () => {
    const sessions = flightLogBody(source, "log-1").emergency_sessions as {
      id: string;
      outcome: string;
      opened_at: string;
    }[];
    expect(sessions.map((s) => s.id)).toEqual([
      "c0a80101-0000-4000-8000-000000000001",
    ]);
    expect(sessions[0]).toMatchObject({
      family: "engine",
      phase: "cruise",
      outcome: "landing",
    });
  });

  it("leaves out what the server would refuse: a non-UUID flight id, no reading without an aircraft type", () => {
    const body = flightLogBody(
      {
        ...source,
        debrief: debrief({ flightId: "legacy-17", aircraftType: null }),
      },
      "log-2",
    );
    expect(body.flight_id).toBeUndefined();
    expect(body.aircraft_type).toBeUndefined();
    expect(body.reading).toBeUndefined();
  });

  it("falls back to the flight's start for a debrief without its own, and never starts after it ends", () => {
    expect(
      flightLogBody({ ...source, debrief: debrief({ startedAt: "" }) }, "x")
        .started_at,
    ).toBe(START);
    expect(
      flightLogBody(
        {
          ...source,
          debrief: debrief({ startedAt: "2026-10-21T00:00:00.000Z" }),
        },
        "x",
      ).started_at,
    ).toBe("2026-10-20T11:00:00.000Z");
  });

  it("thins a track over the point limit instead of losing the log, keeping the first and last fix", () => {
    const long = track(MAX_TRACK_POINTS + 5000);
    const thin = flightLogBody({ ...source, track: long }, "x")
      .track as unknown[];
    expect(thin).toHaveLength(MAX_TRACK_POINTS);
    expect(thin[0]).toBe(long[0]);
    expect(thin.at(-1)).toBe(long.at(-1));
    expect(thinTrack([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });
});

describe("one POST per flight", () => {
  beforeEach(() => {
    values.clear();
    idb.clear();
    useInFlight.setState({
      debrief: null,
      startedAt: START,
      track: track(4),
      route: [],
      patternReports: [],
    });
    useAircraftState.setState({ states: {}, covered: {} });
    useEmergency.setState({ session: null, history: [] });
  });

  const start = (postFlightLog: ReturnType<typeof vi.fn>) =>
    startFlightLogs({
      api: { postFlightLog } as never,
      username: "pilot",
      report: () => undefined,
      notify: () => undefined,
    });
  const ok = () =>
    vi.fn(async (_body: Record<string, unknown>) => ({
      log: { id: "x" },
      created: true,
      warnings: [],
    }));

  it("posts the accepted debrief once, however often the flight state changes, and not again after a restart", async () => {
    const post = ok();
    let stop = start(post);
    await new Promise((r) => setTimeout(r, 10)); // the stored list of handled flights loads first
    useInFlight.setState({ debrief: debrief() });
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    useInFlight.setState({ track: track(6) }); // GPS keeps ticking
    useInFlight.setState({ activeLeg: 2 });
    await new Promise((r) => setTimeout(r, 20));
    expect(post).toHaveBeenCalledTimes(1);

    const body = post.mock.calls[0]![0];
    expect(body).toMatchObject({
      flight_id: FLIGHT,
      mth_after: 101.4,
      reading: { mth: 101.4, fuel_used_l: 42 },
    });
    expect((body.track as unknown[]).length).toBe(4); // the track at acceptance

    stop();
    stop = start(post); // reload
    await new Promise((r) => setTimeout(r, 30));
    expect(post).toHaveBeenCalledTimes(1);
    stop();
  });

  it("keeps the log queued while offline and retries it with the same id", async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(new UserDataError(0, "Network unavailable"))
      .mockResolvedValue({ log: { id: "x" }, created: true, warnings: [] });
    const stop = start(post);
    await new Promise((r) => setTimeout(r, 10));
    useInFlight.setState({ debrief: debrief() });
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect([...idb.keys()].some((k) => String(k).startsWith("log:"))).toBe(
      true,
    );

    stop();
    const second = start(post); // back online: the next start flushes
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const ids = post.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(ids[1]).toBe(ids[0]);
    await vi.waitFor(() =>
      expect([...idb.keys()].some((k) => String(k).startsWith("log:"))).toBe(
        false,
      ),
    );
    second();
  });

  it("tells the pilot when the server will never take the log, and does not retry it", async () => {
    const notify = vi.fn();
    const post = vi
      .fn()
      .mockRejectedValue(new UserDataError(409, "This log was deleted"));
    const stop = startFlightLogs({
      api: { postFlightLog: post },
      username: "pilot",
      report: () => undefined,
      notify,
    });
    await new Promise((r) => setTimeout(r, 10));
    useInFlight.setState({ debrief: debrief() });
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify.mock.calls[0]![0]).toMatchObject({
      kind: "log_rejected",
      status: 409,
      detail: "This log was deleted",
    });
    expect([...idb.keys()].some((k) => String(k).startsWith("log:"))).toBe(
      false,
    );
    stop();
  });

  it("a corrected acceptance of the same flight is no new log; its reading goes the ordinary way", async () => {
    const post = ok();
    const stop = start(post);
    await new Promise((r) => setTimeout(r, 10));
    const key = aircraftStateKey("P2006T", "SPXYZ");
    useInFlight.setState({ debrief: debrief() });
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    useAircraftState.setState({ covered: { [key]: 123 } }); // the first acceptance's record
    useInFlight.setState({
      debrief: debrief({
        accepted: { mthAfter: 101.6, fuelAfterL: 77, at: T + 4_000_000 },
      }),
    });
    await vi.waitFor(() =>
      expect(useAircraftState.getState().covered).toEqual({}),
    );
    expect(post).toHaveBeenCalledTimes(1);
    stop();
  });
});
