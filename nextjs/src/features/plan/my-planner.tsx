"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Plane,
  CalendarDays,
} from "lucide-react";
import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { type Flight } from "~/data/flight";
import {
  calendarDate,
  calendarDays,
  nextPlannedFlight,
  previousPlannedFlight,
} from "~/domain/flight-calendar";
import { formatFuel, fuelUnit } from "~/domain/fuel-units";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";
import { useSettings } from "~/stores/settings";
import { cn } from "~/lib/utils";
import { usePlan } from "./use-plan";

/** Schedule events stay in the existing saved-flight library and account sync. */
export function MyPlanner({ onEdit }: { onEdit: () => void }) {
  const t = useT();
  const language = useSettings((s) => s.language);
  const [anchor, setAnchor] = useState(() => calendarDate(new Date()));
  const [view, setView] = useState<"week" | "month">("week");
  const [creating, setCreating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Flight | null>(null);
  const flights = useQuery(api.flights.list.queryOptions(undefined));
  const client = useQueryClient();
  const remove = useMutation({
    ...api.flights.save.mutationOptions(),
    onSuccess: () => {
      setSelected(null);
      void client.invalidateQueries({ queryKey: ["flights.list"] });
    },
  });
  const scheduled = (flights.data ?? []).filter((f) =>
    Number.isFinite(new Date(f.schedule.departure).getTime()),
  );
  const days = calendarDays(anchor, view);
  const flightsOnDay = (day: string) => {
    const previousDay = new Date(`${day}T12:00`);
    previousDay.setDate(previousDay.getDate() - 1);
    return scheduled.filter(
      (f) =>
        f.schedule.departure.slice(0, 10) === day ||
        (view === "week" &&
          f.schedule.departure.slice(0, 10) === calendarDate(previousDay)),
    );
  };
  const locale = language === "pl" ? "pl-PL" : "en-GB";
  const dayLabel = (day: string) =>
    new Date(`${day}T12:00`).toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  const shift = (direction: number) => {
    const date = new Date(`${anchor}T12:00`);
    if (view === "month") {
      date.setDate(1);
      date.setMonth(date.getMonth() + direction);
    } else date.setDate(date.getDate() + direction * 7);
    setAnchor(calendarDate(date));
  };
  return (
    <section aria-label={t("planner.title")} className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setCreating(`${anchor}T09:00`)}>
          <Plus className="size-4" />
          {t("planner.add")}
        </Button>
        <Button
          variant="outline"
          onClick={() => setAnchor(calendarDate(new Date()))}
        >
          {t("planner.today")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("planner.previous")}
          onClick={() => shift(-1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("planner.next")}
          onClick={() => shift(1)}
        >
          <ChevronRight />
        </Button>
        <h2 className="min-w-40 flex-1 font-semibold">
          {new Date(`${anchor}T12:00`).toLocaleDateString(locale, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        {(["week", "month"] as const).map((mode) => (
          <Button
            key={mode}
            variant={view === mode ? "default" : "outline"}
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
          >
            {t(`planner.${mode}`)}
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{t("planner.hint")}</p>
      {flights.isError && <p role="alert">{t("planner.error")}</p>}
      <div
        className="max-h-[70vh] overflow-auto rounded-xl border"
        data-testid="flight-calendar"
      >
        <div className="min-w-175">
          <div
            className={cn(
              "bg-card sticky top-0 z-20 grid border-b",
              view === "week"
                ? "grid-cols-[3rem_repeat(7,minmax(0,1fr))]"
                : "grid-cols-7",
            )}
          >
            {view === "week" && <span className="p-2 text-xs">24h</span>}
            {days.slice(0, 7).map((day) => (
              <div
                key={day}
                className="border-l p-2 text-center text-xs font-semibold"
              >
                {dayLabel(day)}
              </div>
            ))}
          </div>
          {view === "week" ? (
            <div
              className="relative grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]"
              style={{ height: 1152 }}
            >
              <div>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className="text-muted-foreground h-12 pr-1 text-right text-[10px]"
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  className="relative border-l"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, transparent 0, transparent 47px, var(--border) 47px, var(--border) 48px)",
                  }}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <button
                      key={hour}
                      className="absolute right-0 left-0 h-12 hover:bg-white/5 focus-visible:bg-white/10"
                      style={{ top: hour * 48 }}
                      aria-label={`${t("planner.add")} ${day} ${hour}:00`}
                      onClick={() =>
                        setCreating(
                          `${day}T${String(hour).padStart(2, "0")}:00`,
                        )
                      }
                    />
                  ))}
                  {flightsOnDay(day).map((flight, index, list) => (
                    <CalendarFlight
                      key={flight.id}
                      flight={flight}
                      day={day}
                      mode="week"
                      index={index}
                      columns={list.length}
                      onSelect={() => setSelected(flight)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((day) => (
                <div
                  key={day}
                  className={cn(
                    "min-h-28 border-r border-b p-1",
                    day.slice(0, 7) !== anchor.slice(0, 7) && "opacity-50",
                  )}
                >
                  <button
                    className="hover:text-primary mb-1 w-full text-right text-xs"
                    aria-label={`${t("planner.add")} ${day}`}
                    onClick={() => setCreating(`${day}T09:00`)}
                  >
                    {new Date(`${day}T12:00`).getDate()}
                  </button>
                  {flightsOnDay(day).map((flight, index) => (
                    <CalendarFlight
                      key={flight.id}
                      flight={flight}
                      day={day}
                      mode="month"
                      index={index}
                      onSelect={() => setSelected(flight)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {scheduled.length === 0 && (
        <p className="text-muted-foreground py-4 text-center">
          <CalendarDays className="mx-auto mb-2" />
          {t("planner.empty")}
        </p>
      )}
      <Dialog
        open={creating !== null}
        onOpenChange={(open) => {
          if (!open) setCreating(null);
        }}
      >
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogTitle>{t("planner.add")}</DialogTitle>
          <Label htmlFor="new-planned-departure">
            {t("planner.departure")}
          </Label>
          <Input
            id="new-planned-departure"
            type="datetime-local"
            value={creating ?? ""}
            onChange={(e) => setCreating(e.target.value)}
          />
          {creating !== null && (
            <CreatePlannedFlight
              departure={creating}
              previous={previousPlannedFlight(scheduled, creating)}
              onCreated={() => {
                setCreating(null);
                onEdit();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogTitle>
            {selected?.name?.trim()
              ? selected.name
              : `${selected?.departure?.ident ?? "?"} → ${selected?.destination?.ident ?? "?"}`}
          </DialogTitle>
          {selected && (
            <>
              <p>
                {dayLabel(selected.schedule.departure.slice(0, 10))} ·{" "}
                {selected.schedule.departure.slice(11, 16)} ·{" "}
                {selected.registration}
              </p>
              <Button
                onClick={() => {
                  useFlight.getState().load(selected);
                  setSelected(null);
                  onEdit();
                }}
              >
                {t("planner.edit")}
              </Button>
              <Button
                variant="outline"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate({
                    ...selected,
                    schedule: { departure: "", destination: "" },
                  })
                }
              >
                {t("planner.remove")}
              </Button>
              <p className="text-muted-foreground text-xs">
                {t("planner.removeHint")}
              </p>
              {remove.isError && <p role="alert">{t("planner.error")}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CalendarFlight({
  flight,
  day,
  mode,
  index,
  columns = 1,
  onSelect,
}: {
  flight: Flight;
  day: string;
  mode: "week" | "month";
  index: number;
  columns?: number;
  onSelect: () => void;
}) {
  const t = useT();
  const { eteMinutes, schedule } = usePlan(flight);
  const start = new Date(schedule.departure).getTime();
  const duration =
    Number.isFinite(eteMinutes) && eteMinutes > 0 ? eteMinutes : null;
  const end = start + (duration ?? 15) * 60_000;
  const dayStart = new Date(`${day}T00:00`).getTime();
  const next = new Date(`${day}T00:00`);
  next.setDate(next.getDate() + 1);
  if (end <= dayStart || start >= next.getTime()) return null;
  const clippedStart = new Date(Math.max(start, dayStart));
  const clippedEnd =
    end >= next.getTime()
      ? 1440
      : new Date(end).getHours() * 60 + new Date(end).getMinutes();
  const minutes = clippedStart.getHours() * 60 + clippedStart.getMinutes();
  const route = `${flight.departure?.ident ?? "?"} → ${flight.destination?.ident ?? "?"}`;
  const description = `${schedule.departure.slice(11, 16)} · ${route} · ${flight.registration} · ${duration === null ? t("planner.incomplete") : t("planner.duration", { minutes: Math.round(duration) })}`;
  return (
    <button
      type="button"
      data-testid="calendar-flight"
      data-flight-id={flight.id}
      aria-label={description}
      title={description}
      onClick={onSelect}
      className={cn(
        "border-primary/40 bg-primary/20 hover:bg-primary/35 text-foreground z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] shadow-sm",
        mode === "week" ? "absolute right-1 left-1" : "mb-1 block w-full",
      )}
      style={
        mode === "week"
          ? {
              top: minutes * 0.8,
              height: Math.max(22, (clippedEnd - minutes) * 0.8),
              left: `calc(${(index * 100) / columns}% + 2px)`,
              width: `calc(${100 / columns}% - 4px)`,
            }
          : undefined
      }
    >
      <span className="block truncate font-semibold">
        <Plane className="mr-1 inline size-3" />
        {flight.name || route}
      </span>
      <span className="block truncate">
        {schedule.departure.slice(11, 16)} · {flight.registration}
      </span>
      {duration !== null && (
        <span>{t("planner.duration", { minutes: Math.round(duration) })}</span>
      )}
    </button>
  );
}

function CreatePlannedFlight({
  departure,
  previous,
  onCreated,
}: {
  departure: string;
  previous: Flight | null;
  onCreated: () => void;
}) {
  const t = useT();
  // The same calculation used by Fuel supplies the carry-over, in internal litres.
  const { fuelPlanning, aircraft } = usePlan(previous ?? undefined);
  const rows = previous ? fuelPlanning?.rows : null;
  const fuelL =
    previous && rows
      ? Math.max(
          0,
          previous.fuel.blockL -
            [
              rows.plannedTrip,
              rows.startTaxi,
              rows.climb,
              rows.departureArrival,
            ].reduce((sum, row) => sum + (row.fuelL ?? 0), 0),
        )
      : null;
  const unit = fuelUnit(aircraft?.type, previous?.fuelDisplayUnit);
  const client = useQueryClient();
  const save = useMutation({
    ...api.flights.save.mutationOptions(),
    onSuccess: (flight) => {
      useFlight.getState().load(flight);
      void client.invalidateQueries({ queryKey: ["flights.list"] });
      onCreated();
    },
  });
  const valid = Number.isFinite(new Date(departure).getTime());
  return (
    <>
      {previous ? (
        <div className="bg-primary/5 grid gap-2 rounded-xl border p-3">
          <p>
            {t("planner.inherit", {
              route: `${previous.departure?.ident ?? "?"} → ${previous.destination?.ident}`,
              registration: previous.registration,
            })}
          </p>
          <p>
            {fuelL === null
              ? t("planner.fuelUnknown")
              : t("planner.fuel", {
                  fuel: `${formatFuel(fuelL, unit)} ${unit}`,
                })}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t("planner.none")}</p>
      )}
      {!valid && <p role="alert">{t("planner.invalid")}</p>}
      {save.isError && <p role="alert">{t("planner.error")}</p>}
      <Button
        disabled={!valid || save.isPending}
        onClick={() =>
          save.mutate(nextPlannedFlight(departure, previous, fuelL))
        }
      >
        {t("planner.create")}
      </Button>
    </>
  );
}

/** Saving an edited calendar event replaces that event, rather than creating another snapshot. */
export function SavePlannerFlightButton() {
  const t = useT();
  const { flight } = usePlan();
  const [open, setOpen] = useState(false);
  const [departure, setDeparture] = useState("");
  const [message, setMessage] = useState(false);
  const client = useQueryClient();
  const save = useMutation({
    ...api.flights.save.mutationOptions(),
    onSuccess: (saved) => {
      useFlight.getState().load(saved);
      void client.invalidateQueries({ queryKey: ["flights.list"] });
      setOpen(false);
      setMessage(true);
    },
  });
  return (
    <div className="grid gap-1">
      <Button
        variant="outline"
        onClick={() => {
          setDeparture(flight.schedule.departure);
          setOpen(true);
          setMessage(false);
        }}
      >
        <CalendarDays className="size-4" />
        {t("planner.save")}
      </Button>
      {message && (
        <span role="status" className="text-xs">
          {t("planner.saved")}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogTitle>{t("planner.save")}</DialogTitle>
          <Label htmlFor="save-planned-departure">
            {t("planner.departure")}
          </Label>
          <Input
            id="save-planned-departure"
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {t("planner.saveHint")}
          </p>
          {save.isError && <p role="alert">{t("planner.error")}</p>}
          <Button
            disabled={
              save.isPending || !Number.isFinite(new Date(departure).getTime())
            }
            onClick={() =>
              save.mutate({
                ...flight,
                schedule: {
                  departure,
                  destination:
                    departure === flight.schedule.departure
                      ? flight.schedule.destination
                      : "",
                },
              })
            }
          >
            {t("planner.save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
