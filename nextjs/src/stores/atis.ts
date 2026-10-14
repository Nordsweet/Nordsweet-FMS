import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  type AtisAction,
  type AtisPad,
  atisReducer,
  emptyAtisPad,
} from "~/domain/atis-pad";

type AtisStore = {
  /** The airport the pad was written for; opening it for another airport starts a fresh pad. */
  airport: string | null;
  pad: AtisPad;
  open: (airport: string) => void;
  dispatch: (action: AtisAction) => void;
};

/** The ATIS pad, kept across reloads (legacy manualAtis). */
export const useAtis = create<AtisStore>()(
  persist(
    (set) => ({
      airport: null,
      pad: emptyAtisPad(),
      open: (airport) =>
        set((s) =>
          s.airport === airport ? s : { airport, pad: emptyAtisPad() },
        ),
      dispatch: (action) => set((s) => ({ pad: atisReducer(s.pad, action) })),
    }),
    {
      name: "nordsweet.atis.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ airport, pad }) => ({ airport, pad }),
      // A pad saved by an older release gets any newer fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AtisStore>;
        return { ...current, ...p, pad: { ...emptyAtisPad(), ...p.pad } };
      },
    },
  ),
);
