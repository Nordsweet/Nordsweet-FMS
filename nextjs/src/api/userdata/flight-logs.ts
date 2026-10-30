import { createStore, del, entries, get, keys, set } from "idb-keyval";

import { type Debrief } from "~/data/debrief";
import { debriefStatistics } from "~/domain/debrief";
import { type NavPoint } from "~/domain/progress";
import { type TrackPoint } from "~/domain/track";
import { aircraftStateKey, useAircraftState } from "~/stores/aircraft-state";
import { type EmergencySession, useEmergency } from "~/stores/emergency";
import { useInFlight } from "~/stores/inflight";
import { type Notice, type SourceStatus } from "~/stores/userdata-status";

import { retryable } from "./airframes";
import { type UserDataApi, UserDataError } from "./client";
import { backoff, wakeOnReturn } from "./wake";

/** docs/API.md, "Flight logs": at most 100 000 track points and 12 MiB of JSON per request. */
export const MAX_TRACK_POINTS = 100_000;
const MAX_BODY_BYTES = 11 * 1024 * 1024; // under the 12 MiB cap, with room for the rest of the body
const MAX_SESSIONS = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FlightLogSource = {
  /** An accepted debrief. */
  debrief: Debrief;
  /** `startedAt` of the flight in progress, for a debrief that predates its own copy. */
  startedAt: string | null;
  track: TrackPoint[];
  route: NavPoint[];
  patternReports: unknown[];
  emergencySessions: EmergencySession[];
};

/** An empty string counts as missing (a debrief's `startedAt` defaults to ""). */
const nonEmpty = (value: string | null | undefined) =>
  value?.length ? value : undefined;
const iso = (ms: number | null | undefined) =>
  typeof ms === "number" && Number.isFinite(ms)
    ? new Date(ms).toISOString()
    : undefined;
const validIso = (text: string | null | undefined) =>
  text && Number.isFinite(Date.parse(text))
    ? new Date(text).toISOString()
    : undefined;

/** Even thinning that keeps the first and the last fix. */
export function thinTrack<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]!);
}

/** Emergency sessions of this flight that are over: the scope names the flight and its start. */
export function finishedSessions(
  sessions: EmergencySession[],
  debrief: Debrief,
  startedAt: string | null,
) {
  const start = nonEmpty(debrief.startedAt) ?? startedAt;
  return sessions
    .filter(
      (s) =>
        s.endedAt !== null &&
        !s.previewOnly &&
        s.scope.startsWith(`${debrief.flightId}|`) &&
        (!start || s.scope.endsWith(`|${start}`)),
    )
    .slice(-MAX_SESSIONS);
}

/** The body of `POST /flight-logs` for an accepted debrief; `reading` is that debrief as an airframe reading. */
export function flightLogBody(
  source: FlightLogSource,
  id: string,
): Record<string, unknown> {
  const { debrief } = source;
  const accepted = debrief.accepted;
  const endedAt = iso(debrief.endedAt) ?? iso(accepted?.at);
  const startedAt =
    validIso(debrief.startedAt) ?? validIso(source.startedAt) ?? endedAt;
  const type = debrief.aircraftType?.trim().slice(0, 32);
  const body: Record<string, unknown> = {
    id,
    flight_id: UUID.test(debrief.flightId) ? debrief.flightId : undefined,
    aircraft_type: nonEmpty(type),
    registration: debrief.registration.slice(0, 32),
    started_at: startedAt,
    ended_at: endedAt,
    off_block_at: iso(debrief.times.offBlockAt),
    takeoff_at: iso(debrief.times.takeoffAt),
    landing_at: iso(debrief.times.landingAt),
    on_block_at: iso(debrief.times.onBlockAt),
    mth_before: debrief.mthBefore ?? undefined,
    mth_after: accepted?.mthAfter,
    fuel_before_l: debrief.fuelBeforeL ?? undefined,
    fuel_after_l: accepted?.fuelAfterL,
    debrief,
    pattern_reports: source.patternReports,
    route: source.route,
    track: thinTrack(source.track, MAX_TRACK_POINTS),
    emergency_sessions: finishedSessions(
      source.emergencySessions,
      debrief,
      source.startedAt,
    ).map((s) => ({
      id: s.id,
      family: s.family.slice(0, 32),
      phase: s.phase?.slice(0, 32) ?? undefined,
      outcome: s.outcome,
      opened_at: iso(s.openedAt),
      ended_at: iso(s.endedAt),
      session: s,
    })),
    reading:
      type && accepted
        ? {
            recorded_at: iso(accepted.at),
            mth: accepted.mthAfter,
            fuel_remaining_l: accepted.fuelAfterL,
            fuel_used_l: debriefStatistics(debrief).fuelUsedL ?? undefined,
            fuel_added_l: 0,
          }
        : undefined,
  };
  // A started_at after the end (a clock set back) would be refused as a whole.
  if (
    typeof body.started_at === "string" &&
    typeof body.ended_at === "string" &&
    body.started_at > body.ended_at
  )
    body.started_at = body.ended_at;
  // Too much track for one request: thin it until it fits, rather than lose the log.
  let track = body.track as TrackPoint[];
  while (track.length > 2 && JSON.stringify(body).length > MAX_BODY_BYTES) {
    track = thinTrack(track, Math.floor(track.length / 2));
    body.track = track;
  }
  return body;
}

