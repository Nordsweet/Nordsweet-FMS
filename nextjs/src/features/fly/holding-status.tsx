import { useEffect, useState } from "react";
import { useInFlight } from "~/stores/inflight";
import { useFlight } from "~/stores/flight";
import { useT } from "~/i18n/use-t";
import { Button } from "~/components/ui/button";
import { useGps } from "./use-gps";

export function HoldingStatus() {
  const t = useT();
  const navigation = useInFlight();
  const update = useFlight((s) => s.update);
  const { fix, error } = useGps(!!navigation.startedAt);
  const [now, setNow] = useState(() => Date.now());
  const visible = !!navigation.startedAt && !!navigation.holding;
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);
  const hold = navigation.holding;
  if (!visible || !hold) return null;
  const remaining =
    hold.timerStartedAt === null
      ? null
      : Math.max(
          0,
          Math.min(
            Math.ceil(hold.config.legSeconds),
            Math.ceil(
              (hold.timerStartedAt + hold.config.legSeconds * 1000 - now) /
                1000,
            ),
          ),
        );
  return (
    <section
      aria-label={t("holding.title")}
      data-holding-phase={hold.phase}
      className="bg-background/95 text-foreground absolute top-3 left-20 z-20 grid max-w-72 gap-1 rounded-xl border p-3 text-sm shadow-lg"
    >
      <strong>
        {hold.config.fix.ident} HOLD · {hold.config.levelFt} ft
      </strong>
      <span>{t("holding.entry", { entry: t(`holding.${hold.entry}`) })}</span>
      <span>{t(`holding.${hold.phase}`)}</span>
      {remaining !== null && (
        <output aria-live="off" data-holding-timer>
          {Math.floor(remaining / 60)
            .toString()
            .padStart(2, "0")}
          :{(remaining % 60).toString().padStart(2, "0")}
        </output>
      )}
      {remaining === 0 && <strong role="status">{t("holding.elapsed")}</strong>}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigation.exitHolding(
            !error && fix && now - Date.parse(fix.time) <= 20000 ? fix : null,
          );
          update({ holding: null });
        }}
      >
        {t(hold.phase === "armed" ? "holding.remove" : "holding.exit")}
      </Button>
    </section>
  );
}
