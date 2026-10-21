import { beforeEach, expect, it } from "vitest";
import { newFlight } from "~/data/flight";
import { useAuth } from "~/stores/auth";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { useSettings } from "~/stores/settings";
import { useLogbook } from "~/stores/logbook";
import { logbookFromDebrief, logbookDuration } from "./logbook";

const route = [
  { ident: "EPKK", lat: 50, lon: 20 },
  { ident: "EPNT", lat: 49.46, lon: 20.05 },
];
beforeEach(() => {
  useAuth.getState().signIn({ username: "pilot", token: "test", role: "user" });
  useSettings.setState({ pilotSurname: "Kowalski" });
  useFlight.getState().load({
    ...newFlight(),
    registration: "SP-ABC",
    departure: route[0]!,
    destination: route[1]!,
  });
  useLogbook.setState({ accounts: {}, legacyOwners: {} });
});
function entry() {
  return logbookFromDebrief(useInFlight.getState().debrief!, {
    id: "fallback",
    startedAt: new Date().toISOString(),
    departure: "OTHER",
    arrival: "OTHER",
    pic: "OTHER",
  });
}
it("freezes the user's surname and route per session and gives repeated flights of one plan separate identities", () => {
  useInFlight.getState().start(route, null, null, "C172");
  const a = entry();
  useSettings.setState({ pilotSurname: "Nowak" });
  useFlight
    .getState()
    .update({ departure: { ...route[0]!, ident: "CHANGED" } });
  expect(entry()).toMatchObject({
    pic: "Kowalski",
    departure: "EPKK",
    arrival: "EPNT",
  });
  useInFlight.getState().end();
  useInFlight.getState().start(route, null, null, "C172");
  expect(entry().id).not.toBe(a.id);
  expect(entry().pic).toBe("Nowak");
});
it("uses the username if the user has not set a surname", () => {
  useSettings.setState({ pilotSurname: "  " });
  useInFlight.getState().start(route);
  expect(entry().pic).toBe("pilot");
});
it("closing Fly does not invent takeoff, landing or block events", () => {
  useInFlight.getState().start(route);
  useInFlight.getState().end();
  expect(entry()).toMatchObject({
    takeoffAt: null,
    landingAt: null,
    offBlockAt: null,
    onBlockAt: null,
  });
  expect(entry().endedAt).not.toBeNull();
  expect(logbookDuration(null, 100)).toBeNull();
  expect(logbookDuration(100, 0)).toBeNull();
  expect(logbookDuration(0, 60000)).toBe(60000);
});
it("retains PIC corrections through automatic snapshots and protects unsent edits from remote responses", () => {
  useInFlight.getState().start(route);
  const a = entry();
  useLogbook.getState().put("pilot", a);
  useLogbook.getState().editPic("pilot", a.id, "  Nowak  ");
  useLogbook.getState().put("pilot", { ...a, endedAt: 100 });
  useLogbook.getState().put("pilot", a, true);
  expect(useLogbook.getState().accounts.pilot?.[a.id]).toMatchObject({
    entry: { pic: "Nowak", endedAt: 100 },
    dirty: true,
    picEdit: "Nowak",
  });
  useLogbook.getState().editPic("pilot", a.id, " ");
  expect(useLogbook.getState().accounts.pilot?.[a.id]?.entry.pic).toBe("Nowak");
  expect(useLogbook.getState().accounts.other).toBeUndefined();
});
