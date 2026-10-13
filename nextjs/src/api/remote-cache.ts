import { get, set } from "idb-keyval";

type Entry<T> = { savedAt: number; data: T };

const pending = new Map<string, Promise<unknown>>();

/** Explicit source refresh replaces both the in-session and offline reference snapshot. */
export async function replaceCachedRemote<T>(key: string, data: T) {
  await set(key, { savedAt: Date.now(), data });
  pending.set(key, Promise.resolve(data));
  return data;
}

/**
 * Remote data that must survive offline: served from IndexedDB while younger than `maxAgeMs`,
 * refreshed otherwise, and served at any age when the refresh fails (no network).
 */
export function cachedRemote<T>(
  key: string,
  maxAgeMs: number,
  fetcher: () => Promise<T>,
) {
  let request = pending.get(key) as Promise<T> | undefined;
  if (!request) {
    request = (async () => {
      const stored = await get<Entry<T>>(key);
      if (stored && Date.now() - stored.savedAt < maxAgeMs) return stored.data;
      try {
        const data = await fetcher();
        await set(key, { savedAt: Date.now(), data } satisfies Entry<T>);
        return data;
      } catch (error) {
        if (stored) return stored.data;
        throw error;
      }
    })();
    request.catch(() => pending.delete(key));
    pending.set(key, request);
  }
  return request;
}
