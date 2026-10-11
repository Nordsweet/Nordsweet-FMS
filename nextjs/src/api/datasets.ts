import { type z } from "zod";

import { type DatasetName, datasetSchemas } from "~/data/schemas";

type Dataset<N extends DatasetName> = z.infer<(typeof datasetSchemas)[N]>;

const cache = new Map<DatasetName, Promise<unknown>>();

/**
 * Reference data bundled with the app (precached by the service worker, so it works offline).
 * Validated once per session; a schema mismatch is a build bug, not a runtime condition.
 */
export function loadDataset<N extends DatasetName>(
  name: N,
): Promise<Dataset<N>> {
  let pending = cache.get(name);
  if (!pending) {
    pending = fetch(`/data/${name}.json`)
      .then((response) => {
        if (!response.ok)
          throw new Error(`Cannot load ${name} (${response.status})`);
        return response.json();
      })
      .then((json) => datasetSchemas[name].parse(json));
    pending.catch(() => cache.delete(name));
    cache.set(name, pending);
  }
  return pending as Promise<Dataset<N>>;
}
