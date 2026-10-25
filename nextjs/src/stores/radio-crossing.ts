import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";
import { observeRadioCrossing, type RadioCrossing } from "~/domain/comms-alert";
import { type CommsEstimate } from "~/domain/comms";

const savedRadio = z.object({
  session: z.string().nullable(),
  current: z.string(),
  sequence: z.number().int().nonnegative(),
  change: z
    .object({
      key: z.string(),
      rows: z.array(
        z.object({
          frequencyMhz: z.string(),
          callsign: z.string(),
          sector: z.string().nullable(),
          serviceId: z.string().optional(),
        }),
      ),
      at: z.number().finite(),
    })
    .nullable(),
  dismissed: z.array(z.string()),
});

/** Keep the current sector visit and its acknowledged transition across reload and Map/Fly changes. */
export const useRadioCrossing = create<
  RadioCrossing & {
    dismissed: string[];
    dismiss: (key: string) => void;
    observe: (
      session: string | null,
      rows: CommsEstimate["current"],
      now: number,
    ) => void;
  }
>()(
  persist(
    (set) => ({
      session: null,
      current: "",
      sequence: 0,
      change: null,
      dismissed: [],
      dismiss: (key) =>
        set((s) => ({ dismissed: [...new Set([...s.dismissed, key])] })),
      observe: (session, rows, now) =>
        set((s) => {
          const next = observeRadioCrossing(s, session, rows, now);
          return s.session !== session ? { ...next, dismissed: [] } : next;
        }),
    }),
    {
      name: "nordsweet.radio-crossing.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ session, current, sequence, change, dismissed }) => ({
        session,
        current,
        sequence,
        change,
        dismissed,
      }),
      merge: (saved, current) => {
        const parsed = savedRadio.safeParse(saved);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);
