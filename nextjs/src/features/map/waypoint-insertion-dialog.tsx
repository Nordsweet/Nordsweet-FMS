import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { type FlightPoint } from "~/data/flight";
import { distanceNm, initialBearingDeg } from "~/domain/geo";
import { magneticVariationDeg, trueToMagneticDeg } from "~/domain/magnetic";
import { optimalWaypointIndex } from "~/domain/waypoint-insertion";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";

/** Flight-plan insertion preview: clicking a row selects the slot immediately before it. */
export function WaypointInsertionDialog({
  point,
  route,
  altitudeFt,
  close,
  insert,
}: {
  point: FlightPoint;
  route: FlightPoint[];
  altitudeFt: (point: FlightPoint) => number | null;
  close: () => void;
  insert: (index: number) => void;
}) {
  const t = useT();
  const suggested = optimalWaypointIndex(route, point);
  const [index, setIndex] = useState(suggested);
  const pendingRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    pendingRef.current?.scrollIntoView({ block: "nearest" });
  }, [index]);
  const preview = [...route.slice(0, index), point, ...route.slice(index)];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="w-[min(42rem,calc(100vw-2rem))]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          pendingRef.current?.focus();
        }}
      >
        <DialogTitle>
          {t("mapinsert.title", { point: point.ident })}
        </DialogTitle>
        <DialogDescription>{t("mapinsert.hint")}</DialogDescription>
        <div className="bg-background/60 overflow-hidden rounded-2xl border">
          <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_3rem_4rem_4rem] gap-2 border-b px-3 py-2 font-mono text-xs font-semibold sm:grid-cols-[minmax(0,1fr)_4rem_5rem_6rem]">
            <span>FPL</span>
            <span className="text-right">DTK °M</span>
            <span className="text-right">DIS NM</span>
            <span className="text-right">ALT FT</span>
          </div>
          <div
            role="listbox"
            aria-label={t("mapinsert.plan")}
            className="max-h-[48dvh] overflow-y-auto"
          >
            {preview.map((p, i) => {
              const pending = i === index;
              const before = preview[i - 1];
              const heading = before
                ? Math.round(
                    trueToMagneticDeg(
                      initialBearingDeg(before, p),
                      magneticVariationDeg(before),
                    ),
                  ) % 360
                : null;
              const altitude = altitudeFt(p);
              return (
                <button
                  ref={pending ? pendingRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={pending}
                  aria-label={
                    pending
                      ? t("mapinsert.new", { point: p.ident })
                      : t("mapinsert.before", { point: p.ident })
                  }
                  key={`${i}|${p.ident}`}
                  onClick={() => {
                    if (!pending) setIndex(i < index ? i : i - 1);
                  }}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_3rem_4rem_4rem] items-center gap-2 border-b px-3 py-3 text-left font-mono text-sm last:border-0 hover:bg-white/5 sm:grid-cols-[minmax(0,1fr)_4rem_5rem_6rem]",
                    pending
                      ? "bg-primary/15 text-primary border-l-4 border-l-fuchsia-400 font-bold"
                      : "border-l-4 border-l-transparent",
                  )}
                  data-insertion-row={p.ident}
                  data-insertion-pending={pending}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {pending && (
                      <CornerDownRight className="size-4 shrink-0 text-fuchsia-400" />
                    )}
                    <span className="truncate">{p.ident}</span>
                    {pending && (
                      <span className="text-[10px]">
                        {t("mapinsert.pending")}
                      </span>
                    )}
                  </span>
                  <span className="text-right">
                    {heading === null ? "—" : String(heading).padStart(3, "0")}
                  </span>
                  <span className="text-right">
                    {before ? distanceNm(before, p).toFixed(1) : "—"}
                  </span>
                  <span className="text-right">
                    {altitude === null ? "—" : Math.round(altitude)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p role="status" className="text-muted-foreground text-sm">
          {t(
            index === suggested ? "mapinsert.suggested" : "mapinsert.selected",
          )}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            className="h-16 flex-col gap-1 rounded-[13px]"
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            <ArrowUp className="size-5" />
            {t("mapinsert.up")}
          </Button>
          <Button
            className="h-16 flex-col gap-1 rounded-[13px]"
            variant="outline"
            disabled={index === route.length}
            onClick={() => setIndex(index + 1)}
          >
            <ArrowDown className="size-5" />
            {t("mapinsert.down")}
          </Button>
          <Button
            className="h-16 flex-col gap-1 rounded-[13px]"
            onClick={() => insert(index)}
          >
            <CornerDownRight className="size-5" />
            {t("mapinsert.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
