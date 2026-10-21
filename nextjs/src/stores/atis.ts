import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  type AtisAction,
  type AtisPad,
  atisReducer,
  emptyAtisPad,
} from "~/domain/atis-pad";

type AtisStore = {
  /** Active editor; completed values remain isolated by airport when switching pads. */
  airport: string | null;
  pad: AtisPad;
  records: Record<string, AtisPad>;
  open: (airport: string) => void;
  dispatch: (action: AtisAction) => void;
};

/** The ATIS pad, kept across reloads (legacy manualAtis). */
export const useAtis = create<AtisStore>()(
  persist(
    (set) => ({
      airport: null,
      pad: emptyAtisPad(),
      records: {},
      open: (airport) =>
        set((s) =>
          s.airport === airport
            ? s
            : { airport, pad: s.records[airport] ?? emptyAtisPad() },
        ),
      dispatch: (action) =>
        set((s) => {
          const pad = atisReducer(s.pad, action);
          return {
            pad,
            records: s.airport ? { ...s.records, [s.airport]: pad } : s.records,
          };
        }),
    }),
    {
      name: "nordsweet.atis.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ airport, pad, records }) => ({ airport, pad, records }),
      // A pad saved by an older release gets any newer fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AtisStore>;
        const pad = { ...emptyAtisPad(), ...p.pad };
        return {
          ...current,
          ...p,
          pad,
          records: { ...p.records, ...(p.airport ? { [p.airport]: pad } : {}) },
        };
      },
    },
  ),
);
