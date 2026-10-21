import { create } from "zustand";
import {
  emptyWind,
  observeWind,
  type WindEstimation,
  type WindSample,
  simulatorWind,
  type SimulatorWindSample,
} from "~/domain/wind-estimation";

type WindState = {
  session: string | null;
  mode: "gps" | "simulator";
  state: WindEstimation;
  position: { lat: number; lon: number; at: number } | null;
  locate: (position: { lat: number; lon: number; at: number }) => void;
  observe: (
    session: string | null,
    airborne: boolean,
    sample: WindSample | null,
    now: number,
  ) => void;
  observeSimulator: (
    session: string | null,
    sample: SimulatorWindSample | null,
    now: number,
  ) => void;
};

/** Working GPS buffers stay in memory: reload/new flight cannot revive an old wind as live. */
export const useWind = create<WindState>()((set) => ({
  session: null,
  mode: "gps",
  state: emptyWind(),
  position: null,
  locate: (position) =>
    set((s) => (s.state.estimate?.at === position.at ? { position } : s)),
  observe: (session, airborne, sample, now) =>
    set((s) => {
      const state =
        s.session === session && s.mode === "gps" && airborne
          ? s.state
          : emptyWind();
      const next =
        session && airborne ? observeWind(state, sample, now) : state;
      if (s.mode === "gps" && s.session === session && next === s.state)
        return s;
      if (
        s.mode === "gps" &&
        !session &&
        !s.session &&
        !s.state.estimate &&
        !s.state.samples.length
      )
        return s;
      return { session, mode: "gps", state: next };
    }),
  observeSimulator: (session, sample, now) =>
    set((s) => {
      const previous =
        s.mode === "simulator" && s.session === session ? s.state : emptyWind();
      const estimate = simulatorWind(sample, now);
      return {
        session,
        mode: "simulator",
        state: {
          ...emptyWind(),
          estimate: estimate ?? previous.estimate,
          lastAcceptedAt: estimate?.at ?? null,
          altitudeM: estimate?.altitudeM ?? null,
          interrupted: estimate === null,
        },
      };
    }),
}));
