"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { usePlan } from "~/features/plan/use-plan";
import { useInFlight } from "~/stores/inflight";
import { useGps } from "~/features/fly/use-gps";
import { useEmergency, emergencyScope } from "~/stores/emergency";
import { emergencyContext, emergencyCandidates } from "~/domain/emergency";
import { emergencyReferences, operationalProcedure } from "~/data/emergency";

/** Shared selection context, independent of the panel's mount lifetime. */
export function useEmergencyContext() {
  const plan = usePlan();
  const navigation = useInFlight();
  const { fix, error } = useGps(!!navigation.startedAt);
  const store = useEmergency();
  const airports =
    useQuery(api.airports.list.queryOptions(undefined)).data ?? [];
  const scope = emergencyScope(
    plan.flight.id,
    plan.aircraft?.id ?? plan.flight.aircraftId,
    navigation.startedAt,
    plan.flight.registration,
  );
  const session =
    store.session?.scope === scope && store.session.endedAt === null
      ? store.session
      : null;
  const references = emergencyReferences(plan.aircraft?.type);
  const procedures = (plan.aircraft?.emergencyProcedures ?? []).filter(
    (p) =>
      operationalProcedure(p) &&
      p.aircraftType === plan.aircraft?.type &&
      (!p.registration || p.registration === plan.flight.registration),
  );
  function open(
    family:
      | "failure"
      | "fire"
      | "electric"
      | "hydraulic"
      | "pax"
      | "fuel"
      | "pneumatic",
    requestEngineOut = false,
  ) {
    const context = emergencyContext(
      navigation.phase,
      navigation.timers,
      !error && fix ? Date.parse(fix.time) : null,
      Date.now(),
    );
    const requested =
      family === "failure" && requestEngineOut && context.airborne;
    const target =
      requested && fix
        ? (emergencyCandidates(airports, fix, fix.groundSpeedKt, 1)[0]
            ?.target ?? null)
        : null;
    store.open(
      scope,
      family,
      context.phase,
      navigation.route,
      requested,
      target,
    );
    const selected = procedures.find(
      (p) =>
        p.family === family &&
        (family !== "failure" || p.phase === context.phase),
    );
    if (selected && !useEmergency.getState().session?.procedure)
      store.select(selected);
  }
  return {
    ...plan,
    navigation,
    fix,
    error,
    store,
    session,
    references,
    procedures,
    airports,
    open,
  };
}
