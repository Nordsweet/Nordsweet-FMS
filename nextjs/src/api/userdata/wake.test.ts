import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WAKE_GAP_MS, wakeOnReturn } from "./wake";

const page = Object.assign(new EventTarget(), { visibilityState: "visible" });
beforeEach(() => {
  page.visibilityState = "visible";
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", page);
});
afterEach(() => vi.unstubAllGlobals());

const fire = (target: EventTarget, type: string) =>
  target.dispatchEvent(new Event(type));

describe("wakeOnReturn", () => {
  it("looks once when a tab is switched back to (focus and visibilitychange together)", () => {
    const onWake = vi.fn();
    let now = 1000;
    const stop = wakeOnReturn(onWake, () => now);
    fire(window, "focus");
    fire(document, "visibilitychange");
    expect(onWake).toHaveBeenCalledTimes(1);

    now += WAKE_GAP_MS; // a later return counts again
    fire(document, "visibilitychange");
    expect(onWake).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not wake for a tab that became hidden", () => {
    const onWake = vi.fn();
    const stop = wakeOnReturn(onWake, () => 1000);
    page.visibilityState = "hidden";
    fire(document, "visibilitychange");
    expect(onWake).not.toHaveBeenCalled();
    stop();
  });

  it("always wakes when the connection is back, even right after a focus", () => {
    const onWake = vi.fn();
    const stop = wakeOnReturn(onWake, () => 1000);
    fire(window, "focus");
    fire(window, "online");
    expect(onWake).toHaveBeenCalledTimes(2);
    // ...and that wake-up counts as the last one for the tab events that follow.
    fire(document, "visibilitychange");
    expect(onWake).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops listening when stopped", () => {
    const onWake = vi.fn();
    wakeOnReturn(onWake, () => 1000)();
    fire(window, "focus");
    fire(window, "online");
    expect(onWake).not.toHaveBeenCalled();
  });
});
