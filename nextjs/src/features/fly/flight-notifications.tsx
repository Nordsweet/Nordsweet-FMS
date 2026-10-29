"use client";

import { memo, useEffect, useMemo } from "react";
import { useNow } from "~/hooks/use-now";
import { create } from "zustand";
import {
  guidanceTimeline,
  type TimedGuidance,
} from "~/domain/guidance-timeline";
import {
  observeGuidance,
  type GuidanceNotices,
} from "~/domain/guidance-notices";
import {
  flightGuidanceAvailable,
  plannedGuidanceAltitude,
} from "~/domain/flight-guidance";
import { initialBearingDeg } from "~/domain/geo";
import { navigationProgress } from "~/domain/holding";
import { magneticVariationDeg } from "~/domain/magnetic";
import { angleDiffDeg } from "~/domain/angles";
import { type buildRoutePlan } from "~/domain/route-plan";
import { type TurnPerformance } from "~/domain/fly-by";
import { type FlightPhase } from "~/domain/flight-phase";
import { useInFlight } from "~/stores/inflight";
import { useFlightSync } from "~/stores/flight-sync";
import { useT } from "~/i18n/use-t";
import { CommsChangePopup } from "./comms-change-popup";
import { EventToast } from "./event-toast";
import { FlightPopup } from "./flight-popup";
import { TrafficPatternPopup } from "./traffic-pattern-popup";
import { useCommsPlan } from "./use-comms-plan";
import { type GpsFix } from "./use-gps";
import { TrafficAdvisoryPopups } from "./traffic-advisory-popup";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { type AircraftIdentity } from "~/domain/traffic-identity";
import { CruiseAltitudePopup } from "./cruise-altitude-popup";
import { AirspaceEntryPopups } from "./airspace-entry-popups";
import { FuelReservePopup, type FuelReserveInputs } from "./fuel-reserve-popup";
import { formatHeading } from "~/domain/format";

// Shared across Map and Fly, deliberately transient after reload.
const useGuidanceNotices = create<
  GuidanceNotices & {
    observe: (
      session: string,
      context: string,
      events: TimedGuidance[],
      now: number,
      available: boolean,
      monotonic: boolean,
    ) => void;
    dismiss: (key: string) => void;
  }
