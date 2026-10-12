"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type FlightPoint } from "~/data/flight";
import { magneticVariationDeg, trueToMagneticDeg } from "~/domain/magnetic";
import { computeProgress } from "~/domain/progress";
import { summarizeTrack, toGpx } from "~/domain/track";
import { fmt, fmtMinutes } from "~/features/plan/fields";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useInFlight } from "~/stores/inflight";

import { useGps } from "./use-gps";

const FREDA_INTERVAL_MIN = 30;

function Tile({
  label,
  value,
  alert = false,
  testId,
}: {
  label: string;
  value: string;
  alert?: boolean;
  testId?: string;
}) {
  return (
    <div className={cn("rounded-lg border p-3", alert && "border-destructive")}>
      <div className="text-muted-foreground text-xs uppercase">{label}</div>
      <div
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums sm:text-3xl",
          alert && "text-destructive",
        )}
        data-testid={testId}
      >
        {value}
      </div>
    </div>
  );
}

const deg = (v: number | null) =>
  v === null ? "—" : `${fmt(v).padStart(3, "0")}°`;
const utc = (date: Date) => date.toISOString().slice(11, 16) + "Z";

export function FlyPage() {
  const t = useT();
  const { flight, route: planRoute } = usePlan();
  const inFlight = useInFlight();
  const flying = inFlight.startedAt !== null;
  const { fix, error } = useGps(true);
  const [now, setNow] = useState(() => Date.now());
  const [debrief, setDebrief] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const progress =
    flying && fix
      ? computeProgress(inFlight.route, fix, inFlight.activeLeg)
      : null;
  const { setActiveLeg, record } = inFlight;
  useEffect(() => {
    if (progress && progress.activeLeg !== inFlight.activeLeg)
      setActiveLeg(progress.activeLeg);
  }, [progress, inFlight.activeLeg, setActiveLeg]);
  useEffect(() => {
    if (flying && fix)
      record({
        lat: fix.lat,
        lon: fix.lon,
        altitudeFt: fix.altitudeFt,
        time: fix.time,
      });
  }, [flying, fix, record]);

  const variation = fix ? magneticVariationDeg(fix) : 0;
  const mag = (trueDeg: number | null) =>
    trueDeg === null ? null : trueToMagneticDeg(trueDeg, variation);
  const gs = fix?.groundSpeedKt ?? null;
  const minutesFor = (nm: number) =>
    gs !== null && gs > 5 ? (nm / gs) * 60 : null;
  const eteNext = progress ? minutesFor(progress.distanceToNextNm) : null;
  const eteDest = progress
    ? minutesFor(progress.distanceToDestinationNm)
    : null;
  const fredaDue =
    flying &&
    inFlight.lastFredaAt !== null &&
    now - Date.parse(inFlight.lastFredaAt) >= FREDA_INTERVAL_MIN * 60000;
  const fredaIn =
    flying && inFlight.lastFredaAt !== null
      ? Math.max(
          0,
          FREDA_INTERVAL_MIN - (now - Date.parse(inFlight.lastFredaAt)) / 60000,
        )
      : null;
  const summary = summarizeTrack(inFlight.track);

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-primary mr-auto text-[1.05rem] font-semibold tracking-[0.04em] uppercase">
          {t("fly.title")}
        </h1>
        {!flying ? (
          <Button
            disabled={planRoute.length < 2}
            onClick={() => {
              inFlight.start(planRoute);
              setDebrief(false);
            }}
          >
            {t("fly.start")}
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() => {
              inFlight.end();
              setDebrief(true);
            }}
          >
            {t("fly.end")}
          </Button>
        )}
      </div>

      <p
        className={cn(
          "text-sm",
          error ? "text-destructive" : "text-muted-foreground",
        )}
        data-testid="gps-status"
      >
        {error
          ? t(`fly.gps.${error === "denied" ? "denied" : "unavailable"}`)
          : fix
            ? t("fly.gps.fix", {
                accuracy: fmt(fix.accuracyM),
                time: utc(new Date(fix.time)),
              })
            : t("fly.gps.waiting")}
      </p>
      {!flying && planRoute.length < 2 && (
        <p className="text-muted-foreground text-sm">
          {t("plan.navlog.empty")}
        </p>
      )}

      {flying && (
        <>
          <section
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
            aria-label={t("fly.next")}
          >
            <Tile
              label={t("fly.next")}
              value={progress?.next.ident ?? "—"}
              testId="fly-next"
            />
            <Tile
              label={t("fly.distance")}
              value={progress ? `${fmt(progress.distanceToNextNm, 1)} NM` : "—"}
              testId="fly-distance"
            />
            <Tile
              label={t("fly.bearing")}
              value={deg(mag(progress?.bearingToNextDeg ?? null))}
            />
            <Tile
              label={t("fly.dtk")}
              value={deg(mag(progress?.desiredTrackDeg ?? null))}
            />
            <Tile
              label={t("fly.xte")}
              value={
                progress
                  ? `${fmt(Math.abs(progress.crossTrackNm), 1)} ${progress.crossTrackNm >= 0 ? "R" : "L"}`
                  : "—"
              }
              alert={!!progress && Math.abs(progress.crossTrackNm) > 1}
              testId="fly-xte"
            />
            <Tile label={t("fly.ete")} value={fmtMinutes(eteNext)} />
            <Tile
              label={t("fly.gs")}
              value={gs === null ? "—" : `${fmt(gs)} kt`}
            />
            <Tile
              label={t("fly.track")}
              value={deg(mag(fix?.trackDeg ?? null))}
            />
            <Tile
              label={t("fly.altitude")}
              value={
                fix?.altitudeFt == null ? "—" : `${fmt(fix.altitudeFt)} ft`
              }
            />
          </section>
          <section
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            aria-label={t("fly.destination")}
          >
            <Tile
              label={`${t("fly.destination")} ${inFlight.route.at(-1)?.ident ?? ""}`}
              value={
                progress
                  ? `${fmt(progress.distanceToDestinationNm, 1)} NM`
                  : "—"
              }
            />
            <Tile label={t("fly.ete")} value={fmtMinutes(eteDest)} />
            <Tile
              label={t("fly.eta")}
              value={
                eteDest === null ? "—" : utc(new Date(now + eteDest * 60000))
              }
            />
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value=""
              onValueChange={(v) => fix && inFlight.goDirect(Number(v), fix)}
              disabled={!fix}
            >
              <SelectTrigger className="w-48" aria-label={t("fly.directTo")}>
                <SelectValue placeholder={t("fly.directTo")} />
              </SelectTrigger>
              <SelectContent>
                {inFlight.route.map((p, i) =>
                  i > 0 ? (
                    <SelectItem key={`${p.ident}-${i}`} value={String(i)}>
                      {p.ident}
                    </SelectItem>
                  ) : null,
                )}
              </SelectContent>
            </Select>
            <Button
              variant={fredaDue ? "destructive" : "outline"}
              onClick={inFlight.confirmFreda}
              data-testid="freda"
            >
              {fredaDue
                ? t("fly.fredaDue")
                : t("fly.fredaIn", {
                    minutes: fredaIn === null ? "—" : fmt(fredaIn),
                  })}
            </Button>
            <span className="text-muted-foreground text-xs">
              {t("fly.fredaItems")}
            </span>
          </div>

          <Frequencies
            points={[flight.departure, flight.destination, flight.alternate]}
          />
        </>
      )}

      {debrief && !flying && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("fly.debrief")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p data-testid="debrief">
              {t("fly.debriefSummary", {
                time: fmtMinutes(summary.minutes),
                distance: fmt(summary.distanceNm, 1),
                altitude:
                  summary.maxAltitudeFt === null
                    ? "—"
                    : fmt(summary.maxAltitudeFt),
                points: inFlight.track.length,
              })}
            </p>
            <div>
              <Button
                variant="outline"
                disabled={inFlight.track.length === 0}
                onClick={() => {
                  const name =
                    flight.name.trim() === "" ? "flight" : flight.name;
                  const url = URL.createObjectURL(
                    new Blob([toGpx(inFlight.track, name)], {
                      type: "application/gpx+xml",
                    }),
                  );
                  Object.assign(document.createElement("a"), {
                    href: url,
                    download: `${name}.gpx`,
                  }).click();
                  URL.revokeObjectURL(url);
                }}
              >
                {t("fly.exportGpx")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Frequencies({ points }: { points: (FlightPoint | null)[] }) {
  const t = useT();
  const idents = [
    ...new Set(points.filter((p) => p !== null).map((p) => p.ident)),
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("fly.frequencies")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
        {idents.map((ident) => (
          <AirportFrequencies key={ident} ident={ident} />
        ))}
      </CardContent>
    </Card>
  );
}

function AirportFrequencies({ ident }: { ident: string }) {
  const t = useT();
  const { data = [] } = useQuery(
    api.frequencies.byAirport.queryOptions({ airport: ident }),
  );
  return (
    <div>
      <div className="font-medium">{ident}</div>
      {data.length === 0 ? (
        <div className="text-muted-foreground">{t("fly.noFrequencies")}</div>
      ) : (
        <ul>
          {data.map((f, i) => (
            <li key={i} className="tabular-nums">
              <span className="font-mono">{f.frequencyMhz}</span> {f.callsign}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
