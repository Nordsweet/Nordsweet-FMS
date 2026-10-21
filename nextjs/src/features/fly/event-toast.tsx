"use client";

import { useEffect, useState } from "react";

import { useInFlight } from "~/stores/inflight";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

const SHOW_MS = 4200;

/** Legacy flight event toast: a newly recorded named event for 4.2 s (unnamed ones are not shown). */
export function EventToast() {
  const t = useT();
  const events = useInFlight((s) => s.timers.events);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const latest = events
    .filter((e) => e.name.trim() && e.notedAt !== undefined)
    .sort((a, b) => b.notedAt! - a.notedAt!)[0];
  if (
    !latest ||
    latest.notedAt === dismissed ||
    now - latest.notedAt! > SHOW_MS
  )
    return null;
  const name = latest.touchAndGoNumber
    ? t("fly.touchAndGo", { number: latest.touchAndGoNumber })
    : latest.name;
  return (
    <FlightPopup
      category="system"
      notificationId={`event:${latest.notedAt}:${latest.at}:${latest.name}`}
      recordedAt={latest.touchAndGoNumber ? latest.at : latest.notedAt}
      message={`${name} ${new Date(latest.at).toLocaleTimeString([], { hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit" })}`}
      onDismiss={() => setDismissed(latest.notedAt!)}
    >
      <strong>{name}</strong>{" "}
      <time className="font-mono text-sm">
        {new Date(latest.at).toLocaleTimeString([], {
          hour: "2-digit",
          hour12: false,
          minute: "2-digit",
          second: "2-digit",
        })}
      </time>
    </FlightPopup>
  );
}
