import {
  type DistanceAxis,
  type DistanceConfiguration,
  type DistanceGrid,
  type DistanceLeaf,
} from "~/data/aircraft";

export type RunwaySurface = "paved" | "grass" | "unknown";

export type DistanceInput = {
  weightKg: number;
  pressureAltitudeFt: number;
  temperatureC: number;
  /** Runway headwind component; negative = tailwind. */
  headwindKt: number;
  surface: RunwaySurface;
  /** Positive = uphill in the direction of the run. */
  slopePct: number;
};

export type PerformanceWarning =
  | { code: "above-table"; axis: DistanceAxis; value: number; max: number }
  | { code: "not-tabulated"; axis: "pressureAltitudeFt" | "temperatureC" }
  | { code: "tailwind-not-corrected" }
  | { code: "tailwind-above-limit"; limitKt: number }
  | { code: "grass-not-corrected" }
  | { code: "slope-not-corrected" }
  | { code: "surface-unknown" }
  | { code: "draft-data" };

export type DistanceResult = DistanceLeaf & {
  /** Linear interpolation between table points, before corrections. */
  interpolated: DistanceLeaf;
  /** Next more conservative table entry on every axis, before corrections. */
  tableRead: DistanceLeaf;
  speeds: {
    liftoffKias: number | null;
    obstacle50ftKias: number | null;
    approachKias: number | null;
  };
  warnings: PerformanceWarning[];
};

const isLeaf = (node: DistanceGrid | DistanceLeaf): node is DistanceLeaf =>
  "groundRollM" in node;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function axisValue(input: DistanceInput, axis: DistanceAxis) {
  return axis === "headwindKt" ? Math.max(0, input.headwindKt) : input[axis];
}

function interpolate(
  node: DistanceGrid | DistanceLeaf,
  input: DistanceInput,
): DistanceLeaf {
  if (isLeaf(node)) return node;
  const v = axisValue(input, node.axis);
  const pts = node.points;
  const upper = pts.findIndex((p) => p.at >= v);
  if (upper <= 0)
    return interpolate(pts[upper === 0 ? 0 : pts.length - 1]!.next, input); // clamped
  const lo = pts[upper - 1]!;
  const hi = pts[upper]!;
  const t = (v - lo.at) / (hi.at - lo.at);
  const a = interpolate(lo.next, input);
  const b = interpolate(hi.next, input);
  return {
    groundRollM: lerp(a.groundRollM, b.groundRollM, t),
    obstacle50ftM: lerp(a.obstacle50ftM, b.obstacle50ftM, t),
  };
}

/** Next table entry in the direction that lengthens the run (a lower headwind, a higher anything else). */
function tableRead(
  node: DistanceGrid | DistanceLeaf,
  input: DistanceInput,
): DistanceLeaf {
  if (isLeaf(node)) return node;
  const v = axisValue(input, node.axis);
  const pts = node.points;
  const pick =
    node.axis === "headwindKt"
      ? ([...pts].reverse().find((p) => p.at <= v) ?? pts[0]!)
      : (pts.find((p) => p.at >= v) ?? pts[pts.length - 1]!);
  return tableRead(pick.next, input);
}

/** Highest tabulated value per axis present in the grid. */
function axisMaxima(grid: DistanceGrid) {
  const max = new Map<DistanceAxis, number>();
  const walk = (node: DistanceGrid | DistanceLeaf) => {
    if (isLeaf(node)) return;
    max.set(
      node.axis,
      Math.max(max.get(node.axis) ?? -Infinity, node.points.at(-1)!.at),
    );
    node.points.forEach((p) => walk(p.next));
  };
  walk(grid);
  return max;
}

/** Axes where the input exceeds what the table covers (distances would be underestimated). */
function rangeWarnings(
  max: Map<DistanceAxis, number>,
  input: DistanceInput,
): PerformanceWarning[] {
  const warnings: PerformanceWarning[] = [];
  for (const axis of [
    "weightKg",
    "pressureAltitudeFt",
    "temperatureC",
  ] as const) {
    const top = max.get(axis);
    if (top === undefined) {
      if (axis !== "weightKg") warnings.push({ code: "not-tabulated", axis });
    } else if (input[axis] > top + 1e-9) {
      warnings.push({
        code: "above-table",
        axis,
        value: input[axis],
        max: top,
      });
    }
  }
  return warnings;
}

