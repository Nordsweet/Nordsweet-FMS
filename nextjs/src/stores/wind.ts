import { create } from "zustand";
import {
  emptyWind,
  observeWind,
  type WindEstimation,
  type WindSample,
} from "~/domain/wind-estimation";

type WindState = {
  session: string | null;
  state: WindEstimation;
  observe: (
    session: string | null,
    airborne: boolean,
    sample: WindSample | null,
    now: number,
  ) => void;
};

/** Working GPS buffers stay in memory: reload/new flight cannot revive an old wind as live. */
export const useWind = create<WindState>()((set) => ({
  session: null,
  state: emptyWind(),
  observe: (session, airborne, sample, now) =>
    set((s) => {
      const state = s.session === session && airborne ? s.state : emptyWind();
      const next =
        session && airborne ? observeWind(state, sample, now) : state;
      if (s.session === session && next === s.state) return s;
      if (
        !session &&
        !s.session &&
        !s.state.estimate &&
        !s.state.samples.length
      )
        return s;
      return { session, state: next };
    }),
}));
