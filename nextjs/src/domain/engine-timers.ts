import type { FlightPhase } from "./flight-phase";

export type EngineTimers = {
  session: string | null;
  warmStartedAt: number | null;
  coolStartedAt: number | null;
  stationaryObservedAt: number | null;
};
export const emptyEngineTimers: EngineTimers = {
  session: null,
  warmStartedAt: null,
  coolStartedAt: null,
  stationaryObservedAt: null,
};

/** Cooling requires continuous, fresh stationary ground observations during taxi-in. */
export function observeEngineTimers(
  previous: EngineTimers,
  input: {
    session: string | null;
    phase: FlightPhase;
    now: number;
    sample: {
      at: number;
      groundSpeedKt: number | null;
      onGround?: boolean;
      paused?: boolean;
    } | null;
  },
): EngineTimers {
  const state =
    previous.session === input.session
      ? previous
      : { ...emptyEngineTimers, session: input.session };
  const { sample, now } = input;
  const stationary =
    !!input.session &&
    input.phase === "taxiin" &&
    sample &&
    !sample.paused &&
    sample.onGround !== false &&
    sample.groundSpeedKt !== null &&
    Number.isFinite(sample.groundSpeedKt) &&
    sample.groundSpeedKt >= 0 &&
    sample.groundSpeedKt < 2 &&
    Number.isFinite(sample.at) &&
    now - sample.at >= -5000 &&
    now - sample.at <= 20000;
  if (!stationary)
    return { ...state, coolStartedAt: null, stationaryObservedAt: null };
  const continuous =
    state.stationaryObservedAt !== null &&
    sample.at >= state.stationaryObservedAt &&
    sample.at - state.stationaryObservedAt <= 20000;
  return {
    ...state,
    coolStartedAt: continuous ? state.coolStartedAt : now,
    stationaryObservedAt: sample.at,
  };
}

export function engineTimerSeconds(startedAt: number | null, now: number) {
  return startedAt === null
    ? 60
    : Math.max(0, Math.min(60, Math.ceil((startedAt + 60000 - now) / 1000)));
}
