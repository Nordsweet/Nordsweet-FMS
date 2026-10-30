import { createStore, del, get, keys, set } from "idb-keyval";

import { type Kv } from "./engine";

/** The engine's local state in one IndexedDB database. */
export function idbKv(dbName: string): Kv {
  const store = createStore(dbName, "sync");
  return {
    get: <T>(key: string) => get<T>(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
  };
}
