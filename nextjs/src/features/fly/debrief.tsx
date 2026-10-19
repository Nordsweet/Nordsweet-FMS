"use client";
import { fuelUnit, formatFuel } from "~/domain/fuel-units";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type TrackPoint, type summarizeTrack, toGpx } from "~/domain/track";
import { debriefStatistics, type DebriefError } from "~/domain/debrief";
import { useInFlight } from "~/stores/inflight";
import { fmt, fmtMinutes } from "~/features/plan/fields";
import { useT } from "~/i18n/use-t";
import { useWindowDrag } from "./use-window-drag";

const utc = (at: number | null) =>
  at === null ? "—" : new Date(at).toISOString().slice(11, 19) + "Z";
const duration = (ms: number | null) => {
  if (ms === null) return "—";
  const seconds = Math.floor(ms / 1000);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
};

/** Postflight entry and four actual-statistic groups share the original movable debrief/GPX panel. */
export function Debrief({
  summary,
  track,
  name,
}: {
  summary: ReturnType<typeof summarizeTrack>;
  track: TrackPoint[];
  name: string;
}) {
  const t = useT(),
    drag = useWindowDrag();
  const record = useInFlight((s) => s.debrief),
    accept = useInFlight((s) => s.acceptDebrief);
  const unit = fuelUnit(record?.aircraftType, record?.fuelDisplayUnit);
  const fuelValue = (value: number | null | undefined) =>
    value == null ? "—" : `${formatFuel(value, unit)} ${unit}`;
  const [mth, setMth] = useState(record?.accepted?.mthAfter.toFixed(2) ?? "");
  const [fuel, setFuel] = useState(
    record?.accepted ? formatFuel(record.accepted.fuelAfterL, unit) : "",
  );
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<DebriefError | null>(null);
  const stats = record ? debriefStatistics(record) : null;
  const value = (v: number | null | undefined, unit: string, digits = 2) =>
    v == null ? "—" : `${fmt(v, digits)} ${unit}`;
  return (
    <>
      <h2 className="text-primary font-semibold tracking-[0.08em] uppercase">
        <span
          role="button"
          tabIndex={0}
          aria-label={t("fly.status.dragDebrief")}
          className="block cursor-grab touch-none select-none active:cursor-grabbing"
          {...drag}
        >
          {t("fly.debrief")}
        </span>
      </h2>
      <p data-testid="debrief" className="text-sm">
        {t("fly.debriefSummary", {
          time: fmtMinutes(summary.minutes),
          distance: fmt(summary.distanceNm, 1),
          altitude:
            summary.maxAltitudeFt === null ? "—" : fmt(summary.maxAltitudeFt),
          points: track.length,
        })}
      </p>
      {record && (
        <>
          {!record.accepted || editing ? (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const failure = accept(mth, fuel);
                setError(failure);
                if (!failure) setEditing(false);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="debrief-mth">{t("debrief.mthAfter")}</Label>
                  <Input
                    id="debrief-mth"
                    inputMode="decimal"
                    required
                    value={mth}
                    onChange={(e) => setMth(e.target.value)}
                    aria-describedby="debrief-before"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="debrief-fuel">
                    {t("debrief.fuelAfter", { unit })}
                  </Label>
                  <Input
                    id="debrief-fuel"
                    inputMode="decimal"
                    required
                    value={fuel}
                    onChange={(e) => setFuel(e.target.value)}
                    aria-describedby="debrief-before"
                  />
                </div>
              </div>
              <p id="debrief-before" className="text-muted-foreground text-xs">
                {t("debrief.before", {
                  mth: value(record.mthBefore, "MTH"),
                  fuel: fuelValue(record.fuelBeforeL),
                })}
              </p>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {t(`debrief.error.${error}`)}
                </p>
              )}
              <Button type="submit" className="w-fit">
                {t("debrief.accept")}
              </Button>
            </form>
          ) : (
            <>
              <div
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                data-testid="debrief-statistics"
              >
                <div className="grid content-start gap-2 rounded-xl border p-3">
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.mthUsed")}
                  </span>
                  <strong data-testid="debrief-mth-used">
                    {value(stats?.mthUsed, "MTH")}
                  </strong>
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.mthAfter")}
                  </span>
                  <span data-testid="debrief-mth-after">
                    {value(record.accepted.mthAfter, "MTH")}
                  </span>
                </div>
                <div className="grid content-start gap-2 rounded-xl border p-3">
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.fuelUsed")}
                  </span>
                  <strong data-testid="debrief-fuel-used">
                    {fuelValue(stats?.fuelUsedL)}
                  </strong>
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.fuelAfter", { unit })}
                  </span>
                  <span data-testid="debrief-fuel-after">
                    {fuelValue(record.accepted.fuelAfterL)}
                  </span>
                </div>
                <div className="grid content-start gap-2 rounded-xl border p-3">
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.blockEvents")}
                  </span>
                  <strong
                    className="text-sm"
                    data-testid="debrief-block-events"
                  >
                    {utc(record.times.offBlockAt)} →{" "}
                    {utc(record.times.onBlockAt)}
                  </strong>
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.blockTime")}
                  </span>
                  <span data-testid="debrief-block-time">
                    {duration(stats?.blockMs ?? null)}
                  </span>
                </div>
                <div className="grid content-start gap-2 rounded-xl border p-3">
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.airEvents")}
                  </span>
                  <strong className="text-sm" data-testid="debrief-air-events">
                    {utc(record.times.takeoffAt)} →{" "}
                    {utc(record.times.landingAt)}
                  </strong>
                  <span className="text-muted-foreground text-xs">
                    {t("debrief.airTime")}
                  </span>
                  <span data-testid="debrief-air-time">
                    {duration(stats?.airMs ?? null)}
                  </span>
                </div>
              </div>
              {(record.mthBefore === null || record.fuelBeforeL === null) && (
                <p className="text-muted-foreground text-xs">
                  {t("debrief.missing")}
                </p>
              )}
              <Button
                className="w-fit"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                {t("debrief.edit")}
              </Button>
            </>
          )}
        </>
      )}
      <div>
        <Button
          variant="outline"
          disabled={track.length === 0}
          onClick={() => {
            const file = (record?.name ?? name).trim() || "flight";
            const url = URL.createObjectURL(
              new Blob([toGpx(track, file)], { type: "application/gpx+xml" }),
            );
            Object.assign(document.createElement("a"), {
              href: url,
              download: `${file}.gpx`,
            }).click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("fly.exportGpx")}
        </Button>
      </div>
    </>
  );
}
