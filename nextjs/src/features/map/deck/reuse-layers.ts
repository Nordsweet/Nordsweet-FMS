import { type Layer } from "@deck.gl/core";

type Props = Record<string, unknown>;
/** Data this big is never compared: if its reference changed, so did its content. */
const MAX_COMPARED = 400;

const same = (a: unknown, b: unknown, key: string) => {
  if (a === b) return true;
  // Accessors are written inline at each call site, so a rebuilt one does the same as the last.
  if (typeof a === "function" && typeof b === "function") return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (key === "data" && (!Array.isArray(a) || a.length > MAX_COMPARED))
    return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/** Would `next` draw exactly what the layer `old` already draws? */
function sameLayer(old: Layer, next: Layer) {
  if (old.constructor !== next.constructor) return false;
  const a = old.props as unknown as Props,
    b = next.props as unknown as Props;
  return [...new Set([...Object.keys(a), ...Object.keys(b), "data"])].every(
    (key) => same(a[key], b[key], key),
  );
}

/**
 * The layer stack is rebuilt on every change, but most layers (the basemap, airspace, points, the
 * route) did not change: hand deck.gl the instance it already has, which it skips without diffing
 * props. Only the layers whose data or settings moved (traffic, ownship) are new objects.
 */
export function reuseLayers(previous: Map<string, Layer>, next: Layer[]) {
  const layers = next.map((layer) => {
    const old = previous.get(layer.id);
    return old && sameLayer(old, layer) ? old : layer;
  });
  previous.clear();
  for (const layer of layers) previous.set(layer.id, layer);
  return layers;
}
