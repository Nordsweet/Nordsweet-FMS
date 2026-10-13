import { expect, it } from "vitest";
import { newFlight } from "~/data/flight";
import { useFlight } from "./flight";
it("never replaces a pilot edit or loaded modern flight with a delayed legacy migration", () => {
  const modern = { ...newFlight(), name: "Modern" };
  useFlight.setState({ legacyCheckNeeded: true });
  useFlight.getState().load(modern);
  useFlight
    .getState()
    .finishLegacyMigration({ ...newFlight(), name: "Legacy" });
  expect(useFlight.getState().flight.name).toBe("Modern");
  useFlight.setState({ legacyCheckNeeded: true });
  useFlight.getState().update({ name: "Pilot edit" });
  useFlight
    .getState()
    .finishLegacyMigration({ ...newFlight(), name: "Legacy" });
  expect(useFlight.getState().flight.name).toBe("Pilot edit");
});
