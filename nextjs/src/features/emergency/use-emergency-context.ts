"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { usePlan } from "~/features/plan/use-plan";
import { useInFlight } from "~/stores/inflight";
import { useGps } from "~/features/fly/use-gps";
import { useEmergency, emergencyScope } from "~/stores/emergency";
import {
  emergencyContext,
  emergencyCandidates,
  engineFirePhase,
} from "~/domain/emergency";
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
  const allReferences = [
    ...emergencyReferences(plan.aircraft?.type),
    ...(plan.aircraft?.emergencyProcedures ?? []).filter(
      (p) =>
        p.status === "reference" &&
        p.aircraftType === plan.aircraft?.type &&
        (!p.registration || p.registration === plan.flight.registration),
    ),
  ];
  const references = allReferences;
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
    const phase =
      family === "fire" ? engineFirePhase(navigation.phase) : context.phase;
    store.open(scope, family, phase, navigation.route, requested, target);
    const selected = procedures.find(
      (p) =>
        p.family === family &&
        (family === "fire"
          ? p.phase === phase || p.phase === null
          : family !== "failure" || p.phase === phase),
    );
    if (
      selected &&
      (family === "fire" || !useEmergency.getState().session?.procedure)
    )
      store.select(selected);
    else if (family === "fire" && !selected) {
      const source = allReferences.find(
        (p) => p.family === "fire" && p.phase === phase,
      );
      if (source) store.select(source, true);
    }
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
