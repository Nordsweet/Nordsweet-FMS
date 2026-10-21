import { create } from "zustand";
import {
  emptyCruiseAltitudeMonitor,
  observeCruiseAltitude,
  changedCruiseAltitude,
  type CruiseAltitudeMonitor,
} from "~/domain/cruise-altitude";
import { useFlight } from "./flight";
import { useInFlight } from "./inflight";

type MonitorStore = {
  state: CruiseAltitudeMonitor;
  observedAt: number;
  observe: (
    input: Parameters<typeof observeCruiseAltitude>[1],
    now: number,
  ) => void;
  respond: (accept: boolean, protectedKeys?: readonly string[]) => void;
  setAltitude: (
    altitudeFt: number,
    protectedKeys?: readonly string[],
    allFuture?: boolean,
  ) => void;
};

/** Shared by Map/Fly; reload starts a fresh two-minute observation rather than assuming continuity. */
export const useCruiseAltitude = create<MonitorStore>()((set, get) => ({
  state: emptyCruiseAltitudeMonitor,
  observedAt: 0,
  setAltitude: (altitudeFt, protectedKeys = [], allFuture = false) => {
    if (!Number.isFinite(altitudeFt) || altitudeFt < 0) return;
    const navigation = useInFlight.getState();
    const change = changedCruiseAltitude(
      useFlight.getState().flight,
      altitudeFt,
      navigation.route,
      navigation.activeLeg,
      [
        ...protectedKeys,
        ...(navigation.divertAirport ? [navigation.divertAirport] : []),
      ],
      allFuture,
    );
    useFlight.getState().update(change.patch);
    useInFlight.setState({ route: change.route });
    set({ state: emptyCruiseAltitudeMonitor });
  },
  observe: (input, now) =>
    set((s) => ({
      state: observeCruiseAltitude(s.state, input),
      observedAt: input.sample?.at ?? now,
    })),
  respond: (accept, protectedKeys = []) => {
    const { state, observedAt } = get();
    const flight = useFlight.getState().flight;
    const navigation = useInFlight.getState();
    if (state.offeredFt === null) return;
    const valid =
      navigation.startedAt &&
      state.context === `${navigation.startedAt}:${flight.cruiseAltitudeFt}` &&
      Date.now() - observedAt <= 20000;
    if (accept && valid) {
      get().setAltitude(state.offeredFt, protectedKeys);
    }
    set({
      state: {
        ...state,
        offeredFt: null,
        declined: [...state.declined, state.offeredFt],
      },
    });
  },
}));
