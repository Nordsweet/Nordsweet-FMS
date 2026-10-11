import { type Grid, type GridAxis } from "~/data/aircraft";

type Leaf = Record<string, number>;
type Node<L> = Grid<L> | L;

const isGrid = <L>(node: Node<L>): node is Grid<L> =>
  typeof node === "object" && node !== null && "axis" in node;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Multilinear interpolation of every leaf field; inputs outside an axis clamp to its ends. */
export function interpolateGrid<L extends Leaf>(
  node: Node<L>,
  value: (axis: GridAxis) => number,
): L {
  if (!isGrid(node)) return node;
  const v = value(node.axis);
  const pts = node.points;
  const upper = pts.findIndex((p) => p.at >= v);
  if (upper <= 0)
    return interpolateGrid(pts[upper === 0 ? 0 : pts.length - 1]!.next, value);
  const lo = pts[upper - 1]!;
  const hi = pts[upper]!;
  const t = (v - lo.at) / (hi.at - lo.at);
  const a = interpolateGrid(lo.next, value);
  const b = interpolateGrid(hi.next, value);
  return Object.fromEntries(
    Object.keys(a).map((k) => [k, lerp(a[k]!, b[k]!, t)]),
  ) as L;
}

/**
 * The next table entry in the less favourable direction: the next lower headwind, the next higher
 * value on every other axis (more weight, altitude or temperature always means worse performance).
 */
export function conservativeRead<L>(
  node: Node<L>,
  value: (axis: GridAxis) => number,
): L {
  if (!isGrid(node)) return node;
  const v = value(node.axis);
  const pts = node.points;
  const pick =
    node.axis === "headwindKt"
      ? ([...pts].reverse().find((p) => p.at <= v) ?? pts[0]!)
      : (pts.find((p) => p.at >= v) ?? pts[pts.length - 1]!);
  return conservativeRead(pick.next, value);
}

/** Highest tabulated value per axis present in the grid. */
export function axisMaxima<L>(grid: Grid<L>) {
  const max = new Map<GridAxis, number>();
  const walk = (node: Node<L>) => {
    if (!isGrid(node)) return;
    max.set(
      node.axis,
      Math.max(max.get(node.axis) ?? -Infinity, node.points.at(-1)!.at),
    );
    node.points.forEach((p) => walk(p.next));
  };
  walk(grid);
  return max;
}
