"use client";

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  type TimerKey,
  isRunning,
  timerElapsed,
  utilityValue,
} from "~/domain/flight-timers";
import { useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings } from "~/stores/map";

import { playChime } from "./chime";
import { Group, Row } from "./emergency-panel";
import { PositionSourcePanel } from "./position-source-panel";
import { usePositionSource } from "~/stores/position-source";
import { AtisTokens } from "~/features/plan/atis-call";

const time = (at: number) =>
  new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  });

function TimerCard({ id, now }: { id: TimerKey; now: number }) {
  const t = useT();
  const timer = useInFlight((s) => s.timers[id]);
  const toggle = useInFlight((s) => s.toggleTimer);
  const running = isRunning(timer);
  const status = running
    ? timer.source === "auto"
      ? "fly.timers.runningAuto"
      : "fly.timers.runningManual"
    : timer.stoppedAt !== null
      ? timer.source === "auto"
        ? "fly.timers.stoppedAuto"
        : "fly.timers.stoppedManual"
      : timer.autoArmed
        ? "fly.timers.waiting"
        : "fly.timers.ready";
  return (
    <Group title={t(`fly.timers.${id}`)}>
      <p className="text-muted-foreground text-xs">
        {t(`fly.timers.${id}Rule`)}
      </p>
      <div className="flex items-center justify-between gap-3">
        <output
          className="font-mono text-2xl font-semibold tabular-nums"
          data-testid={`timer-${id}`}
        >
          {timerElapsed(timer, now)}
        </output>
        <Button variant="outline" onClick={() => toggle(id)}>
          {t(
            id === "offBlock"
              ? running
                ? "fly.timers.onBlock"
                : "fly.timers.offBlockButton"
              : running
                ? "fly.timers.landing"
                : "fly.timers.takeoff",
          )}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t(status)}</p>
    </Group>
  );
}

function UtilityCard({ index, now }: { index: 0 | 1; now: number }) {
  const t = useT();
  const timer = useInFlight((s) => s.timers.utility[index]);
  const main = useInFlight((s) => s.utilityMain);
  const countdown = useInFlight((s) => s.utilityCountdown);
  const running = timer.mode === "stopwatch" || timer.mode === "countdown";
  return (
    <Group title={t("fly.timers.utility", { n: index + 1 })}>
      <p className="text-muted-foreground text-xs">
        {t("fly.timers.utilityRule")}
      </p>
      <output
        className="font-mono text-2xl font-semibold tabular-nums"
        data-testid={`utility-${index}`}
      >
        {utilityValue(timer, now)}
      </output>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => main(index)}>
          {t(
            running
              ? "fly.timers.stop"
              : timer.mode !== "idle"
                ? "fly.timers.reset"
                : "fly.timers.start",
          )}
        </Button>
        {[1, 2].map((minutes) => (
          <Button
            key={minutes}
            variant="outline"
            size="sm"
            onClick={() => {
              // Unlocks audio inside the tap, so the chime can play when the countdown ends.
              playChime();
              countdown(index, minutes);
            }}
          >
            {t("fly.timers.minutes", { n: minutes })}
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {timer.mode === "countdown"
          ? t("fly.timers.countdownRunning", {
              n: Math.round(timer.durationMs / 60000),
            })
          : t(`fly.timers.utility.${timer.mode}`)}
      </p>
    </Group>
  );
}

/** Legacy OPTIONS: GPS and map options, Block/Air Time with GPS detection, the event log. */
export function OptionsPanel() {
  const source = usePositionSource((s) => s.source);
  const t = useT();
  const settings = useMapSettings();
  const timers = useInFlight((s) => s.timers);
  const addEvent = useInFlight((s) => s.addEvent);
  const openFreda = useInFlight((s) => s.openFreda);
  const fredaAvailable = useInFlight((s) => s.fredaAvailable);
  const replayEnabled = useInFlight((s) => s.replayEnabled);
  const setReplayEnabled = useInFlight((s) => s.setReplayEnabled);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const events = [...timers.events].sort((a, b) => b.at - a.at).slice(0, 10);
  const last = timers.last;

  return (
    <>
      <PositionSourcePanel />
      <AtisTokens />
      <div className="flex flex-wrap gap-2">
        <Button
          aria-pressed={settings.gpsEnabled}
          variant={settings.gpsEnabled ? "default" : "outline"}
          onClick={() => settings.setGps(!settings.gpsEnabled)}
        >
          {t("maptools.gps")}
        </Button>
        <Button
          aria-pressed={settings.trackUp}
          variant={settings.trackUp ? "default" : "outline"}
          onClick={() => settings.update({ trackUp: !settings.trackUp })}
        >
          {t("maptools.trackUp")}
        </Button>
        <Button variant="outline" onClick={() => settings.follow(true)}>
          {t("maptools.center")}
        </Button>
      </div>
      <TimerCard id="offBlock" now={now} />
      <TimerCard id="airTime" now={now} />
      <Group title={t("fly.timers.summary")}>
        <Row
          label={t("fly.timers.offBlock")}
          value={timerElapsed(timers.offBlock, now)}
        />
        <Row
          label={t("fly.timers.airTime")}
          value={timerElapsed(timers.airTime, now)}
        />
      </Group>
      <UtilityCard index={0} now={now} />
      <UtilityCard index={1} now={now} />
      <div>
        <Button
          variant="outline"
          onClick={openFreda}
          disabled={!fredaAvailable}
        >
          {t("fly.freda.open")}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={source === "connector"}
          checked={replayEnabled}
          onChange={(e) => setReplayEnabled(e.target.checked)}
        />
        {t("fly.replay.enable")}
      </label>
      <Group title={t("fly.events.title")}>
        <div>
          <Button size="sm" variant="outline" onClick={() => addEvent("")}>
            {t("fly.events.add")}
          </Button>
        </div>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("fly.events.none")}
          </p>
        ) : (
          <ul className="grid gap-1" aria-label={t("fly.events.title")}>
            {events.map((e, i) => (
              <li key={i} className="flex justify-between gap-3 text-sm">
                <span>{e.name || t("fly.events.unnamed")}</span>
                <time
                  dateTime={new Date(e.at).toISOString()}
                  className="font-mono"
                >
                  {time(e.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Group>
      <p className="text-muted-foreground text-xs" role="status">
        {last?.speedKt == null
          ? t("fly.timers.gpsArmed")
          : t("fly.timers.gpsStatus", {
              speed: Math.round(last.speedKt),
              altitude:
                last.altitudeFt === null ? "—" : Math.round(last.altitudeFt),
              heading:
                last.headingDeg === null
                  ? "—"
                  : String(Math.round(last.headingDeg)).padStart(3, "0"),
            })}
      </p>
    </>
  );
}
