import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { z } from "zod";
import {
  flightNotificationSchema,
  type FlightNotification,
} from "~/data/flight-notification";

const savedHistory = z.object({
  session: z.string().nullable(),
  entries: z.array(flightNotificationSchema),
  readCount: z.number().int().nonnegative(),
});
type History = z.infer<typeof savedHistory> & {
  begin: (session: string | null) => void;
  record: (session: string | null, entry: FlightNotification) => void;
  markRead: () => void;
};

/** History records each displayed popup once per flight, surviving dismissal, view changes and reload. */
export const useFlightNotificationHistory = create<History>()(
  persist(
    (set) => ({
      session: null,
      entries: [],
      readCount: 0,
      begin: (session) =>
        set((s) =>
          !session || session === s.session
            ? s
            : { session, entries: [], readCount: 0 },
        ),
      record: (session, entry) =>
        set((s) => {
          if (!session || !flightNotificationSchema.safeParse(entry).success)
            return s;
          if (
            session === s.session &&
            s.entries.some((item) => item.id === entry.id)
          )
            return s;
          return {
            session,
            entries: [...(session === s.session ? s.entries : []), entry],
            readCount: session === s.session ? s.readCount : 0,
          };
        }),
      markRead: () =>
        set((s) =>
          s.readCount === s.entries.length
            ? s
            : { readCount: s.entries.length },
        ),
    }),
    {
      name: "nordsweet.flight-notifications.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ session, entries, readCount }) => ({
        session,
        entries,
        readCount,
      }),
      merge: (persisted, current) => {
        const saved = savedHistory.safeParse(persisted);
        return saved.success
          ? {
              ...current,
              ...saved.data,
              readCount: Math.min(
                saved.data.readCount,
                saved.data.entries.length,
              ),
            }
          : current;
      },
    },
  ),
);
