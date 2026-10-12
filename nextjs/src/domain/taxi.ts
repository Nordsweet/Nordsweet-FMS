import { type Ground } from "~/data/schemas";

/**
 * Taxi route with the fewest elements from a stand (or any element) to a holding point or runway.
 * Connections are treated as two-way; stands leave by their published exits.
 * Returns element ids from start to target, or null when the graph does not connect them.
 */
export function taxiRoute(
  ground: Ground,
  from: string,
  to: string,
): string[] | null {
  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };
  for (const [a, list] of Object.entries(ground.connections)) {
    for (const b of list) {
      link(a, b);
      link(b, a);
    }
  }
  for (const [stand, exits] of Object.entries(ground.standExits)) {
    for (const exit of exits) {
      link(stand, exit);
      link(exit, stand);
    }
  }
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const node = queue.shift()!;
    if (node === to) {
      const path: string[] = [];
      for (let n: string | null = to; n !== null; n = previous.get(n) ?? null)
        path.unshift(n);
      return path;
    }
    for (const next of neighbours.get(node) ?? []) {
      if (!previous.has(next)) {
        previous.set(next, node);
        queue.push(next);
      }
    }
  }
  return null;
}
