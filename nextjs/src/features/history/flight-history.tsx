"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { api } from "~/api";
import { type FlightLogSummary } from "~/api/userdata/schemas";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatClock } from "~/domain/format";
import { summarizeTrack, toGpx } from "~/domain/track";
import { useLocale, useT } from "~/i18n/use-t";

/** Whole minutes between two ISO times; null when either is missing or they are out of order. */
const minutesBetween = (from: string | null, to: string | null) => {
  if (!from || !to) return null;
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isFinite(ms) && ms >= 0 ? Math.floor(ms / 60_000) : null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right">{value}</strong>
    </div>
  );
}

const number = (value: number | null, digits = 2) =>
  value === null ? null : value.toFixed(digits);

function Details({ log }: { log: FlightLogSummary }) {
  const t = useT();
  const detail = useQuery(api.flightLogs.get.queryOptions({ id: log.id }));
  const hasTrack = (log.track_points ?? 0) > 0;
  const track = useQuery({
    ...api.flightLogs.track.queryOptions({ id: log.id }),
    enabled: hasTrack,
  });
  const summary = track.data ? summarizeTrack(track.data.points) : null;
  const emergencies = detail.data?.emergency_sessions?.length ?? 0;
  return (
    <div className="mt-3 grid gap-1 border-t pt-3">
      <Row
        label={t("history.track")}
        value={
          !hasTrack
            ? t("history.track.none")
            : track.isPending
              ? t("history.track.loading")
              : summary
                ? t("history.track.summary", {
                    distance: summary.distanceNm.toFixed(1),
                    altitude: Math.round(summary.maxAltitudeFt ?? 0),
                  })
                : t("history.unknown")
        }
      />
      {track.data && (
        <Button
          variant="outline"
          className="mt-1 w-fit"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([toGpx(track.data.points, log.id)], {
                type: "application/gpx+xml",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `${log.started_at.slice(0, 10)}-${log.registration ?? "flight"}.gpx`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("history.track.gpx")}
        </Button>
      )}
      {emergencies > 0 && (
        <Row label={t("history.emergencies")} value={String(emergencies)} />
      )}
    </div>
  );
}

function LogCard({
  log,
  onDelete,
}: {
  log: FlightLogSummary;
  onDelete: (log: FlightLogSummary) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const block = minutesBetween(log.off_block_at, log.on_block_at);
  const air = minutesBetween(log.takeoff_at, log.landing_at);
  const none = t("history.unknown");
  const readings = (before: number | null, after: number | null) =>
    before === null && after === null
      ? none
      : `${number(before) ?? none} → ${number(after) ?? none}`;
  return (
    <Card data-testid="flight-log">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            {log.aircraft_type
              ? `${log.aircraft_type}${log.registration ? ` ${log.registration}` : ""}`
              : t("history.untyped")}
          </span>
          <time
            dateTime={log.started_at}
            className="text-muted-foreground text-sm font-normal"
          >
            {new Date(log.started_at).toLocaleString(locale)}
          </time>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1">
        <Row
          label={t("history.block")}
          value={block === null ? none : formatClock(block)}
        />
        <Row
          label={t("history.air")}
          value={air === null ? none : formatClock(air)}
        />
        <Row
          label={t("history.mth")}
          value={readings(log.mth_before, log.mth_after)}
        />
        <Row
          label={t("history.fuel")}
          value={`${readings(log.fuel_before_l, log.fuel_after_l)} L`.replace(
            `${none} L`,
            none,
          )}
        />
        <Row
          label={t("history.track")}
          value={t("history.track.points", { count: log.track_points ?? 0 })}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? t("history.hide") : t("history.details")}
          </Button>
          <Button variant="outline" onClick={() => onDelete(log)}>
            {t("history.delete")}
          </Button>
        </div>
        {open && <Details log={log} />}
      </CardContent>
    </Card>
  );
}

/** Finished flights stored on the server (`GET /flight-logs`), newest first. */
export function FlightHistory() {
  const t = useT();
  const client = useQueryClient();
  const [deleting, setDeleting] = useState<FlightLogSummary | null>(null);
  const logs = useInfiniteQuery({
    queryKey: ["flightLogs.list"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.flightLogs.page.call({ offset: pageParam }),
    getNextPageParam: (last, pages) =>
      last.has_more ? pages.flatMap((p) => p.items).length : undefined,
  });
  const remove = useMutation({
    ...api.flightLogs.remove.mutationOptions(),
    onSuccess: () => {
      setDeleting(null);
      void client.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("flightLogs."),
      });
    },
  });
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4">
      <h1 className="text-xl font-bold">{t("history.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("history.intro")}</p>
      {logs.isPending && <p>{t("history.loading")}</p>}
      {logs.isError && (
        <p role="alert">{t("history.error", { error: logs.error.message })}</p>
      )}
      {logs.isSuccess && items.length === 0 && <p>{t("history.empty")}</p>}
      {items.map((log) => (
        <LogCard key={log.id} log={log} onDelete={setDeleting} />
      ))}
      {logs.hasNextPage && (
        <Button
          variant="outline"
          disabled={logs.isFetchingNextPage}
          onClick={() => void logs.fetchNextPage()}
        >
          {t("history.more")}
        </Button>
      )}
      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>{t("history.delete")}</DialogTitle>
          <DialogDescription>{t("history.delete.confirm")}</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t("userdata.delete.cancel")}
            </Button>
            <Button
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate({ id: deleting.id })}
            >
              {t("history.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
