import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type Airrep } from "~/data/airrep";

type Entry = { owner: string; report: Airrep };
type State = {
  pending: Entry[];
  sent: string[];
  enqueue: (owner: string, report: Airrep) => void;
  acknowledge: (owner: string, id: string) => void;
};
const key = (owner: string, id: string) => `${owner}/${id}`;

/** Observations survive reload/offline; another pilot can never upload this pilot's queue. */
export const useAirrep = create<State>()(
  persist(
    (set) => ({
      pending: [],
      sent: [],
      enqueue: (owner, report) =>
        set((s) => {
          const id = key(owner, report.id);
          if (
            s.sent.includes(id) ||
            s.pending.some((e) => key(e.owner, e.report.id) === id)
          )
            return s;
          return { pending: [...s.pending, { owner, report }] };
        }),
      acknowledge: (owner, id) =>
        set((s) => ({
          pending: s.pending.filter(
            (e) => key(e.owner, e.report.id) !== key(owner, id),
          ),
          sent: [...s.sent, key(owner, id)].slice(-10000),
        })),
    }),
    {
      name: "nordsweet.airrep.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ pending, sent }) => ({ pending, sent }),
    },
  ),
);
