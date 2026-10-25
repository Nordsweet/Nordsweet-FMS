import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { engineTimerSeconds } from "~/domain/engine-timers";
import type { FlightPhase } from "~/domain/flight-phase";
import { useEngineTimers } from "~/stores/engine-timers";
import { useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";

export function EngineTimerAssistant({
  session,
  phase,
}: {
  session: string;
  phase: FlightPhase;
}) {
  const t = useT();
  const timers = useEngineTimers();
  const offBlock = useInFlight((s) =>
    s.startedAt === session ? s.timers.offBlock.startedAt : null,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (phase !== "taxiout" && phase !== "taxiin") return null;
  const warm = phase === "taxiout";
  if (warm && offBlock !== null) return null;
  const startedAt =
    timers.session !== session
      ? null
      : warm
        ? timers.warmStartedAt
        : timers.coolStartedAt;
  const seconds = engineTimerSeconds(startedAt, now);
  return (
    <section
      aria-label={t(warm ? "engineTimers.warm" : "engineTimers.cool")}
      className="bg-card/95 text-card-foreground border-primary/25 absolute top-3 left-20 z-20 grid max-w-60 gap-2 rounded-2xl border p-3 text-sm shadow-lg backdrop-blur"
    >
      <strong className="text-primary">
        {t(warm ? "engineTimers.warm" : "engineTimers.cool")}
      </strong>
      <output
        data-testid="engine-assistant-timer"
        className="text-primary font-mono text-2xl font-bold tabular-nums"
      >
        {Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}
        :{(seconds % 60).toString().padStart(2, "0")}
      </output>
      {warm && startedAt === null && (
        <Button size="sm" onClick={() => timers.startWarm(session, Date.now())}>
          {t("engineTimers.start")}
        </Button>
      )}
      {!warm && startedAt === null && (
        <span className="text-muted-foreground text-xs">
          {t("engineTimers.stop")}
        </span>
      )}
      {startedAt !== null && seconds === 0 && (
        <span role="status">{t("engineTimers.ready")}</span>
      )}
    </section>
  );
}
