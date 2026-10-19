import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { positionStorage } from "./position-source";

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};
beforeEach(() => {
  vi.stubGlobal("localStorage", memory());
  vi.stubGlobal("sessionStorage", memory());
});
afterEach(() => vi.unstubAllGlobals());
const key = "nordsweet.position-source.v1";

test("migrates the existing Connector session once to persistent device storage", () => {
  const saved = JSON.stringify({
    state: { url: "https://pc.example.ts.net", token: "example-token" },
  });
  sessionStorage.setItem(key, saved);
  expect(positionStorage.getItem(key)).toBe(saved);
  expect(localStorage.getItem(key)).toBe(saved);
  expect(sessionStorage.getItem(key)).toBeNull();
});

test("persistent settings take precedence over an old tab's session", () => {
  localStorage.setItem(key, "current");
  sessionStorage.setItem(key, "old");
  expect(positionStorage.getItem(key)).toBe("current");
  positionStorage.setItem(key, "updated");
  expect(localStorage.getItem(key)).toBe("updated");
  expect(sessionStorage.getItem(key)).toBeNull();
  positionStorage.removeItem(key);
  expect(localStorage.getItem(key)).toBeNull();
});
