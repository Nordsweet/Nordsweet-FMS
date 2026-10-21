import { beforeEach, expect, it } from "vitest";
import { recordAirrep } from "./use-airrep";
import { useAuth } from "~/stores/auth";
import { useAirrep } from "~/stores/airrep";
import { useWind } from "~/stores/wind";
import { emptyWind } from "~/domain/wind-estimation";
import { type GpsFix } from "./use-gps";

const session = "2026-10-21T10:00:00.000Z";
const time = "2026-10-21T11:00:00.000Z";
const at = Date.parse(time);
const route = [
  { ident: "DEP", lat: 49, lon: 20 },
  { ident: "KELEL", lat: 50, lon: 20 },
];
const fix: GpsFix = {
  lat: 50,
  lon: 20,
  time,
  altitudeFt: 4000,
  groundSpeedKt: 100,
  trackDeg: 90,
  accuracyM: 5,
};
beforeEach(() => {
  useAuth.setState({
    session: { username: "pilot", token: "token", role: "user" },
  });
  useAirrep.setState({ pending: [], sent: [] });
  useWind.setState({
    session,
    mode: "gps",
    position: { lat: 49.99, lon: 20.01, at: at - 60000 },
    state: {
      ...emptyWind(),
      lastAcceptedAt: at,
      altitudeM: 1200,
      estimate: {
        at: at - 60000,
        altitudeM: 1200,
        eastMps: 5,
        northMps: 0,
        speedMps: 5,
        fromDeg: 270,
        residualMps: 0.5,
      },
    },
  });
});
it("archives actual measurement position and time, not waypoint coordinates", () => {
  recordAirrep(session, route, 1, fix);
  const report = useAirrep.getState().pending[0]!.report;
  expect(report.lat).toBe(49.99);
  expect(report.observed_at).toBe("2026-10-21T10:59:00.000Z");
  expect(report.passed_at).toBe(time);
  recordAirrep(session, route, 1, { ...fix, time: "2026-10-21T11:00:01.000Z" });
  expect(useAirrep.getState().pending).toHaveLength(1);
});
it("does not upload stale wind, replay positions or a distant skipped fix", () => {
  recordAirrep(session, route, 1, { ...fix, source: "replay" });
  recordAirrep(session, route, 1, { ...fix, lat: 51 });
  useWind.setState((s) => ({ state: { ...s.state, interrupted: true } }));
  recordAirrep(session, route, 1, fix);
  expect(useAirrep.getState().pending).toHaveLength(0);
});
it("labels simulator wind separately", () => {
  useWind.setState({ mode: "simulator" });
  recordAirrep(session, route, 1, { ...fix, source: "connector" });
  expect(useAirrep.getState().pending[0]!.report.source).toBe("simulator");
});
