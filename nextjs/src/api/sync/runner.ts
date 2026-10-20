import { type Collection, type SyncApi, SyncError } from "./contract";
import { type Engine } from "./engine";

const BACKOFF_MS = [1000, 2000, 5000, 15_000, 30_000];
/** A stream that stayed up this long counts as healthy: the next reconnect starts at the shortest wait. */
const HEALTHY_MS = 30_000;
const LOCAL_CHANGE_MS = 1500;

export type Wake = (onWake: () => void) => () => void;

/** Browser events that mean "the connection may be back". */
export const browserWake: Wake = (onWake) => {
  const visible = () => {
    if (document.visibilityState === "visible") onWake();
  };
  window.addEventListener("online", onWake);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.removeEventListener("online", onWake);
    document.removeEventListener("visibilitychange", visible);
  };
};

const fatal = (error: unknown) =>
  error instanceof SyncError && (error.status === 401 || error.status === 403);

/**
 * Keeps an engine running: a pull on every (re)connect, a pull on every stream hint, a push soon
 * after a local change, backoff after failures. Returns the function that stops it all.
 */
export function startRunner({
  engine,
  api,
  subscribe,
  wake = browserWake,
}: {
  engine: Engine;
  api: SyncApi;
  /** Calls back with the collection whose local copy changed; returns the unsubscribe. */
  subscribe: (onChange: (collection: Collection) => void) => () => void;
  wake?: Wake;
}) {
  const stop = new AbortController();
  let connection = new AbortController();
  let woke = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let due = Infinity;

  const later = (ms: number, pull: boolean) => {
    if (stop.signal.aborted || Date.now() + ms >= due) return;
    clearTimeout(timer);
    due = Date.now() + ms;
    timer = setTimeout(() => {
      due = Infinity;
      void run(pull);
    }, ms);
  };
  async function run(pull: boolean) {
    if (stop.signal.aborted) return;
    try {
      const { retryInMs } = await engine.sync({ pull });
      failures = 0;
      if (retryInMs !== null) later(retryInMs, false);
    } catch (error) {
      if (fatal(error)) return stop.abort();
      later(BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)]!, true);
    }
  }

  const unsubscribe = subscribe((collection) => {
    engine.markDirty(collection);
    later(LOCAL_CHANGE_MS, false);
  });
  const unwake = wake(() => {
    woke = true;
    connection.abort();
    void run(true);
  });
  stop.signal.addEventListener("abort", () => {
    clearTimeout(timer);
    connection.abort();
    unsubscribe();
    unwake();
  });

  void (async () => {
    let attempt = 0;
    while (!stop.signal.aborted) {
      await run(true); // events during a gap are lost, so every connection starts with a pull
      if (stop.signal.aborted) return;
      connection = new AbortController();
      const opened = Date.now();
      const closed = () => connection.abort();
      stop.signal.addEventListener("abort", closed, { once: true });
      try {
        await api.stream(connection.signal, () => void run(true));
      } catch (error) {
        if (fatal(error)) return stop.abort();
      } finally {
        stop.signal.removeEventListener("abort", closed);
      }
      if (stop.signal.aborted) return;
      if (Date.now() - opened >= HEALTHY_MS) attempt = 0;
      if (woke) woke = false;
      else
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)],
          ),
        );
    }
  })();

  return () => stop.abort();
}
