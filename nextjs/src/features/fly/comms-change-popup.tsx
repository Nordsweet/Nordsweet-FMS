"use client";
import { useState } from "react";
import { type CommsEstimate } from "~/domain/comms";
import { commsChangeSuggestion } from "~/domain/comms-alert";
import { type FlightPhase } from "~/domain/flight-phase";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

/** Dismissible two-minute radio suggestion, independent of the COMMs panel. */
export function CommsChangePopup({
  phase,
  estimate,
}: {
  phase: FlightPhase;
  estimate: CommsEstimate;
}) {
  const t = useT();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const suggestion = commsChangeSuggestion(phase, estimate, dismissed);
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
