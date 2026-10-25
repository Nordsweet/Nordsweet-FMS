"use client";
import { useEffect } from "react";
import { useRadioCrossing } from "~/stores/radio-crossing";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { commsAtisAirport, commsAtisContext } from "~/domain/comms-atis";
import { useInFlight } from "~/stores/inflight";
import { type CommsEstimate } from "~/domain/comms";
import { radioRowsKey } from "~/domain/comms";
import { commsChangeSuggestion } from "~/domain/comms-alert";
import { type FlightPhase } from "~/domain/flight-phase";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

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
    radioRowsKey(crossing.rows) === radioRowsKey(currentRows) &&
    now - crossing.at < 120000 &&
    !dismissed.includes(crossing.key)
      ? crossing
      : live && anticipated && !dismissed.includes(anticipated.key)
        ? anticipated
        : null;
  const frequencies = useQuery({
    ...api.frequencies.list.queryOptions(undefined),
    enabled: !!suggestion,
  });
  const airports = [
    ...new Set(
      (suggestion?.rows ?? [])
        .map((r) => commsAtisAirport(r, frequencies.data ?? []))
        .filter((icao): icao is string => !!icao),
    ),
  ];
  const reports = useQueries({
    queries: airports.map((icao) => ({
      ...api.weather.atis.queryOptions({ icao }),
      refetchInterval: 60_000,
    })),
  });
  if (!suggestion) return null;
  const message = suggestion.rows
    .map((r) => {
      const icao = commsAtisAirport(r, frequencies.data ?? []);
      const result = icao ? reports[airports.indexOf(icao)] : undefined;
      const context =
        icao && result?.data?.icao === icao
          ? commsAtisContext(result.data.atis, icao, now)
          : null;
      return (
        t("fly.comms.suggestion", {
          frequency: r.frequencyMhz,
          callsign: r.callsign || t("fly.comms.noCallsign"),
        }) + (context ? t("fly.comms.atisContext", context) : "")
      );
    })
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