/** The identity of a flight session: one log per session, whatever happens to its debrief later. */
export const sessionKey = (debrief: Debrief) =>
  `${nonEmpty(debrief.sessionId) ?? debrief.flightId}|${debrief.startedAt}`;

type Store = ReturnType<typeof createStore>;
type Done = { logId: string; at: number };

export function startFlightLogs({
  api,
  username,
  report,
  notify,
  posted = () => undefined,
}: {
  api: Pick<UserDataApi, "postFlightLog">;
  username: string;
  report: (patch: Partial<SourceStatus>) => void;
  notify: (notice: Notice) => void;
  posted?: () => void;
}) {
  const db: Store = createStore(`nordsweet-flight-logs-${username}`, "logs");
  let stopped = false;
  /** Session key → the acceptance already handled (its log id is in IndexedDB). */
  const handled = new Map<string, number>();
  let unsubscribe = () => undefined as void;
  let unwake = () => undefined as void;

  async function pending() {
    return (await entries<string, Record<string, unknown>>(db))
      .filter(([key]) => String(key).startsWith("log:"))
      .map(([, body]) => body)
      .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
  }

  const retry = backoff(() => void flush());
  let running: Promise<void> | null = null;
  let again = false;
  const flush = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        let queue = await pending();
        report({ pending: queue.length });
        for (const body of queue) {
          try {
            await api.postFlightLog(body);
            await del(`log:${String(body.id)}`, db);
            posted();
          } catch (error) {
            if (retryable(error)) throw error;
            // 409 (deleted there), 413, 422: this body can never succeed. Say so; do not loop.
            const e = error as UserDataError;
            await del(`log:${String(body.id)}`, db);
            notify({
              id: `log_rejected:${String(body.id)}`,
              kind: "log_rejected",
              status: e.status,
              detail: e.message,
            });
          }
          queue = await pending();
          report({ pending: queue.length });
        }
        report({ state: "idle", reason: null, pending: 0 });
        retry.ok();
      } catch (error) {
        // Not for 401/403 (signed out) or 429: the next wake-up or start tries again.
        const offline =
          error instanceof UserDataError &&
          (error.status === 0 || error.status >= 500);
        report({
          state: offline ? "offline" : "error",
          reason: error instanceof Error ? error.message : "unknown",
        });
        if (offline) retry.failed();
      }
    })().finally(() => {
      running = null;
      if (!again) return;
      again = false;
      void flush();
    });
    return running;
  };

  /** A later acceptance of the same flight is a correction: its reading goes the ordinary way. */
  const uncover = (debrief: Debrief) => {
    if (!debrief.aircraftType) return;
    const key = aircraftStateKey(debrief.aircraftType, debrief.registration);
    queueMicrotask(() =>
      useAircraftState.setState((s) => {
        const { [key]: _, ...covered } = s.covered;
        return { covered };
      }),
    );
  };

  function observe() {
    const state = useInFlight.getState();
    const debrief = state.debrief;
    if (!debrief?.accepted) return;
    const key = sessionKey(debrief);
    const at = debrief.accepted.at;
    const before = handled.get(key);
    if (before === at) return;
    handled.set(key, at);
    if (before !== undefined) return uncover(debrief);
    const body = flightLogBody(
      {
        debrief,
        startedAt: state.startedAt,
        track: state.track,
        route: state.route,
        patternReports: state.patternReports,
        emergencySessions: [
          ...useEmergency.getState().history,
          ...(useEmergency.getState().session
            ? [useEmergency.getState().session!]
            : []),
        ],
      },
      crypto.randomUUID(),
    );
    void (async () => {
      await set(`log:${String(body.id)}`, body, db);
      await set(
        `done:${key}`,
        { logId: String(body.id), at } satisfies Done,
        db,
      );
      void flush();
    })();
  }

  void (async () => {
    for (const key of await keys(db)) {
      if (typeof key !== "string" || !key.startsWith("done:")) continue;
      const done = await get<Done>(key, db);
      if (done) handled.set(key.slice(5), done.at);
    }
    if (stopped) return;
    // Handled sessions are known first: a flight accepted before this started is logged once, not twice.
    observe();
    unsubscribe = useInFlight.subscribe(observe);
    unwake = wakeOnReturn(() => void flush());
    void flush();
  })();

  return () => {
    stopped = true;
    retry.stop();
    unsubscribe();
    unwake();
  };
}
