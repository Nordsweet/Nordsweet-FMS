import { formatMth, normalizeRegistration } from "~/domain/aircraft";
import {
  type AircraftState,
  emptyAircraftState,
  useAircraftState,
} from "~/stores/aircraft-state";
import { type Notice, type SourceStatus } from "~/stores/userdata-status";

import { same } from "../sync/merge";
import { type UserDataApi, UserDataError } from "./client";
import { mthNumber, parseStateKey } from "./import";
import { type Airframe, type Warning } from "./schemas";
import { backoff, wakeOnReturn } from "./wake";

type Mode = "exact" | "estimated";
/** An airframe's state as numbers, so the text formatting of MTH never counts as a change. */
type Snap = {
  mode: Mode | null;
  mth: number | null;
  remaining: number | null;
  added: number | null;
  used: number | null;
};
type Entry =
  | {
      kind: "reading";
      key: string;
      id: string;
      recordedAt: string;
      values: Omit<Snap, "mode">;
      /** A request may have reached the server: the content must not change under this id any more. */
      attempted: boolean;
    }
  | { kind: "mode"; key: string; mode: Mode | null };
type Saved = {
  /** Canonical key → the server's airframe id. */
  ids: Record<string, string>;
  /** Canonical key → the state this device has accounted for (sent, queued or received). */
  base: Record<string, Snap>;
  outbox: Entry[];
};

const snapOf = (s: AircraftState): Snap => ({
  mode: s.fuelIndicationMode,
  mth: mthNumber(s.mth),
  remaining: s.fuelRemainingL,
  added: s.fuelAddedL,
  used: s.fuelUsedL,
});
const valuesOf = ({ mode: _, ...values }: Snap) => values;
const hasValues = (s: Omit<Snap, "mode">) =>
  [s.mth, s.remaining, s.added, s.used].some((v) => v !== null);

/** The server upper-cases the type and strips the registration; local keys may differ in case only. */
export const canonicalKey = (key: string) => {
  const parsed = parseStateKey(key);
  return parsed
    ? `${parsed.type.trim().toUpperCase()}::${normalizeRegistration(parsed.registration)}`
    : key;
};
const serverKey = (a: Airframe) => `${a.type}::${a.registration || "DEFAULT"}`;

const readingBody = (e: Extract<Entry, { kind: "reading" }>) => ({
  id: e.id,
  recorded_at: e.recordedAt,
  mth: e.values.mth,
  fuel_remaining_l: e.values.remaining,
  fuel_added_l: e.values.added,
  fuel_used_l: e.values.used,
  source: "manual",
});

/** Transient trouble (no connection, server fault, rate limit, signed out): keep the entry and try again later. */
export const retryable = (error: unknown) =>
  !(error instanceof UserDataError) ||
  [0, 401, 403, 429].includes(error.status) ||
  error.status >= 500;

