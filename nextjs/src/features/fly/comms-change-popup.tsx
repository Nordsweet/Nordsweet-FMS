"use client";
import { useEffect } from "react";
import { create } from "zustand";
import { useInFlight } from "~/stores/inflight";
import { type CommsEstimate } from "~/domain/comms";
import {
  commsChangeSuggestion,
  observeRadioCrossing,
  type RadioCrossing,
} from "~/domain/comms-alert";
import { type FlightPhase } from "~/domain/flight-phase";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

const useRadioCrossing = create<
  RadioCrossing & {
    dismissed: ReadonlySet<string>;
    dismiss: (key: string) => void;
    observe: (
      session: string | null,
      rows: CommsEstimate["current"],
      now: number,
    ) => void;
  }
>((set) => ({
  session: null,
  current: "",
  sequence: 0,
  change: null,
  dismissed: new Set(),
  dismiss: (key) => set((s) => ({ dismissed: new Set([...s.dismissed, key]) })),
  observe: (session, rows, now) =>
    set((s) => {
      const next = observeRadioCrossing(s, session, rows, now);
      return s.session !== session
        ? { ...next, dismissed: new Set<string>() }
        : next;
    }),
}));

/** Dismissible two-minute radio suggestion, independent of the COMMs panel. */
export function CommsChangePopup({
  phase,
  estimate,
  now,
  live,
}: {
  phase: FlightPhase;
  estimate: CommsEstimate;
  now: number;
  live: boolean;
}) {
  const t = useT();
  const session = useInFlight((s) => s.startedAt);
  const crossing = useRadioCrossing((s) => s.change);
  const crossingSession = useRadioCrossing((s) => s.session);
  const sequence = useRadioCrossing((s) => s.sequence);
  const currentRows = estimate.current;
  useEffect(() => {
    if (live) useRadioCrossing.getState().observe(session, currentRows, now);
  }, [session, phase, currentRows, now, live]);
  const dismissed = useRadioCrossing((s) => s.dismissed);
  const ahead = commsChangeSuggestion(phase, estimate, new Set());
  const anticipated = ahead
    ? { ...ahead, key: `${session}:${sequence + 1}:${ahead.key}` }
    : null;
  const suggestion =
    live &&
    crossingSession === session &&
    crossing &&
    now - crossing.at < 120000 &&
    !dismissed.has(crossing.key)
      ? crossing
      : live && anticipated && !dismissed.has(anticipated.key)
        ? anticipated
        : null;
  if (!suggestion) return null;
  const message = suggestion.rows
    .map((r) =>
      t("fly.comms.suggestion", {
        frequency: r.frequencyMhz,
        callsign: r.callsign || t("fly.comms.noCallsign"),
      }),
    )
    .join("\n");
  return (
    <FlightPopup
      category="frequency"
      notificationId={`frequency:${suggestion.key}`}
      message={message}
      onDismiss={() => useRadioCrossing.getState().dismiss(suggestion.key)}
    />
  );
}
