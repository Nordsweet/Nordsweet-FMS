import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { useRadioCrossing as RadioStore } from "./radio-crossing";

let useRadioCrossing: typeof RadioStore;
const fis = [
  { frequencyMhz: "119.950", callsign: "Kraków Information", sector: null },
];
const tower = [
  { frequencyMhz: "122.305", callsign: "Nowy Targ Radio", sector: null },
];

beforeEach(async () => {
  vi.resetModules();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  useRadioCrossing = (await import("./radio-crossing")).useRadioCrossing;
});
afterEach(() => vi.unstubAllGlobals());

test("restores the dismissed sector visit without creating another handoff on reload", async () => {
  useRadioCrossing.getState().observe("flight-1", fis, 1000);
  const key = useRadioCrossing.getState().change!.key;
  useRadioCrossing.getState().dismiss(key);
  vi.resetModules();
  useRadioCrossing = (await import("./radio-crossing")).useRadioCrossing;
  useRadioCrossing.getState().observe("flight-1", fis, 2000);
  expect(useRadioCrossing.getState().sequence).toBe(1);
  expect(useRadioCrossing.getState().change!.key).toBe(key);
  expect(useRadioCrossing.getState().dismissed).toContain(key);
  // Leaving and returning is a new visit, even to a previously acknowledged station.
  useRadioCrossing.getState().observe("flight-1", tower, 3000);
  useRadioCrossing.getState().observe("flight-1", fis, 4000);
  expect(useRadioCrossing.getState().dismissed).not.toContain(
    useRadioCrossing.getState().change!.key,
  );
  useRadioCrossing.getState().observe("flight-2", fis, 5000);
  expect(useRadioCrossing.getState().dismissed).toEqual([]);
  expect(useRadioCrossing.getState().sequence).toBe(1);
});

test("ignores malformed saved radio state instead of suppressing future handoffs", async () => {
  localStorage.setItem(
    "nordsweet.radio-crossing.v1",
    JSON.stringify({
      version: 1,
      state: { session: "flight-1", sequence: "bad", dismissed: {} },
    }),
  );
  await useRadioCrossing.persist.rehydrate();
  useRadioCrossing.getState().observe("flight-1", fis, 1000);
  expect(useRadioCrossing.getState().sequence).toBe(1);
  expect(useRadioCrossing.getState().dismissed).toEqual([]);
});
