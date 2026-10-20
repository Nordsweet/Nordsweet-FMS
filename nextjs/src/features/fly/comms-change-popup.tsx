"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { useInFlight } from "~/stores/inflight";
import { type CommsEstimate } from "~/domain/comms";
import { commsChangeSuggestion } from "~/domain/comms-alert";
import { type FlightPhase } from "~/domain/flight-phase";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

const radioKey = (rows: CommsEstimate["current"]) =>
  rows
    .map((r) => `${r.frequencyMhz}|${r.callsign}`)
    .sort()
    .join(";");
const useRadioCrossing = create<{
  session: string | null;
  current: string;
  change: { key: string; rows: CommsEstimate["current"]; at: number } | null;
  observe: (
    session: string | null,
    rows: CommsEstimate["current"],
    now: number,
  ) => void;
}>((set) => ({
  session: null,
  current: "",
  change: null,
  observe: (session, rows, now) =>
    set((s) => {
      const current = radioKey(rows);
      if (s.session !== session) return { session, current, change: null };
      if (!current || current === s.current) return s;
      return {
        ...s,
        current,
        change: s.current
          ? { key: `${s.current}→${current}`, rows, at: now }
          : null,
      };
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
  const currentRows = estimate.current;
  useEffect(() => {
    if (live && ["climb", "cruise", "descent"].includes(phase))
      useRadioCrossing.getState().observe(session, currentRows, now);
  }, [session, phase, currentRows, now, live]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const suggestion =
    live &&
    ["climb", "cruise", "descent"].includes(phase) &&
    crossingSession === session &&
    crossing &&
    now - crossing.at < 120000 &&
    !dismissed.has(crossing.key)
      ? crossing
      : commsChangeSuggestion(phase, estimate, dismissed);
  if (!suggestion) return null;
  const message = suggestion.rows
    .map((r) =>
      t("fly.comms.suggestion", {
        frequency: r.frequencyMhz,
        callsign: r.callsign || t("fly.comms.noCallsign"),
        service:
          /^(fis|fiss|fir)$/i.test(r.serviceId ?? "") ||
          (!r.serviceId && /informacja|information|\bFIS\b/i.test(r.callsign))
            ? " (FIS)"
            : "",
      }),
    )
    .join("\n");
  return (
    <FlightPopup
      category="frequency"
      notificationId={`frequency:${suggestion.key}`}
      message={message}
      onDismiss={() =>
        setDismissed((previous) => new Set([...previous, suggestion.key]))
      }
    />
  );
}
