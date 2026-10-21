import { beforeEach, expect, it } from "vitest";
import { useAirrep } from "./airrep";
import { type Airrep } from "~/data/airrep";

const report: Airrep = {
  id: "flight.point.1",
  flight_started_at: "2026-10-21T10:00:00.000Z",
  waypoint: "KELEL",
  passed_at: "2026-10-21T11:00:00.000Z",
  observed_at: "2026-10-21T10:59:00.000Z",
  source: "gps",
  lat: 49,
  lon: 20,
  altitude_ft: 4000,
  wind_from_deg: 270,
  wind_speed_kt: 15,
  residual_kt: 1,
};
beforeEach(() => useAirrep.setState({ pending: [], sent: [] }));
it("keeps the original measurement through retries and ignores duplicate passage events", () => {
  useAirrep.getState().enqueue("pilot", report);
  useAirrep.getState().enqueue("pilot", { ...report, wind_speed_kt: 30 });
  expect(useAirrep.getState().pending).toEqual([{ owner: "pilot", report }]);
  useAirrep.getState().acknowledge("pilot", report.id);
  useAirrep.getState().enqueue("pilot", report);
  expect(useAirrep.getState().pending).toEqual([]);
});
it("acknowledging one owner does not discard another owner's observation", () => {
  useAirrep.getState().enqueue("first", report);
  useAirrep.getState().enqueue("second", report);
  useAirrep.getState().acknowledge("first", report.id);
  expect(useAirrep.getState().pending.map((e) => e.owner)).toEqual(["second"]);
});
