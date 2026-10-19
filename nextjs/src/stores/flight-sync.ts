import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "~/api";
import { FlightSyncError } from "~/api/flight-sync";
import {
  flightSnapshotSchema,
  type PendingFlight,
} from "~/data/flight-session";
import { flightTrackName, recoveredFlight } from "~/domain/flight-session";
import { useFlight } from "./flight";
import { useInFlight } from "./inflight";

type SyncState = {
  token: string;
  pending: PendingFlight[];
  upload: PendingFlight | null;
  phase: "checking" | "prompt" | "ready";
  candidate: PendingFlight | null;
  busy: boolean;
  error: "offline" | "conflict" | null;
  lastSyncAt: number | null;
};

/** An acknowledged prefix plus a durable local outbox survives offline recording and abrupt app shutdown. */
export const useFlightSync = create<SyncState>()(
  persist(
    (): SyncState => ({
      token: "",
      pending: [],
      upload: null,
      phase: "checking",
      candidate: null,
      busy: false,
      error: null,
      lastSyncAt: null,
    }),
    {
      name: "nordsweet.flightSync.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, pending, upload }) => ({ token, pending, upload }),
    },
  ),
);

function replacePending(flight: PendingFlight) {
  useFlightSync.setState((s) => ({
    pending: [...s.pending.filter((p) => p.id !== flight.id), flight],
  }));
}

/** Capture only the fields already selected for durable in-flight persistence. */
export function captureFlight(): PendingFlight | null {
  const live = useInFlight.getState();
  const plan = useFlight.getState().flight;
  const current = useFlightSync.getState();
  const previous = current.pending.find((p) =>
    live.startedAt
      ? p.startedAt === live.startedAt
      : p.snapshot.inflight.startedAt !== null &&
        p.snapshot.inflight.debrief?.flightId === live.debrief?.flightId,
  );
  if (!live.startedAt && (!previous || !live.debrief?.endedAt)) return null;
  const startedAt = live.startedAt ?? previous!.startedAt;
  const registration =
    previous?.registration ?? live.debrief?.registration ?? plan.registration;
  const snapshot = flightSnapshotSchema.parse({
    flight:
      previous && previous.snapshot.flight.id !== plan.id
        ? previous.snapshot.flight
        : plan,
    inflight: live,
  });
  const next: PendingFlight = {
    id: previous?.id ?? crypto.randomUUID(),
    name: previous?.name ?? flightTrackName(registration, startedAt),
    startedAt,
    registration,
    revision: previous?.revision ?? 0,
    trackCount: previous?.trackCount ?? 0,
    snapshot,
    track: live.track,
  };
  if (JSON.stringify(previous) !== JSON.stringify(next)) replacePending(next);
  return next;
}

/** Read before allowing GPS/timers to mutate the recovered session. No server write precedes the pilot's choice. */
export async function checkPreviousFlight() {
  const state = useFlightSync.getState();
  if (!state.token) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    useFlightSync.setState({
      token: Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join(""),
    });
  }
  const local = captureFlight();
  let candidate = local?.snapshot.inflight.startedAt ? local : null;
  try {
    const token = useFlightSync.getState().token;
    const remote = await api.flightSync.latest.call(token);
    if (remote && (!candidate || remote.startedAt >= candidate.startedAt)) {
      const pending = useFlightSync
        .getState()
        .pending.find((p) => p.id === remote.id);
      // End/No may still be queued offline: do not offer the older active server revision again.
      candidate =
        pending?.snapshot.inflight.startedAt === null
          ? null
          : recoveredFlight(remote, pending);
    } else if (candidate) {
      const existing = await api.flightSync.get.call({
        token,
        id: candidate.id,
      });
      if (existing.ended) {
        // A different tab explicitly ended this flight; never resurrect its stale active state.
        useInFlight.getState().end();
        candidate = null;
      }
    }
  } catch (error) {
    if (!(error instanceof FlightSyncError && error.status === 404))
      useFlightSync.setState({ error: "offline" });
  }
  useFlightSync.setState({ candidate, phase: candidate ? "prompt" : "ready" });
}

