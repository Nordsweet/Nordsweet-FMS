import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { throttledStorage, WRITE_GAP_MS } from "./throttled-storage";

const disk = () => {
  const values = new Map<string, string>();
  return {
    values,
    setItem: vi.fn((key: string, value: string) => void values.set(key, value)),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("throttledStorage", () => {
  it("writes at once when idle, then at most once per gap with the latest value", async () => {
    const backing = disk();
    const storage = throttledStorage(backing);
    storage.setItem("flight", "1");
    expect(backing.setItem).toHaveBeenCalledTimes(1);

    for (const value of ["2", "3", "4", "5"]) {
      storage.setItem("flight", value);
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(backing.setItem).toHaveBeenCalledTimes(1); // still waiting
    expect(backing.values.get("flight")).toBe("1");

    await vi.advanceTimersByTimeAsync(WRITE_GAP_MS);
    expect(backing.setItem).toHaveBeenCalledTimes(2);
    expect(backing.values.get("flight")).toBe("5"); // the latest, not each in between
  });

  it("a read sees the waiting value, not the older one on disk", () => {
    const backing = disk();
    const storage = throttledStorage(backing);
    storage.setItem("flight", "1");
    storage.setItem("flight", "2");
    expect(backing.values.get("flight")).toBe("1");
    expect(storage.getItem("flight")).toBe("2");
    expect(storage.getItem("other")).toBeNull();
  });

  it("flush writes what is waiting; remove drops it", () => {
    const backing = disk();
    const storage = throttledStorage(backing);
    storage.setItem("flight", "1");
    storage.setItem("flight", "2");
    storage.flush();
    expect(backing.values.get("flight")).toBe("2");

    storage.setItem("flight", "3");
    storage.removeItem("flight");
    storage.flush();
    expect(backing.values.has("flight")).toBe(false);
  });

  it("keys are throttled separately", async () => {
    const backing = disk();
    const storage = throttledStorage(backing);
    storage.setItem("a", "1");
    storage.setItem("b", "1");
    expect(backing.setItem).toHaveBeenCalledTimes(2);
    storage.setItem("a", "2");
    storage.setItem("b", "2");
    await vi.advanceTimersByTimeAsync(WRITE_GAP_MS);
    expect(backing.values.get("a")).toBe("2");
    expect(backing.values.get("b")).toBe("2");
  });

  it("a full storage does not throw out of the store's update, and later writes are tried again", async () => {
    const backing = disk();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    backing.setItem.mockImplementationOnce(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const storage = throttledStorage(backing);
    expect(() => storage.setItem("flight", "1")).not.toThrow();
    expect(backing.values.has("flight")).toBe(false);

    storage.setItem("flight", "2");
    await vi.advanceTimersByTimeAsync(WRITE_GAP_MS);
    expect(backing.values.get("flight")).toBe("2");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("writes what is waiting when the page is hidden or closed", () => {
    const events = new EventTarget();
    const page = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    vi.stubGlobal("window", events);
    vi.stubGlobal("document", page);
    const backing = disk();
    const storage = throttledStorage(backing);
    storage.setItem("flight", "1");
    storage.setItem("flight", "2");
    events.dispatchEvent(new Event("pagehide"));
    expect(backing.values.get("flight")).toBe("2");

    storage.setItem("flight", "3");
    page.visibilityState = "hidden";
    page.dispatchEvent(new Event("visibilitychange"));
    expect(backing.values.get("flight")).toBe("3");
  });
});
