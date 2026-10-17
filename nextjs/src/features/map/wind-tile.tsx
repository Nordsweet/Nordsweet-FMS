import { ArrowUp, Wind } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  windReadout,
  windStatus,
  windArrowRotation,
} from "~/domain/wind-estimation";
import { mpsToKt } from "~/domain/units";
import { useT } from "~/i18n/use-t";
import { useWind } from "~/stores/wind";
import { type DeckMap } from "./deck";

/** Small live-wind tile; arrow follows map rotation and represents the air's direction of travel. */
export function WindTile({
  mapRef,
  ready,
}: {
  mapRef: RefObject<DeckMap | null>;
  ready: boolean;
}) {
  const t = useT();
  const state = useWind((s) => s.state);
  const [now, setNow] = useState(() => Date.now());
  const arrow = useRef<SVGSVGElement>(null);
  const estimate = state.estimate;
  useEffect(() => {
    if (!estimate) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [estimate]);
  const status = windStatus(state, Math.max(now, state.lastAcceptedAt ?? 0));
  const current = status === "valid" ? estimate : null;
  const direction = current?.fromDeg ?? null;
  useEffect(() => {
    const map = mapRef.current,
      element = arrow.current;
    if (!ready || !map || !element || direction === null) return;
    const update = () => {
      element.style.transform = `rotate(${windArrowRotation(direction, map.getBearing())}deg)`;
    };
    update();
    map.on("move", update);
    return () => map.off("move", update);
  }, [mapRef, ready, direction]);
  const description = current
    ? direction === null
      ? t("wind.calm")
      : t("wind.valid", {
          direction: Math.round(direction) % 360,
          speed: Math.round(mpsToKt(current.speedMps)),
        })
    : t(status === "stale" ? "wind.stale" : "wind.collecting");
  return (
    <div
      data-testid="wind-tile"
      data-wind-state={status}
      aria-label={`${t("wind.title")}: ${description}`}
      title={description}
      className="bg-card/95 text-foreground absolute bottom-32 left-3 z-20 flex size-20 flex-col items-center justify-center gap-1 rounded-xl border shadow-lg backdrop-blur sm:bottom-20"
    >
      {direction !== null ? (
        <ArrowUp
          ref={arrow}
          data-testid="wind-arrow"
          className="text-primary size-8"
          aria-hidden="true"
        />
      ) : (
        <Wind className="text-muted-foreground size-8" aria-hidden="true" />
      )}
      <span className="font-mono text-xs font-semibold tabular-nums">
        {windReadout(current)}
      </span>
    </div>
  );
}
