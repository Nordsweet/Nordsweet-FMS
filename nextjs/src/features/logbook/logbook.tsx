"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type LogbookEntry } from "~/data/logbook";
import { logbookDuration } from "~/domain/logbook";
import { useT } from "~/i18n/use-t";
import { useAuth } from "~/stores/auth";
import { useLogbook } from "~/stores/logbook";
import { formatClock } from "~/domain/format";

const duration = (ms: number | null) => {
  if (ms === null) return "—";
  return formatClock(Math.floor(ms / 60000));
};
const reading = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);
function Time({ at }: { at: number | null }) {
  return at === null ? (
    <span>—</span>
  ) : (
    <time
      dateTime={new Date(at).toISOString()}
      title={new Date(at).toISOString()}
    >
      {new Date(at).toISOString().slice(11, 16)}
    </time>
  );
}

/** All locally cached/account-synced Fly sessions, newest first; unknown event times never become zero. */
export function Logbook() {
  const t = useT();
  const username = useAuth((s) => s.session?.username ?? "");
  const account = useLogbook((s) => s.accounts[username]);
  const status = useLogbook((s) => s.status[username] ?? "loading");
  const entries = Object.values(account ?? {}).sort(
    (a, b) =>
      b.entry.startedAt.localeCompare(a.entry.startedAt) ||
      b.entry.id.localeCompare(a.entry.id),
  );
  const [editing, setEditing] = useState<LogbookEntry | null>(null);
  const pending = entries.filter((e) => e.dirty).length;
  const sum = (kind: "block" | "air") =>
    entries.reduce(
      (total, { entry }) =>
        total +
        (entry.endedAt === null
          ? 0
          : (logbookDuration(
              kind === "block" ? entry.offBlockAt : entry.takeoffAt,
              kind === "block" ? entry.onBlockAt : entry.landingAt,
            ) ?? 0)),
      0,
    );
  return (
    <Card className="mx-auto w-full max-w-400 min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            <h1>{t("logbook.title")}</h1>
          </CardTitle>
          <Button
            variant="outline"
            onClick={() =>
              window.dispatchEvent(new Event("nordsweet-logbook-refresh"))
            }
          >
            {t("logbook.refresh")}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">{t("logbook.intro")}</p>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [t("logbook.count"), entries.length],
            [t("logbook.totalBlock"), duration(sum("block"))],
            [t("logbook.totalAir"), duration(sum("air"))],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 rounded-xl border p-3">
              <span className="text-muted-foreground text-xs">{label}</span>
              <strong className="text-xl tabular-nums">{value}</strong>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {t("logbook.totalHint")}
        </p>
        <div role="status" className="text-muted-foreground text-sm">
          {status === "loading"
            ? t("logbook.loading")
            : status === "offline"
              ? t("logbook.offline")
              : null}
          {pending > 0 && <p>{t("logbook.pending", { count: pending })}</p>}
        </div>
        {entries.length === 0 ? (
          <p>{t("logbook.empty")}</p>
        ) : (
          <div
            className="max-w-full overflow-x-auto rounded-xl border"
            tabIndex={0}
            role="region"
            aria-label={t("logbook.title")}
          >
            <table className="w-full min-w-285 text-left text-sm tabular-nums [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-3">
              <caption className="sr-only">{t("logbook.intro")}</caption>
              <thead className="bg-muted/40">
                <tr>
                  {(
                    [
                      "date",
                      "aircraft",
                      "departure",
                      "arrival",
                      "landings",
                      "pic",
                      "block",
                      "air",
                      "mth",
                      "fuel",
                      "status",
                    ] as const
                  ).map((key) => (
                    <th scope="col" key={key}>
                      {t(`logbook.${key}`)}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">{t("logbook.edit")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map(({ entry: e }) => (
                  <tr
                    key={e.id}
                    data-testid="logbook-row"
                    className="border-t align-top"
                  >
                    <td>
                      <time dateTime={e.startedAt}>
                        {e.startedAt.slice(0, 10)}
                      </time>
                    </td>
                    <td>
                      <strong>{e.registration || "—"}</strong>
                      <div className="text-muted-foreground text-xs">
                        {e.aircraftType || "—"}
                      </div>
                    </td>
                    <td>
                      <strong>{e.departure || "—"}</strong>
                      <div className="text-xs">
                        {t("logbook.offBlock")}: <Time at={e.offBlockAt} />
                      </div>
                      <div className="text-xs">
                        {t("logbook.takeoff")}: <Time at={e.takeoffAt} />
                      </div>
                    </td>
                    <td>
                      <strong>{e.arrival || "—"}</strong>
                      <div className="text-xs">
                        {t("logbook.landing")}: <Time at={e.landingAt} />
                      </div>
                      <div className="text-xs">
                        {t("logbook.onBlock")}: <Time at={e.onBlockAt} />
                      </div>
                    </td>
                    <td>{e.landingCount ?? (e.landingAt !== null ? 1 : 0)}</td>
                    <td className="max-w-48 break-words">{e.pic}</td>
                    <td>
                      {duration(logbookDuration(e.offBlockAt, e.onBlockAt))}
                    </td>
                    <td>
                      {duration(logbookDuration(e.takeoffAt, e.landingAt))}
                    </td>
                    <td>
                      {reading(e.mthBefore)} / {reading(e.mthAfter)}
                    </td>
                    <td>
                      {reading(e.fuelBeforeL)} / {reading(e.fuelAfterL)}
                    </td>
                    <td>
                      {t(
                        e.endedAt === null ? "logbook.active" : "logbook.ended",
                      )}
                    </td>
                    <td>
                      <Button variant="outline" onClick={() => setEditing(e)}>
                        {t("logbook.edit")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {editing && (
        <PicEditor
          key={editing.id}
          entry={editing}
          username={username}
          close={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function PicEditor({
  entry,
  username,
  close,
}: {
  entry: LogbookEntry;
  username: string;
  close: () => void;
}) {
  const t = useT(),
    [pic, setPic] = useState(entry.pic);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("logbook.editTitle")}</DialogTitle>
        <DialogDescription>
          {entry.startedAt.slice(0, 10)} · {entry.departure} → {entry.arrival} ·{" "}
          {entry.registration}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pic.trim()) return;
            useLogbook.getState().editPic(username, entry.id, pic);
            close();
          }}
        >
          <Label htmlFor="logbook-pic">{t("logbook.pic")}</Label>
          <Input
            id="logbook-pic"
            value={pic}
            onChange={(event) => setPic(event.target.value)}
            required
            maxLength={120}
            autoComplete="name"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {t("logbook.cancel")}
            </Button>
            <Button type="submit" disabled={!pic.trim()}>
              {t("logbook.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
