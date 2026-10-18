"use client";
import { type Airport } from "~/data/schemas";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import { emergencyCandidates } from "~/domain/emergency";
import { useEmergencyContext } from "./use-emergency-context";

/** Choosing a highlighted alternate changes only the emergency overlay, leaving the FPL intact. */
export function EmergencyAirportChoice({
  airport,
  now,
}: {
  airport: Airport;
  now: number;
}) {
  const { session, store, fix, error } = useEmergencyContext();
  const t = useT();
  if (!session?.routeRequested || session.family !== "failure") return null;
  const candidate =
    fix && !error && now - Date.parse(fix.time) <= 20_000
      ? emergencyCandidates([airport], fix, fix.groundSpeedKt, 1)[0]
      : null;
  return (
    <Button
      variant="outline"
      disabled={!candidate}
      onClick={() => {
        if (candidate) store.chooseTarget(candidate.target);
      }}
    >
      {t("emer.target")} — {airport.ident}
      {candidate ? ` RW${candidate.target.runway}` : ""}
    </Button>
  );
}
