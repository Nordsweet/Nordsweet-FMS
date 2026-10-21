import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type LogbookEntry } from "~/data/logbook";

type CachedEntry = {
  entry: LogbookEntry;
  dirty: boolean;
  summaryDirty?: boolean;
  picEdit: string | null;
};
type Account = Record<string, CachedEntry>;
type State = {
  accounts: Record<string, Account>;
  legacyOwners: Record<string, string>;
  status: Record<string, "loading" | "ready" | "offline">;
  put: (username: string, entry: LogbookEntry, remote?: boolean) => void;
  editPic: (username: string, id: string, pic: string) => void;
};

/** Account buckets and a durable outbox retain completed flights after Fly clears its checkpoint queue. */
export const useLogbook = create<State>()(
  persist(
    (set) => ({
      accounts: {},
      legacyOwners: {},
      status: {},
      put: (username, entry, remote = false) =>
        set((state) => {
          const account = state.accounts[username] ?? {};
          const previous = account[entry.id];
          if (remote && previous?.dirty) return state;
          const next = {
            ...entry,
            pic:
              previous?.picEdit ??
              (remote ? entry.pic : (previous?.entry.pic ?? entry.pic)),
          };
          if (
            previous &&
            (Object.keys(next) as (keyof LogbookEntry)[]).every(
              (key) => previous.entry[key] === next[key],
            )
          )
            return state;
          return {
            accounts: {
              ...state.accounts,
              [username]: {
                ...account,
                [entry.id]: {
                  entry: next,
                  dirty: !remote,
                  summaryDirty: !remote,
                  picEdit: previous?.picEdit ?? null,
                },
              },
            },
          };
        }),
      editPic: (username, id, pic) =>
        set((state) => {
          const account = state.accounts[username];
          const previous = account?.[id];
          if (!previous || !pic.trim() || pic.trim().length > 120) return state;
          return {
            accounts: {
              ...state.accounts,
              [username]: {
                ...account,
                [id]: {
                  ...previous,
                  entry: { ...previous.entry, pic: pic.trim() },
                  summaryDirty: previous.summaryDirty ?? previous.dirty,
                  picEdit: pic.trim(),
                  dirty: true,
                },
              },
            },
          };
        }),
    }),
    {
      name: "nordsweet.logbook.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ accounts, legacyOwners }) => ({ accounts, legacyOwners }),
    },
  ),
);