export async function continuePreviousFlight() {
  const { candidate, token } = useFlightSync.getState();
  if (!candidate) return;
  useFlightSync.setState({ busy: true });
  let flight = candidate;
  try {
    const remote = await api.flightSync.get.call({ token, id: candidate.id });
    if (remote.ended) {
      useFlightSync.setState({ busy: false, error: "conflict" });
      return;
    }
    flight = recoveredFlight(remote, candidate);
    const upload = useFlightSync.getState().upload;
    useFlightSync.setState({
      error: null,
      ...(upload?.id === remote.id && upload.revision < remote.revision
        ? { upload: null }
        : {}),
    });
  } catch (error) {
    if (!(error instanceof FlightSyncError && error.status === 404))
      useFlightSync.setState({ error: "offline" });
  }
  useFlight.getState().load(flight.snapshot.flight);
  useInFlight.setState({
    ...flight.snapshot.inflight,
    track: flight.track,
    patternNotice: null,
    patternPreviousFix: null,
  });
  replacePending(flight);
  useFlightSync.setState({ phase: "ready", candidate: null, busy: false });
}

/** Declining archives the checkpoint, including any unsent local tail; it never deletes its server track. */
export function declinePreviousFlight() {
  const candidate = useFlightSync.getState().candidate;
  if (candidate) {
    replacePending({
      ...candidate,
      snapshot: {
        ...candidate.snapshot,
        inflight: {
          ...candidate.snapshot.inflight,
          startedAt: null,
          debrief: candidate.snapshot.inflight.debrief
            ? { ...candidate.snapshot.inflight.debrief, endedAt: Date.now() }
            : null,
        },
      },
    });
  }
  if (useInFlight.getState().startedAt) useInFlight.getState().end();
  useFlightSync.setState({ phase: "ready", candidate: null, busy: false });
}

let sending = false;
export async function flushFlights(keepalive = false) {
  const state = useFlightSync.getState();
  if (sending || state.phase !== "ready" || state.error === "conflict") return;
  sending = true;
  try {
    const flights = state.upload
      ? [
          state.upload,
          ...state.pending.filter((p) => p.id !== state.upload!.id),
        ]
      : state.pending;
    for (const flight of flights) {
      // Persist the exact request before sending: a lost acknowledgement is replayed byte-for-byte.
      useFlightSync.setState({ upload: flight });
      const ack = await api.flightSync.save.call({
        token: state.token,
        flight,
        keepalive,
      });
      if (!ack) {
        // An oversized keepalive must not erase a request whose earlier acknowledgement was lost.
        return;
      }
      useFlightSync.setState((s) => ({
        pending: s.pending.flatMap((latest) =>
          latest.id !== flight.id
            ? [latest]
            : !latest.snapshot.inflight.startedAt &&
                ack.trackCount === latest.track.length &&
                JSON.stringify(latest.snapshot) ===
                  JSON.stringify(flight.snapshot)
              ? []
              : [
                  {
                    ...latest,
                    revision: ack.revision,
                    trackCount: ack.trackCount,
                  },
                ],
        ),
        error: null,
        upload: null,
        lastSyncAt: Date.now(),
      }));
    }
  } catch (error) {
    useFlightSync.setState({
      error:
        error instanceof FlightSyncError && error.status === 409
          ? "conflict"
          : "offline",
    });
  } finally {
    sending = false;
  }
}

/** One writer per mounted app; fresh points trigger uploads and periodic retries cover interrupted requests. */
export function startFlightSync() {
  let stopped = false;
  let queued: ReturnType<typeof setTimeout> | undefined;
  const capture = () => {
    if (useFlightSync.getState().phase !== "ready") return;
    captureFlight();
    clearTimeout(queued);
    queued = setTimeout(() => {
      void flushFlights();
    }, 250);
  };
  const unsubscribeFlight = useFlight.subscribe(capture);
  const unsubscribeInFlight = useInFlight.subscribe(capture);
  const retry = setInterval(() => {
    capture();
    void flushFlights();
  }, 5000);
  const final = () => {
    capture();
    void flushFlights(true);
  };
  const visible = () => {
    if (document.visibilityState === "hidden") final();
  };
  window.addEventListener("pagehide", final);
  window.addEventListener("online", final);
  document.addEventListener("visibilitychange", visible);
  void checkPreviousFlight().then(() => {
    if (!stopped) capture();
  });
  return () => {
    stopped = true;
    clearTimeout(queued);
    clearInterval(retry);
    unsubscribeFlight();
    unsubscribeInFlight();
    window.removeEventListener("pagehide", final);
    window.removeEventListener("online", final);
    document.removeEventListener("visibilitychange", visible);
  };
}
