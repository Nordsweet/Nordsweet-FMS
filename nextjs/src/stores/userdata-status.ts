import { create } from "zustand";

type State = "idle" | "syncing" | "offline" | "error";
export type SourceStatus = {
  state: State;
  reason: string | null;
  pending: number;
  /** Local items the server refused; they stay on this device and are not retried until edited. */
  rejected: string[];
};

/** Non-blocking messages the pilot dismisses. */
export type Notice =
  | {
      id: string;
      kind: "mth_decreased";
      /** The airframe, "TYPE REG". */
      airframe: string;
      previousMth: number | null;
    }
  /** The server will never accept this flight log (deleted there, too large, invalid). */
  | { id: string; kind: "log_rejected"; status: number; detail: string };

type Store = {
  sources: Record<string, SourceStatus>;
  notices: Notice[];
  notify: (notice: Notice) => void;
  dismissNotice: (id: string) => void;
  /** What the first-sign-in import was told is invalid; shown until the pilot dismisses it. */
  importRejected: string[];
  report: (source: string, patch: Partial<SourceStatus>) => void;
  setImportRejected: (lines: string[]) => void;
  reset: () => void;
};

const blank: SourceStatus = {
  state: "idle",
  reason: null,
  pending: 0,
  rejected: [],
};

/** What the header shows about the typed user-data sync; written by the sync code, never persisted. */
export const useUserDataStatus = create<Store>()((set) => ({
  sources: {},
  notices: [],
  notify: (notice) =>
    set((s) => ({
      notices: [...s.notices.filter((n) => n.id !== notice.id), notice].slice(
        -5,
      ),
    })),
  dismissNotice: (id) =>
    set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  importRejected: [],
  report: (source, patch) =>
    set((s) => ({
      sources: {
        ...s.sources,
        [source]: { ...blank, ...s.sources[source], ...patch },
      },
    })),
  setImportRejected: (importRejected) => set({ importRejected }),
  reset: () => set({ sources: {}, notices: [], importRejected: [] }),
}));

const rank: Record<State, number> = {
  idle: 0,
  syncing: 1,
  offline: 2,
  error: 3,
};

/** One status out of all sources: the worst state, every pending item, every refused item. */
export function summarize(sources: Record<string, SourceStatus>): SourceStatus {
  const all = Object.values(sources);
  const worst = all.reduce<SourceStatus | null>(
    (a, b) => (!a || rank[b.state] > rank[a.state] ? b : a),
    null,
  );
  return {
    state: worst?.state ?? "idle",
    reason: worst?.reason ?? null,
    pending: all.reduce((n, s) => n + s.pending, 0),
    rejected: all.flatMap((s) => s.rejected),
  };
}

/** The more serious of two states, for one indicator over several syncs. */
export const worst = (a: State, b: State): State => (rank[b] > rank[a] ? b : a);
