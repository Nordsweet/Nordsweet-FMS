import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { atisValue, emptyAtisPad } from "~/domain/atis-pad";

import type { useAtis as AtisStoreHook } from "./atis";
let useAtis: typeof AtisStoreHook;
beforeEach(async () => {
  vi.resetModules();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  useAtis = (await import("./atis")).useAtis;
  useAtis.setState({ airport: null, pad: emptyAtisPad(), records: {} });
});
afterEach(() => vi.unstubAllGlobals());

test("retains independent airport pads for performance and restores them on reopening", () => {
  useAtis.getState().open("EPKK");
  useAtis
    .getState()
    .dispatch({ type: "preset", field: "qnh", value: "QNH 1017" });
  useAtis.getState().open("EPGD");
  expect(atisValue(useAtis.getState().pad, "qnh")).toBe("");
  useAtis
    .getState()
    .dispatch({ type: "preset", field: "qnh", value: "QNH 1001" });
  expect(atisValue(useAtis.getState().records.EPKK!, "qnh")).toBe("QNH 1017");
  useAtis.getState().open("EPKK");
  expect(atisValue(useAtis.getState().pad, "qnh")).toBe("QNH 1017");
  useAtis.getState().dispatch({ type: "reset" });
  expect(atisValue(useAtis.getState().records.EPKK!, "qnh")).toBe("");
  expect(atisValue(useAtis.getState().records.EPGD!, "qnh")).toBe("QNH 1001");
});

test("migrates the previous single pad into airport records on hydration", async () => {
  const pad = emptyAtisPad();
  pad.qnh = { base: "1000", tens: "1", ones: "3" };
  localStorage.setItem(
    "nordsweet.atis.v1",
    JSON.stringify({ version: 1, state: { airport: "EPKK", pad } }),
  );
  await useAtis.persist.rehydrate();
  expect(atisValue(useAtis.getState().records.EPKK!, "qnh")).toBe("QNH 1013");
});
