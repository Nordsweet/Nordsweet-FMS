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

import { optimalWaypointIndex } from "~/domain/waypoint-insertion";
import { useT } from "~/i18n/use-t";
import {
  FlightPlanTable,
  FlightPlanCells,
  flightPlanRowClass,
} from "~/features/fly/flight-plan-table";

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
        <FlightPlanTable interactive label={t("mapinsert.plan")}>
          {preview.map((p, i) => {
            const pending = i === index;
            const before = preview[i - 1];
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
                className={flightPlanRowClass(pending)}
                data-insertion-row={p.ident}
                data-insertion-pending={pending}
              >
                <FlightPlanCells
                  point={p}
                  previous={before}
                  altitudeFt={altitudeFt(p)}
                  selected={pending}
                  pendingLabel={pending ? t("mapinsert.pending") : undefined}
                />
              </button>
            );
          })}
        </FlightPlanTable>
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
