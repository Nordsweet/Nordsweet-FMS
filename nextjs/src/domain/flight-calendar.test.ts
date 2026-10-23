import { expect, test } from "vitest";
import { newFlight } from "~/data/flight";
import {
  calendarDays,
  nextPlannedFlight,
  previousPlannedFlight,
} from "./flight-calendar";

test("new flight inherits the previous destination and precise fuel but clears the old route", () => {
  const previous = {
    ...newFlight(),
    registration: "SP-ABC",
    aircraftId: "C172S",
    destination: { ident: "EPNT", lat: 49.46, lon: 20.04 },
    fuelDisplayUnit: "US gal" as const,
    routeText: "KELEL",
    stationsKg: { pilot: 80 },
  };
  const next = nextPlannedFlight("2026-10-23T14:00", previous, 64.567);
  expect(next.departure).toEqual(previous.destination);
  expect(next.destination).toBeNull();
  expect(next.fuel.blockL).toBe(64.567);
  expect(next.registration).toBe("SP-ABC");
  expect(next.fuelDisplayUnit).toBe("US gal");
  expect(next.routeText).toBe("");
  expect(next.id).not.toBe(previous.id);
  expect(next.schedule).toEqual({
    departure: "2026-10-23T14:00",
    destination: "",
  });
  expect(previous.fuel.blockL).toBe(0);
});

test("predecessor is the latest scheduled flight strictly before departure with a landing airport", () => {
  const flight = (time: string) => ({
    ...newFlight(),
    schedule: { departure: time, destination: "" },
    destination: { ident: "EPKK", lat: 50, lon: 20 },
  });
  const first = flight("2026-10-23T09:00");
  const last = flight("2026-10-23T11:00");
  const future = flight("2026-10-23T14:00");
  expect(
    previousPlannedFlight(
      [future, last, first, newFlight()],
      "2026-10-23T14:00",
    ),
  ).toBe(last);
  expect(previousPlannedFlight([first], "2026-10-22T12:00")).toBeNull();
  expect(previousPlannedFlight([first], "")).toBeNull();
});

test("weeks start on Monday and calendar days stay consecutive across DST and month boundaries", () => {
  expect(calendarDays("2026-10-25", "week")).toEqual([
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
  ]);
  const month = calendarDays("2026-11-15", "month");
  expect(month).toHaveLength(42);
  expect(month[0]).toBe("2026-10-26");
  expect(month[41]).toBe("2026-12-06");
});
