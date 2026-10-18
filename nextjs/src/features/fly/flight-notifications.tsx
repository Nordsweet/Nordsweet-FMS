"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import {
  flightGuidance,
  plannedGuidanceAltitude,
  type GuidanceCommand,
} from "~/domain/flight-guidance";
import { initialBearingDeg } from "~/domain/geo";
import { navigationProgress } from "~/domain/holding";
import { magneticVariationDeg } from "~/domain/magnetic";
import { angleDiffDeg } from "~/domain/angles";
import { type buildRoutePlan } from "~/domain/route-plan";
import { type TurnPerformance } from "~/domain/fly-by";
import { type FlightPhase } from "~/domain/flight-phase";
import { useInFlight } from "~/stores/inflight";
import { useT } from "~/i18n/use-t";
import { CommsChangePopup } from "./comms-change-popup";
import { EventToast } from "./event-toast";
import { FlightPopup } from "./flight-popup";
import { TrafficPatternPopup } from "./traffic-pattern-popup";
import { useCommsPlan } from "./use-comms-plan";
import { type GpsFix } from "./use-gps";

type Notice = { key: string; command: GuidanceCommand; expiresAt: number };
// Transient commands are shared between Map and Fly, but never restored as instructions after reload.
const useGuidanceNotices = create<{
  session: string | null;
  seen: Set<string>;
  notices: Notice[];
  observe: (
    session: string,
    context: string,
    commands: GuidanceCommand[],
    now: number,
  ) => void;
  dismiss: (key: string) => void;
}>((set) => ({
  session: null,
  seen: new Set(),
  notices: [],
  dismiss: (key) =>
    set((s) => ({ notices: s.notices.filter((n) => n.key !== key) })),
  observe: (session, context, commands, now) =>
    set((s) => {
      const same = s.session === session;
      const seen = new Set(same ? s.seen : []);
      const keyed = commands.map((command) => ({
        command,
        key: `${context}|${command.category}|${command.direction}|${command.category === "heading" ? Math.round(command.headingDeg / 10) : command.altitudeFt}`,
      }));
      const notices = same
        ? s.notices.filter(
            (n) => n.expiresAt > now && keyed.some((c) => c.key === n.key),
          )
        : [];
      for (const item of keyed) {
        if (seen.has(item.key)) continue;
        seen.add(item.key);
        notices.push({ ...item, expiresAt: now + 12000 });
      }
      if (
        same &&
        seen.size === s.seen.size &&
        notices.length === s.notices.length &&
        notices.every((n, i) => n === s.notices[i])
      )
        return s;
      return { session, seen, notices };
    }),
}));

// Radio estimates retain their own slow clock; transient-popup expiry must not
// rebuild the flight planner and radio geography every second.
const FrequencyNotification = memo(function FrequencyNotification({
  phase,
  fix,
}: {
  phase: FlightPhase;
  fix: GpsFix | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const comms = useCommsPlan(phase, fix, now, true);
  return <CommsChangePopup phase={phase} estimate={comms.estimate} />;
});

/** One stack reuses map guidance inputs instead of rebuilding the planner on its expiry clock. */
export function FlightNotifications({
  plan,
  cruiseAltitudeFt,
  fix,
  turns,
}: {
  plan: ReturnType<typeof buildRoutePlan> | null;
  cruiseAltitudeFt: number;
  fix: GpsFix | null;
  turns: TurnPerformance;
}) {
  const t = useT();
  const navigation = useInFlight();
  const [now, setNow] = useState(() => Date.now());
  const notices = useGuidanceNotices((s) => s.notices);
  const session = useGuidanceNotices((s) => s.session);
  const dismiss = useGuidanceNotices((s) => s.dismiss);
  const progress = useMemo(
    () =>
      fix
        ? navigationProgress(
            navigation.route,
            fix,
            navigation.activeLeg,
            turns,
            navigation.holding,
          )
        : null,
    [fix, navigation.route, navigation.activeLeg, navigation.holding, turns],
  );
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!navigation.startedAt) return;
    const next = progress?.next;
    const from = progress ? navigation.route[progress.activeLeg] : null;
    const holding = navigation.holding;
    const holdingActive = !!holding && holding.phase !== "armed";
    // A turn's intermediate tangent is not a new planned heading. In a hold,
    // announce the straight outbound/inbound legs, leaving entry-turn geometry intact.
    const course = holdingActive
      ? holding.phase === "outbound" ||
        (holding.phase === "return" &&
          progress &&
          Math.abs(
            angleDiffDeg(
              progress.desiredTrackDeg,
              holding.config.inboundTrueDeg,
            ),
          ) < 5)
        ? (progress?.desiredTrackDeg ?? null)
        : null
      : from && next
        ? initialBearingDeg(from, next)
        : null;
    const commands = progress
      ? flightGuidance({
          now,
          phase: navigation.phase,
          fix,
          courseTrueDeg: course,
          targetAltitudeFt: plannedGuidanceAltitude(
            progress.next,
            progress.distanceToNextNm,
            plan,
            cruiseAltitudeFt,
          ),
          variationDeg: fix ? magneticVariationDeg(fix) : 0,
          tasKt: turns.tasKt,
          wind: {
            directionDeg: turns.windDirectionDeg ?? 0,
            speedKt: turns.windSpeedKt ?? 0,
          },
        })
      : [];
    const context = holdingActive
      ? `${holding.config.fix.ident}:${holding.config.inboundTrueDeg}:${holding.config.direction}|${holding.circuits}|${holding.phase}`
      : `${progress?.activeLeg}|${from?.ident}:${from?.lat}:${from?.lon}|${next?.ident}:${next?.lat}:${next?.lon}`;
    useGuidanceNotices
      .getState()
      .observe(navigation.startedAt, context, commands, now);
  }, [navigation, fix, turns, plan, cruiseAltitudeFt, progress, now]);
  return (
    <div
      className="pointer-events-none absolute right-20 bottom-24 left-3 z-10 flex max-h-[45vh] flex-col items-center gap-2 overflow-y-auto sm:right-24 sm:left-24"
      data-testid="flight-notifications"
    >
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
        {session === navigation.startedAt &&
          notices.map(({ key, command }) => (
            <FlightPopup
              key={key}
              category={command.category}
              notificationId={`guidance:${key}`}
              message={
                command.category === "heading"
                  ? t(`fly.popup.turn.${command.direction}`, {
                      heading: String(command.headingDeg).padStart(3, "0"),
                    })
                  : t(`fly.popup.${command.direction}`, {
                      altitude: command.altitudeFt,
                    })
              }
              onDismiss={() => dismiss(key)}
            />
          ))}
        <TrafficPatternPopup />
        <FrequencyNotification phase={navigation.phase} fix={fix} />
        <EventToast />
      </div>
    </div>
  );
}
