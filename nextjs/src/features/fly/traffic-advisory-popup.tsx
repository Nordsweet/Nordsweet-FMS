import { useEffect } from "react";
import { create } from "zustand";
import {
  trafficAdvisory,
  type TrafficAdvisory,
} from "~/domain/traffic-advisory";
import { type AircraftIdentity } from "~/domain/traffic-identity";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";
import { type GpsFix } from "./use-gps";

type Alert = TrafficAdvisory & { id: string; at: number; callsign: string };
type Encounter = {
  since: number;
  last: number;
  level: TrafficAdvisory["level"];
  at: number;
};
const useTrafficNotices = create<{
  session: string | null;
  active: Alert[];
  encounters: Record<string, Encounter>;
  dismissed: Set<string>;
  observe: (
    session: string,
    alerts: (TrafficAdvisory & { callsign: string })[],
    now: number,
  ) => void;
  dismiss: (id: string) => void;
}>((set) => ({
  session: null,
  active: [],
  encounters: {},
  dismissed: new Set(),
  dismiss: (id) => set((s) => ({ dismissed: new Set([...s.dismissed, id]) })),
  observe: (session, alerts, now) =>
    set((s) => {
      const encounters =
        s.session === session
          ? Object.fromEntries(
              Object.entries(s.encounters).filter(
                ([, e]) => now - e.last < 60000,
              ),
            )
          : {};
      const active = alerts
        .map((alert) => {
          const previous = encounters[alert.hex];
          const next = {
            since: previous?.since ?? now,
            last: now,
            level: alert.level,
            at: previous?.level === alert.level ? previous.at : now,
          };
          encounters[alert.hex] = next;
          return {
            ...alert,
            id: `traffic:${alert.hex}:${next.since}:${alert.level}`,
            at: next.at,
          };
        })
        .sort(
          (a, b) =>
            Number(b.level === "close") - Number(a.level === "close") ||
            a.seconds - b.seconds,
        );
      return {
        session,
        active,
        encounters,
        dismissed: s.session === session ? s.dismissed : new Set(),
      };
    }),
}));

/** Alert escalation survives dismissal; a new encounter is armed after sixty seconds clear of the volume. */
export function TrafficAdvisoryPopups({
  session,
  fix,
  aircraft,
  identity,
  now,
}: {
  session: string;
  fix: GpsFix | null;
  aircraft: TrafficAircraft[] | undefined;
  identity: AircraftIdentity;
  now: number;
}) {
  const t = useT();
  const notices = useTrafficNotices();
  useEffect(() => {
    const alerts = (aircraft ?? []).flatMap((a) => {
      const advisory = trafficAdvisory(fix, a, now, identity);
      return advisory
        ? [
            {
              ...advisory,
              callsign: a.callsign?.trim().length
                ? a.callsign.trim()
                : (a.registration ?? a.hex),
            },
          ]
        : [];
    });
    useTrafficNotices.getState().observe(session, alerts, now);
  }, [session, fix, aircraft, identity, now]);
  return (
    notices.session === session &&
    notices.active
      .filter((alert) => !notices.dismissed.has(alert.id))
      .slice(0, 3)
      .map((alert) => {
        const clock =
          Math.round(
            ((((alert.bearingDeg - (fix?.trackDeg ?? 0)) % 360) + 360) % 360) /
              30,
          ) % 12 || 12;
        return (
          <FlightPopup
            key={alert.id}
            category="system"
            notificationId={alert.id}
            recordedAt={alert.at}
            severity={alert.level === "close" ? "danger" : "warning"}
            testId={`traffic-${alert.level}`}
            message={t(`fly.traffic.${alert.level}`, {
              callsign: alert.callsign,
              clock,
              distance: alert.distanceNm.toFixed(1),
              altitude: `${alert.relativeAltitudeFt >= 0 ? "+" : ""}${Math.round(alert.relativeAltitudeFt)}`,
            })}
            onDismiss={() => notices.dismiss(alert.id)}
          />
        );
      })
  );
}
