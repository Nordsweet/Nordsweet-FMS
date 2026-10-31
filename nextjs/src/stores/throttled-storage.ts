import { type StateStorage } from "zustand/middleware";

/** The longest a change waits before it is written. */
export const WRITE_GAP_MS = 2000;

type Backing = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * `localStorage` for a store that changes several times a second and holds a lot (the flight in
 * progress). The persist middleware writes the whole store on every change; this writes at most once
 * per `gapMs` per key, always the latest value: right away when idle, otherwise when the gap is over.
 * Whatever is waiting is written when the page is hidden or closed, so a reload keeps the last state.
 * A full or blocked storage is not an error for the caller: the app keeps running on memory.
 */
export function throttledStorage(
  backing: Backing,
  gapMs = WRITE_GAP_MS,
  now: () => number = Date.now,
): StateStorage & { flush: () => void } {
  const waiting = new Map<string, string>();
  const lastWrite = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let warned = false;

  const write = (name: string) => {
    const value = waiting.get(name);
    if (value === undefined) return;
    waiting.delete(name);
    lastWrite.set(name, now());
    try {
      backing.setItem(name, value);
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn(`Could not save ${name} (storage full or blocked)`, error);
      }
    }
  };
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    for (const name of [...waiting.keys()]) write(name);
  };
  const schedule = () => {
    if (timer !== undefined || !waiting.size) return;
    const due = Math.min(
      ...[...waiting.keys()].map(
        (name) => (lastWrite.get(name) ?? -Infinity) + gapMs,
      ),
    );
    timer = setTimeout(
      () => {
        timer = undefined;
        for (const name of [...waiting.keys()])
          if (now() - (lastWrite.get(name) ?? -Infinity) >= gapMs) write(name);
        schedule();
      },
      Math.max(0, due - now()),
    );
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    // A read sees what is waiting, not the older value on disk.
    getItem: (name) => waiting.get(name) ?? backing.getItem(name),
    setItem: (name, value) => {
      waiting.set(name, value);
      if (now() - (lastWrite.get(name) ?? -Infinity) >= gapMs) write(name);
      else schedule();
    },
    removeItem: (name) => {
      waiting.delete(name);
      backing.removeItem(name);
    },
    flush,
  };
}
