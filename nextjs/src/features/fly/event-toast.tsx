"use client";

import { useEffect, useState } from "react";

import { useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";

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
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-card/95 absolute bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-2 shadow-lg backdrop-blur"
    >
      <strong>{latest.name}</strong>
      <time className="font-mono text-sm">
        {new Date(latest.at).toLocaleTimeString([], {
          hour: "2-digit",
          hour12: false,
          minute: "2-digit",
          second: "2-digit",
        })}
      </time>
      <button
        type="button"
        aria-label={t("fly.events.closeToast")}
        className="text-muted-foreground hover:text-foreground px-1 text-lg"
        onClick={() => setDismissed(latest.notedAt!)}
      >
        ×
      </button>
    </div>
  );
}
