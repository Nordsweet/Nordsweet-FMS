import { create } from "zustand";
import {
  type GlideWind,
  type GlideInput,
  type GlideReach,
} from "~/data/terrain";
import { toRad } from "~/domain/angles";

type GlideState = {
  analysis: {
    sessionId: string | null;
    status: "inputs" | "wind" | "missing" | "loading" | "ready";
    reach: GlideReach | null;
    input: GlideInput | null;
    source: string;
    missing: number;
  } | null;
  publish: (analysis: GlideState["analysis"]) => void;
  clearanceM: number;
  manualWind: (GlideWind & { sessionId: string; at: number }) | null;
  setClearance: (metres: number) => void;
  setWind: (fromDeg: number, speedKt: number, sessionId: string) => void;
};
/** Wind is an explicit session input, never a silently restored zero-wind assumption. */
export const useGlide = create<GlideState>()((set) => ({
  clearanceM: 150,
  manualWind: null,
  analysis: null,
  publish: (analysis) => set({ analysis }),
  setClearance: (clearanceM) => {
    if (Number.isFinite(clearanceM) && clearanceM >= 0 && clearanceM <= 1000)
      set({ clearanceM });
  },
  setWind: (fromDeg, speedKt, sessionId) => {
    if (
      !Number.isFinite(fromDeg + speedKt) ||
      fromDeg < 0 ||
      fromDeg > 360 ||
      speedKt < 0 ||
      speedKt > 100
    )
      return;
    set({
      manualWind: {
        eastKt: -speedKt * Math.sin(toRad(fromDeg)),
        northKt: -speedKt * Math.cos(toRad(fromDeg)),
        source: "manual",
        sessionId,
        at: Date.now(),
      },
    });
  },
}));