function interpolateSpeed(
  rows: DistanceConfiguration["speeds"],
  key: "liftoffKias" | "obstacle50ftKias" | "approachKias",
  weightKg: number,
) {
  const pts = rows
    .filter((r) => r[key] !== null)
    .sort((a, b) => a.weightKg - b.weightKg);
  if (!pts.length) return null;
  const upper = pts.findIndex((r) => r.weightKg >= weightKg);
  if (upper === 0) return pts[0]![key];
  if (upper === -1) return pts.at(-1)![key];
  const lo = pts[upper - 1]!;
  const hi = pts[upper]!;
  return lerp(
    lo[key]!,
    hi[key]!,
    (weightKg - lo.weightKg) / (hi.weightKg - lo.weightKg),
  );
}

/**
 * Take-off or landing distance from POH tables. The base value is the larger of the interpolated
 * value and the next conservative table entry; POH corrections are then applied in the order the
 * POH lists them (wind, surface, slope). Anything the data cannot account for becomes a warning.
 */
export function computeDistance(
  config: DistanceConfiguration,
  input: DistanceInput,
): DistanceResult {
  const warnings: PerformanceWarning[] = [];
  if (config.draft) warnings.push({ code: "draft-data" });

  // Unknown surface: assume grass, the longer case.
  const surface = input.surface === "unknown" ? "grass" : input.surface;
  if (input.surface === "unknown") warnings.push({ code: "surface-unknown" });
  const table =
    config.tables.find((t) => t.surface === surface) ??
    config.tables.find((t) => t.surface === "any") ??
    config.tables[0]!;
  const maxima = axisMaxima(table.grid);
  warnings.push(...rangeWarnings(maxima, input));

  const interpolated = interpolate(table.grid, input);
  const read = tableRead(table.grid, input);
  const base = {
    groundRollM: Math.max(interpolated.groundRollM, read.groundRollM),
    obstacle50ftM: Math.max(interpolated.obstacle50ftM, read.obstacle50ftM),
  };
  let { groundRollM, obstacle50ftM } = base;
  const c = config.corrections;

  const headwind = Math.max(0, input.headwindKt);
  const tailwind = Math.max(0, -input.headwindKt);
  if (headwind > 0 && c.headwind && !maxima.has("headwindKt")) {
    if ("percentPerKt" in c.headwind) {
      const factor = Math.max(
        0,
        1 - (c.headwind.percentPerKt * headwind) / 100,
      );
      groundRollM *= factor;
      obstacle50ftM *= factor;
    } else {
      groundRollM -= c.headwind.metersPerKt * headwind;
      obstacle50ftM -= c.headwind.metersPerKt * headwind;
    }
  }
  if (tailwind > 0) {
    if (!c.tailwind) {
      warnings.push({ code: "tailwind-not-corrected" });
    } else {
      // The full tailwind is applied even beyond the POH limit (the legacy planner capped it).
      if (c.tailwind.maxKt !== null && tailwind > c.tailwind.maxKt) {
        warnings.push({
          code: "tailwind-above-limit",
          limitKt: c.tailwind.maxKt,
        });
      }
      if ("percentPerKt" in c.tailwind) {
        const factor = 1 + (c.tailwind.percentPerKt * tailwind) / 100;
        groundRollM *= factor;
        obstacle50ftM *= factor;
      } else {
        groundRollM += c.tailwind.metersPerKt * tailwind;
        obstacle50ftM += c.tailwind.metersPerKt * tailwind;
      }
    }
  }

  if (surface === "grass" && table.surface === "paved") {
    if (c.grass) {
      const add =
        (base[
          c.grass.percentOf === "groundRoll" ? "groundRollM" : "obstacle50ftM"
        ] *
          c.grass.percent) /
        100;
      groundRollM += add;
      obstacle50ftM += add;
    } else {
      warnings.push({ code: "grass-not-corrected" });
    }
  }
  if (
    surface === "paved" &&
    table.surface === "grass" &&
    c.pavedGroundRollFactor !== null
  ) {
    groundRollM *= c.pavedGroundRollFactor;
  }

  if (input.slopePct !== 0) {
    const slope = c.slopeGroundRollPercentPerPercent;
    if (slope) {
      const pct =
        input.slopePct > 0
          ? slope.uphill * input.slopePct
          : slope.downhill * -input.slopePct;
      groundRollM *= Math.max(0, 1 + pct / 100);
    } else {
      warnings.push({ code: "slope-not-corrected" });
    }
  }

  return {
    groundRollM: Math.max(0, groundRollM),
    obstacle50ftM: Math.max(0, obstacle50ftM),
    interpolated,
    tableRead: read,
    speeds: {
      liftoffKias: interpolateSpeed(
        config.speeds,
        "liftoffKias",
        input.weightKg,
      ),
      obstacle50ftKias: interpolateSpeed(
        config.speeds,
        "obstacle50ftKias",
        input.weightKg,
      ),
      approachKias: interpolateSpeed(
        config.speeds,
        "approachKias",
        input.weightKg,
      ),
    },
    warnings,
  };
}
