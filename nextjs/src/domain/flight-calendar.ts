import { type Flight, newFlight } from "~/data/flight";

/** Date inputs and the existing flight schedule both use device-local wall time. */
export function calendarDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Never carry future or unscheduled flights into a new departure. */
export function previousPlannedFlight(flights: Flight[], departure: string) {
  const start = new Date(departure).getTime();
  return (
    flights
      .filter(
        (f) =>
          f.destination && new Date(f.schedule.departure).getTime() < start,
      )
      .sort(
        (a, b) =>
          new Date(b.schedule.departure).getTime() -
          new Date(a.schedule.departure).getTime(),
      )[0] ?? null
  );
}

/** Only the airframe, loading and remaining fuel carry over; the new route starts empty. */
export function nextPlannedFlight(
  departure: string,
  previous: Flight | null,
  landingFuelL: number | null,
): Flight {
  const flight = newFlight();
  return {
    ...flight,
    schedule: { departure, destination: "" },
    ...(previous
      ? {
          aircraftId: previous.aircraftId,
          registration: previous.registration,
          fuelDisplayUnit: previous.fuelDisplayUnit,
          stationsKg: { ...previous.stationsKg },
          departure: previous.destination,
          fuel: { blockL: Math.max(0, landingFuelL ?? 0) },
        }
      : {}),
  };
}

/** Local calendar arithmetic preserves hour labels across daylight-saving changes. */
export function calendarDays(anchor: string, view: "week" | "month") {
  const start = new Date(`${anchor}T12:00`);
  if (view === "month") start.setDate(1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: view === "week" ? 7 : 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return calendarDate(day);
  });
}
