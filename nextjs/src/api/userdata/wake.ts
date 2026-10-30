/** Browser events that mean "look at the server again": back online, tab visible, window focused. */
export function wakeOnReturn(onWake: () => void) {
  const visible = () => {
    if (document.visibilityState === "visible") onWake();
  };
  window.addEventListener("online", onWake);
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.removeEventListener("online", onWake);
    window.removeEventListener("focus", onWake);
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
