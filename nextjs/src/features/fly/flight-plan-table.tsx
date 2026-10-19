import { type ReactNode } from "react";
import { CornerDownRight } from "lucide-react";
import { type FlightPoint } from "~/data/flight";
import { distanceNm, initialBearingDeg } from "~/domain/geo";
import { magneticVariationDeg, trueToMagneticDeg } from "~/domain/magnetic";
import { cn } from "~/lib/utils";

export const flightPlanRowClass = (selected: boolean, actions = false) =>
  cn(
    "relative grid w-full items-center gap-2 border-b border-l-4 px-3 py-3 text-left font-mono text-sm last:border-b-0",
    actions
      ? "grid-cols-3 sm:grid-cols-[minmax(0,1fr)_3rem_4rem_4rem_5rem]"
      : "grid-cols-[minmax(0,1fr)_3rem_4rem_4rem] sm:grid-cols-[minmax(0,1fr)_4rem_5rem_6rem]",
    selected
      ? "bg-primary/15 text-primary border-l-fuchsia-400 font-bold"
      : "border-l-transparent",
  );

/** The same G1000-inspired columns and leg readouts serve FPL and waypoint insertion. */
export function FlightPlanTable({
  children,
  label,
  interactive = false,
  actions = false,
}: {
  children: ReactNode;
  label: string;
  interactive?: boolean;
  actions?: boolean;
}) {
  return (
    <div
      className="bg-background/60 overflow-hidden rounded-2xl border"
      data-testid="flight-plan-table"
    >
      <div
        className={cn(
          "text-muted-foreground grid gap-2 border-b px-3 py-2 font-mono text-xs font-semibold",
          actions
            ? "grid-cols-3 sm:grid-cols-[minmax(0,1fr)_3rem_4rem_4rem_5rem]"
            : "grid-cols-[minmax(0,1fr)_3rem_4rem_4rem] sm:grid-cols-[minmax(0,1fr)_4rem_5rem_6rem]",
        )}
      >
        <span className={actions ? "col-span-3 sm:col-span-1" : undefined}>
          FPL
        </span>
        <span className="text-right">DTK °M</span>
        <span className="text-right">DIS NM</span>
        <span className="text-right">ALT FT</span>
        {actions && <span aria-hidden="true" className="hidden sm:block" />}
      </div>
      <div
        role={interactive ? "listbox" : "list"}
        aria-label={label}
        className="max-h-[48dvh] overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}
export function FlightPlanCells({
  point,
  previous,
  altitudeFt,
  selected = false,
  pendingLabel,
  actions = false,
}: {
  point: FlightPoint;
  previous?: FlightPoint;
  altitudeFt: number | null;
  selected?: boolean;
  pendingLabel?: string;
  actions?: boolean;
}) {
  const heading = previous
    ? Math.round(
        trueToMagneticDeg(
          initialBearingDeg(previous, point),
          magneticVariationDeg(previous),
        ),
      ) % 360 || 360
    : null;
  return (
    <>
      <span
        className={cn(
          "flex min-w-0 items-center gap-2",
          actions &&
            "col-span-3 min-h-6 max-w-[calc(100%-5rem)] sm:col-span-1 sm:max-w-none",
        )}
      >
        {selected && (
          <CornerDownRight className="size-4 shrink-0 text-fuchsia-400" />
        )}
        <span className="truncate">{point.ident}</span>
        {pendingLabel && <span className="text-[10px]">{pendingLabel}</span>}
      </span>
      <span className="text-right">
        {heading === null ? "—" : String(heading).padStart(3, "0")}
      </span>
      <span className="text-right">
        {previous ? distanceNm(previous, point).toFixed(1) : "—"}
      </span>
      <span className="text-right">
        {altitudeFt === null ? "—" : Math.round(altitudeFt)}
      </span>
    </>
  );
}
