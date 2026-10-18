import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type EmergencyProcedure,
  type EmergencyPhase,
  operationalProcedure,
} from "~/data/emergency";
import {
  type EmergencyMeasurement,
  type EmergencyTarget,
} from "~/domain/emergency";
import { type NavPoint } from "~/domain/progress";

export type EmergencySession = {
  id: string;
  scope: string;
  openedAt: number;
  endedAt: number | null;
  family: EmergencyProcedure["family"];
  phase: EmergencyPhase | null;
  procedure: EmergencyProcedure | null;
  variants: Record<
    string,
    { definition: EmergencyProcedure; checked: Record<string, boolean> }
  >;
  originalRoute: NavPoint[];
  target: EmergencyTarget | null;
  routeRequested: boolean;
  previewOnly: boolean;
  outcome: "unresolved" | "restarted" | "landing" | "ended";
  speedDismissed: boolean;
};
type State = {
  session: EmergencySession | null;
  history: EmergencySession[];
  measurements: EmergencyMeasurement[];
  open: (
    scope: string,
    family: EmergencySession["family"],
    phase: EmergencyPhase | null,
    route: NavPoint[],
    routeRequested: boolean,
    target: EmergencyTarget | null,
  ) => void;
  select: (procedure: EmergencyProcedure, reference?: boolean) => void;
  toggle: (id: string) => void;
  chooseTarget: (target: EmergencyTarget | null) => void;
  setPhase: (phase: EmergencyPhase) => void;
  outcome: (outcome: EmergencySession["outcome"]) => void;
  dismissSpeed: () => void;
  end: () => void;
  measure: (sample: EmergencyMeasurement) => void;
};
export const emergencyScope = (
  flightId: string,
  aircraftId: string | null,
  startedAt: string | null,
  registration = "",
) =>
  `${flightId}|${aircraftId ?? "none"}|${registration.trim().toUpperCase()}|${startedAt ?? "planning"}`;

/** A single offline session shared by EMER/library; definitions are revision snapshots, never hot-swapped. */
export const useEmergency = create<State>()(
  persist(
    (set) => ({
      session: null,
      history: [],
      measurements: [],
      open: (scope, family, phase, route, routeRequested, target) =>
        set((s) => {
          if (
            s.session?.scope === scope &&
            s.session.family === family &&
            s.session.endedAt === null
          )
            return routeRequested && !s.session.routeRequested
              ? { session: { ...s.session, routeRequested: true, target } }
              : {};
          return {
            history: s.session
              ? [...s.history, s.session].slice(-30)
              : s.history,
            measurements: [],
            session: {
              id: crypto.randomUUID(),
              scope,
              openedAt: Date.now(),
              endedAt: null,
              family,
              phase,
              procedure: null,
              variants: {},
              originalRoute: route.map((p) => ({ ...p })),
              target,
              routeRequested,
              previewOnly: phase !== "flight",
              outcome: "unresolved",
              speedDismissed: false,
            },
          };
        }),
      select: (procedure, reference = false) =>
        set((s) => {
          if (
            procedure.family !== s.session?.family ||
            (!operationalProcedure(procedure) && !reference)
          )
            return {};
          const key = `${procedure.key}@${procedure.revision}`;
          const existing = s.session.variants[key];
          const snapshot = existing?.definition ?? structuredClone(procedure);
          return {
            session: {
              ...s.session,
              procedure: snapshot,
              speedDismissed:
                s.session.procedure?.key === snapshot.key &&
                s.session.procedure.revision === snapshot.revision
                  ? s.session.speedDismissed
                  : false,
              phase: snapshot.phase,
              previewOnly:
                snapshot.phase !== "flight" || !operationalProcedure(snapshot),
              variants: {
                ...s.session.variants,
                [key]: existing ?? { definition: snapshot, checked: {} },
              },
            },
          };
        }),
      toggle: (id) =>
        set((s) => {
          const session = s.session,
            p = session?.procedure;
          if (!session || !p?.items.some((item) => item.id === id)) return {};
          const key = `${p.key}@${p.revision}`,
            variant = session.variants[key];
          if (!variant) return {};
          return {
            session: {
              ...session,
              variants: {
                ...session.variants,
                [key]: {
                  ...variant,
                  checked: { ...variant.checked, [id]: !variant.checked[id] },
                },
              },
            },
          };
        }),
      chooseTarget: (target) =>
        set((s) => (s.session ? { session: { ...s.session, target } } : {})),
      setPhase: (phase) =>
        set((s) =>
          s.session
            ? {
                session: {
                  ...s.session,
                  phase,
                  procedure: null,
                  previewOnly: phase !== "flight",
                },
              }
            : {},
        ),
      outcome: (outcome) =>
        set((s) => (s.session ? { session: { ...s.session, outcome } } : {})),
      dismissSpeed: () =>
        set((s) =>
          s.session ? { session: { ...s.session, speedDismissed: true } } : {},
        ),
      end: () =>
        set((s) =>
          s.session
            ? {
                history: [
                  ...s.history,
                  {
                    ...s.session,
                    endedAt: Date.now(),
                    outcome:
                      s.session.outcome === "unresolved"
                        ? ("ended" as const)
                        : s.session.outcome,
                  },
                ].slice(-30),
                session: null,
                measurements: [],
              }
            : {},
        ),
      measure: (sample) =>
        set((s) => ({
          measurements: [
            ...s.measurements.filter(
              (m) => m.at < sample.at && sample.at - m.at <= 10_000,
            ),
            sample,
          ],
        })),
    }),
    {
      name: "nordsweet.emergency.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ session, history }) => ({ session, history }),
    },
  ),
);
