/** Switching back to a tab fires `focus` and `visibilitychange` together: one look at the server is enough. */
export const WAKE_GAP_MS = 5000;

/**
 * Browser events that mean "look at the server again": back online, tab visible, window focused.
 * A tab or window event within `WAKE_GAP_MS` of the previous one is ignored; coming back online
 * always counts, because the lost connection is exactly what the last attempt ran into.
 */
export function wakeOnReturn(onWake: () => void, now: () => number = Date.now) {
  let last = -Infinity;
  const wake = (always = false) => {
    const at = now();
    if (!always && at - last < WAKE_GAP_MS) return;
    last = at;
    onWake();
  };
  const visible = () => {
    if (document.visibilityState === "visible") wake();
  };
  const focus = () => wake();
  const online = () => wake(true);
  window.addEventListener("online", online);
  window.addEventListener("focus", focus);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("focus", focus);
    document.removeEventListener("visibilitychange", visible);
  };
}

const BACKOFF_MS = [2000, 5000, 15_000, 30_000];

/** Retries a failed sync after 2 s, then 5, 15 and every 30 s, until one succeeds or it is stopped. */
export function backoff(run: () => unknown) {
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    failed() {
      clearTimeout(timer);
      timer = setTimeout(
        () => void run(),
        BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)],
      );
    },
    ok() {
      failures = 0;
      clearTimeout(timer);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}