export function startAirframeSync({
  api,
  username,
  report,
  notify,
  store = useAircraftState,
}: {
  api: Pick<
    UserDataApi,
    "airframes" | "resolveAirframe" | "addReading" | "setFuelIndicationMode"
  >;
  username: string;
  report: (patch: Partial<SourceStatus>) => void;
  notify: (notice: Notice) => void;
  store?: typeof useAircraftState;
}) {
  const storageKey = `nordsweet.airframes.${username}.v1`;
  const load = (): Saved => {
    try {
      const value = JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      ) as Partial<Saved> | null;
      return {
        ids: value?.ids ?? {},
        base: value?.base ?? {},
        outbox: value?.outbox ?? [],
      };
    } catch {
      return { ids: {}, base: {}, outbox: [] };
    }
  };
  const saved = load();
  const persist = () => localStorage.setItem(storageKey, JSON.stringify(saved));

  const fetchAll = async () => {
    const all: Airframe[] = [];
    for (let offset = 0; ; offset = all.length) {
      const page = await api.airframes(offset);
      all.push(...page.items);
      if (!page.has_more || !page.items.length) return all;
    }
  };
  const serverSnap = (a: Airframe): Snap => ({
    mode: a.fuel_indication_mode,
    mth: a.state?.mth ?? null,
    remaining: a.state?.fuel_remaining_l ?? null,
    added: a.state?.fuel_added_l ?? null,
    used: a.state?.fuel_used_l ?? null,
  });

  /** A key this device never accounted for whose values the server already holds (the import put them there). */
  function seedBase(server: Airframe[]) {
    const { states } = store.getState();
    for (const a of server) {
      const c = canonicalKey(serverKey(a));
      saved.ids[c] = a.id;
      const key = Object.keys(states).find((k) => canonicalKey(k) === c);
      if (!key || saved.base[c]) continue;
      if (same(valuesOf(snapOf(states[key]!)), valuesOf(serverSnap(a))))
        saved.base[c] = {
          ...snapOf(states[key]!),
          mode: a.fuel_indication_mode,
        };
    }
  }

  /** Local changes since the last agreement become outbox entries (also edits made while the app was closed). */
  function scan() {
    const { states, covered } = store.getState();
    for (const [key, state] of Object.entries(states)) {
      if (!parseStateKey(key)) continue;
      const c = canonicalKey(key);
      const now = snapOf(state);
      const before = saved.base[c];
      if (before && same(before, now)) continue;
      const carriedByLog =
        state.updatedAt !== null && covered[key] === state.updatedAt;
      if (
        !carriedByLog &&
        hasValues(now) &&
        !(before && same(valuesOf(before), valuesOf(now)))
      ) {
        const values = valuesOf(now);
        const last = [...saved.outbox]
          .reverse()
          .find((e) => e.kind === "reading" && canonicalKey(e.key) === c);
        if (last?.kind === "reading" && !last.attempted) {
          last.values = values;
          last.recordedAt = new Date(
            state.updatedAt ?? Date.now(),
          ).toISOString();
        } else
          saved.outbox.push({
            kind: "reading",
            key,
            id: crypto.randomUUID(),
            recordedAt: new Date(state.updatedAt ?? Date.now()).toISOString(),
            values,
            attempted: false,
          });
      }
      if ((before?.mode ?? null) !== now.mode) {
        saved.outbox = saved.outbox.filter(
          (e) => !(e.kind === "mode" && canonicalKey(e.key) === c),
        );
        saved.outbox.push({ kind: "mode", key, mode: now.mode });
      }
      saved.base[c] = now;
    }
    persist();
  }

  /** The server's state wins where this device has nothing waiting and nothing newer. */
  function applyServer(server: Airframe[]) {
    const { states } = store.getState();
    const next = { ...states };
    let changed = false;
    for (const a of server) {
      const c = canonicalKey(serverKey(a));
      if (saved.outbox.some((e) => canonicalKey(e.key) === c)) continue;
      const key =
        Object.keys(states).find((k) => canonicalKey(k) === c) ?? serverKey(a);
      const local = states[key] ?? emptyAircraftState;
      const serverNewer =
        !a.state ||
        local.updatedAt === null ||
        local.updatedAt <= Date.parse(a.state.recorded_at);
      const snap = serverSnap(a);
      const updated: AircraftState = {
        ...local,
        fuelIndicationMode: snap.mode,
        ...(a.state && serverNewer
          ? {
              mth: snap.mth === null ? "" : (formatMth(String(snap.mth)) ?? ""),
              fuelRemainingL: snap.remaining,
              fuelAddedL: snap.added,
              fuelUsedL: snap.used,
              updatedAt: Date.parse(a.state.recorded_at),
            }
          : {}),
      };
      if (!states[key] && !a.state && snap.mode === null) continue;
      saved.base[c] = snapOf(updated);
      if (!same(updated, local) || !states[key]) {
        next[key] = updated;
        changed = true;
      }
    }
    if (changed) store.setState({ states: next });
    persist();
  }

  async function airframeId(key: string) {
    const c = canonicalKey(key);
    const known = saved.ids[c];
    if (known) return known;
    const parsed = parseStateKey(key);
    if (!parsed) throw new UserDataError(422, `Bad airframe key ${key}`);
    const created = await api.resolveAirframe(parsed);
    saved.ids[c] = created.id;
    persist();
    return created.id;
  }

  async function push(rejected: string[]) {
    while (saved.outbox.length) {
      const entry = saved.outbox[0]!;
      try {
        const id = await airframeId(entry.key);
        if (entry.kind === "reading") {
          entry.attempted = true;
          persist();
          const result = await api.addReading(id, readingBody(entry));
          warn(entry.key, entry.id, result.warnings);
        } else await api.setFuelIndicationMode(id, entry.mode);
      } catch (error) {
        if (retryable(error)) throw error;
        // Refused for good (invalid or not ours): drop it and tell the pilot, never retry silently.
        rejected.push(`${entry.key}: ${(error as Error).message}`);
      }
      saved.outbox.shift();
      persist();
    }
  }

  function warn(key: string, readingId: string, warnings: Warning[]) {
    for (const w of warnings)
      if (w.code === "mth_decreased")
        notify({
          id: `mth_decreased:${readingId}`,
          kind: "mth_decreased",
          airframe: key.replace("::", " ").replace(/ DEFAULT$/, ""),
          previousMth: w.previous_mth ?? null,
        });
  }

  const retry = backoff(() => void sync());
  let running: Promise<void> | null = null;
  let again = false;
  const sync = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      const rejected: string[] = [];
      report({ state: "syncing", reason: null });
      try {
        const server = await fetchAll();
        seedBase(server);
        scan();
        applyServer(server);
        await push(rejected);
        report({
          state: "idle",
          reason: null,
          pending: 0,
          rejected,
        });
        retry.ok();
      } catch (error) {
        const offline =
          error instanceof UserDataError &&
          (error.status === 0 || error.status >= 500);
        report({
          state: offline ? "offline" : "error",
          reason: error instanceof Error ? error.message : "unknown",
          pending: saved.outbox.length,
          rejected,
        });
        if (offline) retry.failed();
      }
    })().finally(() => {
      running = null;
      if (!again) return;
      again = false;
      void sync();
    });
    return running;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.states === previous.states) return;
    clearTimeout(timer);
    timer = setTimeout(() => void sync(), 1000);
  });
  const unwake = wakeOnReturn(() => void sync());
  void sync();
  return () => {
    clearTimeout(timer);
    retry.stop();
    unsubscribe();
    unwake();
  };
}
