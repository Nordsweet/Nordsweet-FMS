import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { airspaceEntryObservations } from "~/domain/airspace-entry";
import { commsZones } from "~/domain/comms";
import type { FlightPhase } from "~/domain/flight-phase";
import { AIRSPACE_QUERY } from "~/features/map/map-view";
import { useAirspaceEntry } from "~/stores/airspace-entry";
import { useFlightNotificationHistory } from "~/stores/flight-notifications";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";
import type { GpsFix } from "./use-gps";
import { useTerrainHeight } from "./use-terrain-height";

export function AirspaceEntryPopups({
  session,
  phase,
  fix,
  now,
}: {
  session: string | null;
  phase: FlightPhase;
  fix: GpsFix | null;
  now: number;
}) {
  const t = useT();
  const monitor = useAirspaceEntry();
  const airspace = useQuery({
    ...api.airspace.around.queryOptions({ ...AIRSPACE_QUERY, plan: "current" }),
    enabled: !!session,
  });
  const imported = useQuery({
    ...api.map.importedAirspace.queryOptions(undefined),
    enabled: !!session,
  });
  const zones = useMemo(
    () =>
      [...(airspace.data?.features ?? []), ...(imported.data ?? [])].map(
        (zone) => commsZones([zone])[0] ?? zone,
      ),
    [airspace.data, imported.data],
  );
  const height = useTerrainHeight(fix);
  const age = fix ? now - (fix.receivedAt ?? Date.parse(fix.time)) : Infinity;
  const available =
    !!session &&
    !!fix &&
    !fix.paused &&
    fix.onGround !== true &&
    age >= -5000 &&
    age <= 20000 &&
    phase !== "taxiout" &&
    phase !== "taxiin";
  const observations = useMemo(
    () =>
      available && fix
        ? airspaceEntryObservations(zones, {
            ...fix,
            altitudeFt: height.mslFt,
            altitudeAglFt: height.aglFt,
            groundSpeedKt: fix.groundSpeedKt ?? 0,
          })
        : [],
    [available, fix, zones, height.mslFt, height.aglFt],
  );
  useEffect(() => {
    // Missing telemetry must hide warnings without silently discarding an acknowledged visit.
    if (available || !session)
      useAirspaceEntry.getState().observe(session, observations);
  }, [session, available, observations]);
  if (!available || monitor.session !== session) return null;
  return monitor.visits
    .filter((v) => v.seconds !== null && !v.cleared && !v.dismissed)
    .map((v) => {
      const id = `airspace-entry:${v.visit}:${v.key}`;
      const message = t(
        v.informationOnly
          ? v.inside
            ? "airspaceEntry.insideInfo"
            : "airspaceEntry.approachingInfo"
          : v.inside
            ? "airspaceEntry.inside"
            : "airspaceEntry.approaching",
        { zone: v.name },
      );
      return (
        <FlightPopup
          key={id}
          category="comms"
          severity={v.informationOnly ? undefined : "warning"}
          testId="airspace-entry-popup"
          notificationId={id}
          message={message}
          onDismiss={() => monitor.acknowledge(v.key, false)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">{message}</span>
            {!v.informationOnly && (
              <Button
                size="sm"
                onClick={() => {
                  monitor.acknowledge(v.key, true);
                  useFlightNotificationHistory.getState().record(session, {
                    id: `${id}:cleared`,
                    category: "comms",
                    message: t("airspaceEntry.confirmed", { zone: v.name }),
                    createdAt: Date.now(),
                  });
                }}
              >
                {t("airspaceEntry.clear")}
              </Button>
            )}
          </div>
        </FlightPopup>
      );
    });
}
