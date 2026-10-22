import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";
import type { FuelReserveLevel } from "~/domain/fuel-reserves";

const savedNotice = z.object({
  session: z.string().nullable(),
  level: z.enum(["alternate", "final"]).nullable(),
  at: z.number().finite().nonnegative(),
  dismissed: z.boolean(),
});
type Notice = z.infer<typeof savedNotice> & {
  observe: (
    session: string,
    level: FuelReserveLevel | null,
    now: number,
  ) => void;
  dismiss: () => void;
};

/** Acknowledgement survives Map/Fly navigation and reload; escalation and a fresh breach rearm it. */
export const useFuelReserveNotice = create<Notice>()(
  persist(
    (set, get) => ({
      session: null,
      level: null,
      at: 0,
      dismissed: false,
      observe: (session, level, now) => {
        const previous = get();
        if (previous.session === session && previous.level === level) return;
        set({ session, level, at: now, dismissed: false });
      },
      dismiss: () => set({ dismissed: true }),
    }),
    {
      name: "nordsweet.fuel-reserve-notice.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ session, level, at, dismissed }) => ({
        session,
        level,
        at,
        dismissed,
      }),
      merge: (persisted, current) => {
        const parsed = savedNotice.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);
