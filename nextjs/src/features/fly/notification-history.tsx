"use client";

import { useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useLocale, useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";
import { useFlightNotificationHistory } from "~/stores/flight-notifications";

/** The same bell and unread count in the standalone map and the flight tool rail. */
export function NotificationBell({
  open,
  onClick,
  className,
}: {
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  const t = useT();
  const session = useInFlight((s) => s.startedAt);
  const history = useFlightNotificationHistory();
  const begin = history.begin;
  useEffect(() => begin(session), [session, begin]);
  const unread =
    session && history.session !== session
      ? 0
      : Math.max(0, history.entries.length - history.readCount);
  return (
    <Button
      aria-label={t("fly.history.title")}
      title={t("fly.history.title")}
      aria-expanded={open}
      variant="outline"
      className={cn(
        "legacy-flight-tool bg-card/90 relative backdrop-blur",
        className,
      )}
      onClick={onClick}
    >
      <Bell className="size-6 text-white" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-label={t("fly.history.unread", { count: unread })}
          className="bg-primary text-primary-foreground absolute top-1 right-1 min-w-4 rounded-full px-1 text-[10px] leading-4 font-bold"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Button>
  );
}

/** Read-only snapshots of the popups actually shown, newest first; closing popups never removes them. */
export function NotificationHistory() {
  const t = useT();
  const locale = useLocale();
  const entries = useFlightNotificationHistory((s) => s.entries);
  const markRead = useFlightNotificationHistory((s) => s.markRead);
  useEffect(() => markRead(), [entries, markRead]);
  if (!entries.length)
    return (
      <p className="text-muted-foreground text-sm">{t("fly.history.empty")}</p>
    );
  return (
    <ol
      aria-label={t("fly.history.title")}
      className="grid gap-2"
      data-testid="notification-history"
    >
      {entries
        .slice()
        .reverse()
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((entry) => (
          <li
            key={entry.id}
            data-category={entry.category}
            className="bg-card/95 text-card-foreground grid gap-1 rounded-xl border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="text-primary text-[10px] font-bold tracking-wider uppercase">
                {t(`fly.popup.${entry.category}`)}
              </span>
              <time
                dateTime={new Date(entry.createdAt).toISOString()}
                className="text-muted-foreground text-xs tabular-nums"
              >
                {new Date(entry.createdAt).toLocaleString(locale, {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </time>
            </div>
            <p className="text-sm font-semibold break-words whitespace-pre-line">
              {entry.message}
            </p>
          </li>
        ))}
    </ol>
  );
}
