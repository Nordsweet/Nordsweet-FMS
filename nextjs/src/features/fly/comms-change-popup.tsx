"use client";
import { useState } from "react";
import { type CommsEstimate } from "~/domain/comms";
import { commsChangeSuggestion } from "~/domain/comms-alert";
import { type FlightPhase } from "~/domain/flight-phase";
import { useT } from "~/i18n/use-t";

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
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-card/95 absolute bottom-36 left-1/2 z-50 flex w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur"
    >
      <div className="grid flex-1 gap-1 text-sm font-semibold">
        {suggestion.rows.map((r, i) => (
          <p key={i}>
            {t("fly.comms.suggestion", {
              frequency: r.frequencyMhz,
              callsign: r.callsign || t("fly.comms.noCallsign"),
              service:
                /^(fis|fiss|fir)$/i.test(r.serviceId ?? "") ||
                (!r.serviceId &&
                  /informacja|information|\bFIS\b/i.test(r.callsign))
                  ? " (FIS)"
                  : "",
            })}
          </p>
        ))}
      </div>
      <button
        type="button"
        aria-label={t("fly.comms.dismissSuggestion")}
        className="shrink-0 px-2 py-1 text-xl"
        onClick={() =>
          setDismissed((previous) => new Set([...previous, suggestion.key]))
        }
      >
        ×
      </button>
    </div>
  );
}
