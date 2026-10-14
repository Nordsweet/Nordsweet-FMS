"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  type ReplayPoint,
  readGpxTrack,
  replayPoints,
} from "~/domain/gpx-replay";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";

import { simulateFix } from "./use-gps";

const SPEEDS = [1, 5, 10, 20];
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Legacy "Debug with GPX": replays a recorded track as the GPS, so the map, navigation, timers
 * and automatic phases run as in flight. Sample times advance by the file's own spacing.
 */
export function GpxReplayDock() {
  const t = useT();
  const { departureAirport } = usePlan();
  const [points, setPoints] = useState<ReplayPoint[]>([]);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const sampleClock = useRef<number | null>(null);

  const feed = (i: number, restartClock = false) => {
    const point = points[i];
    if (!point) return;
    sampleClock.current =
      restartClock || sampleClock.current === null
        ? Date.now()
        : sampleClock.current + Math.max(1, point.elapsedMs);
    simulateFix({
      lat: point.lat,
      lon: point.lon,
      altitudeFt: point.altitudeFt,
      groundSpeedKt: point.speedKt,
      trackDeg: point.headingDeg,
      accuracyM: 5,
      time: new Date(sampleClock.current).toISOString(),
    });
    setIndex(i + 1);
    // End of track: the last fix stays until Stop or Clear hands the GPS back.
    if (i + 1 >= points.length) setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    const next = points[index];
    if (!next) return;
    const id = setTimeout(
      () => feed(index),
      Math.max(1, (index ? next.elapsedMs || 1000 : 0) / speed),
    );
    return () => clearTimeout(id);
    // `feed` reads the current points; the loop steps on index/speed/running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, index, speed, points]);
  // Real GPS comes back when the dock goes away.
  useEffect(() => () => simulateFix(null), []);

  const stop = () => {
    setRunning(false);
    simulateFix(null);
  };
  const elapsed = (n: number) =>
    points.slice(0, n).reduce((sum, p) => sum + p.elapsedMs, 0);

  return (
    <div
      className="bg-card/95 absolute bottom-20 left-1/2 z-[45] flex w-[min(45rem,calc(100%-10rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border p-2 text-xs backdrop-blur"
      data-testid="gpx-replay"
    >
      <label className="cursor-pointer rounded-xl border px-3 py-2 font-semibold uppercase">
        {t("fly.replay.load")}
        <input
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          className="sr-only"
          aria-label={t("fly.replay.load")}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const loaded = replayPoints(
                readGpxTrack(await file.text()),
                departureAirport?.elevationFt ?? 0,
              );
              stop();
              setPoints(loaded);
              setIndex(0);
              sampleClock.current = null;
              setError(null);
            } catch {
              setError(t("fly.replay.invalid"));
            }
          }}
        />
      </label>
      <Button
        size="sm"
        disabled={!points.length}
        onClick={() => {
          if (running) return stop();
          if (index >= points.length) setIndex(0);
          setRunning(true);
        }}
      >
        {t(running ? "fly.replay.stop" : "fly.replay.start")}
      </Button>
      <select
        aria-label={t("fly.replay.speed")}
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="bg-background rounded-lg border px-2 py-1"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
      <output className="font-mono">
        {clock(elapsed(index))} / {clock(elapsed(points.length))}
      </output>
      <input
        type="range"
        min={0}
        max={Math.max(0, points.length - 1)}
        value={Math.max(0, index - 1)}
        aria-label={t("fly.replay.position")}
        className="min-w-24 flex-1"
        disabled={!points.length}
        onChange={(e) => feed(Number(e.target.value), true)}
      />
      <output className="font-mono">
        {index} / {points.length}
      </output>
      <Button
        size="sm"
        variant="outline"
        disabled={!points.length}
        onClick={() => {
          stop();
          setIndex(0);
          sampleClock.current = null;
        }}
      >
        {t("fly.replay.reset")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!points.length}
        onClick={() => {
          stop();
          setPoints([]);
          setIndex(0);
        }}
      >
        {t("fly.replay.clear")}
      </Button>
      {error && (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