>((set) => ({
  session: null,
  seen: new Set(),
  notices: [],
  observe: (session, context, events, now, available, monotonic) =>
    set((s) =>
      observeGuidance(s, session, context, events, now, available, monotonic),
    ),
  dismiss: (key) =>
    set((s) => ({
      seen: new Set([...s.seen, key]),
      notices: s.notices.filter((n) => n.key !== key),
    })),
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
  const now = useNow(15000);
  const comms = useCommsPlan(phase, fix, now, true);
  const recoveryReady = useFlightSync((s) => s.phase === "ready");
  return (
    <CommsChangePopup
      phase={phase}
      estimate={comms.estimate}
      now={now}
      live={
        recoveryReady &&
        !comms.loading &&
        !!fix &&
        !fix.paused &&
        now - Date.parse(fix.time) < 30000
      }
    />
  );
});

/** One stack reuses map guidance inputs instead of rebuilding the planner on its expiry clock. */
export function FlightNotifications({
  plan,
  cruiseAltitudeFt,
  fix,
  turns,
  aircraft,
  identity,
  fuel,
}: {
  plan: ReturnType<typeof buildRoutePlan> | null;
  cruiseAltitudeFt: number;
  fix: GpsFix | null;
  turns: TurnPerformance;
  aircraft?: TrafficAircraft[];
  identity: AircraftIdentity;
  fuel: FuelReserveInputs;
}) {
  const t = useT();
  const navigation = useInFlight();
  const now = useNow(1000);
  const notices = useGuidanceNotices((s) => s.notices);
  const session = useGuidanceNotices((s) => s.session);
  const dismiss = useGuidanceNotices((s) => s.dismiss);
  const recoveryReady = useFlightSync((s) => s.phase === "ready");
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
    if (!navigation.startedAt || !recoveryReady) return;
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
      ? guidanceTimeline({
          route: navigation.route,
          activeLeg: progress.activeLeg,
          performance: turns,
          plan,
          cruiseAltitudeFt,
          holdingActive,
          holding,
          now,
          phase: navigation.phase,
          fix,
          courseTrueDeg: course,
          targetAltitudeFt:
            plan ||
            holdingActive ||
            (progress.next.altitudeFt !== undefined && !progress.next.patternId)
              ? plannedGuidanceAltitude(
                  progress.next,
                  progress.distanceToNextNm,
                  plan,
                  cruiseAltitudeFt,
                )
              : null,
          variationDeg: fix ? magneticVariationDeg(fix) : 0,
          tasKt: turns.tasKt,
          wind: {
            directionDeg: turns.windDirectionDeg ?? 0,
            speedKt: turns.windSpeedKt ?? 0,
          },
        })
      : [];
    const context = holdingActive
      ? `${holding.config.fix.ident}:${holding.config.inboundTrueDeg}:${holding.config.direction}|${holding.circuits}`
      : navigation.route
          .map(
            (p) =>
              `${p.ident}:${p.lat}:${p.lon}:${p.altitudeFt ?? ""}:${p.patternId ?? ""}`,
          )
          .join("|");
    useGuidanceNotices
      .getState()
      .observe(
        navigation.startedAt,
        context,
        commands,
        now,
        flightGuidanceAvailable({ now, phase: navigation.phase, fix }),
        holdingActive,
      );
  }, [
    navigation,
    fix,
    turns,
    plan,
    cruiseAltitudeFt,
    progress,
    now,
    recoveryReady,
  ]);
  return (
    <div
      className="pointer-events-none absolute right-20 bottom-24 left-3 z-10 flex max-h-[45vh] flex-col items-center gap-2 overflow-y-auto sm:right-24 sm:left-24"
      data-testid="flight-notifications"
    >
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
        <FuelReservePopup fuel={fuel} now={now} />
        <CruiseAltitudePopup now={now} plan={plan} />
        <AirspaceEntryPopups
          session={navigation.startedAt}
          phase={navigation.phase}
          fix={fix}
          now={now}
        />
        {navigation.startedAt && (
          <TrafficAdvisoryPopups
            session={navigation.startedAt}
            fix={fix}
            aircraft={aircraft}
            identity={identity}
            now={now}
          />
        )}
        {session === navigation.startedAt &&
          notices.map(({ key, command, dueAt, announcedAt }) => {
            const message =
              command.category === "heading"
                ? t(`fly.popup.turn.${command.direction}`, {
                    heading: formatHeading(command.headingDeg),
                  })
                : command.direction === "levelOff"
                  ? t("fly.popup.thousandToGo")
                  : t(
                      command.direction === "descend"
                        ? "fly.popup.descentTo"
                        : "fly.popup.climb",
                      {
                        altitude: command.altitudeFt,
                      },
                    );
            return (
              <FlightPopup
                key={key}
                category={command.category}
                notificationId={`guidance:${key}`}
                message={
                  command.category === "altitude" &&
                  command.direction === "levelOff"
                    ? message
                    : `${message} ${announcedAt === null ? t(command.category === "altitude" && command.direction === "descend" ? "fly.popup.descentInSeconds" : "fly.popup.inSeconds", { count: Math.max(1, Math.ceil((dueAt - now) / 1000)) }) : t("fly.popup.now")}`
                }
                recordHistory={announcedAt !== null}
                recordedAt={announcedAt ?? undefined}
                historyMessage={message}
                onDismiss={() => dismiss(key)}
              />
            );
          })}
        <TrafficPatternPopup />
        <FrequencyNotification phase={navigation.phase} fix={fix} />
        <EventToast />
      </div>
    </div>
  );
}
