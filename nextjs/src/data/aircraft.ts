import { z } from "zod";

/**
 * POH table as a nested grid. Axes are optional and may hold a single point (a value the POH did
 * not vary). Points along each axis are sorted ascending. Leaves hold the tabulated values.
 */
export const gridAxes = [
  "weightKg",
  "headwindKt",
  "pressureAltitudeFt",
  "temperatureC",
  "densityAltitudeFt",
] as const;
export type GridAxis = (typeof gridAxes)[number];
export type Grid<L> = {
  axis: GridAxis;
  points: { at: number; next: Grid<L> | L }[];
};

function gridSchema<L>(leaf: z.ZodType<L>): z.ZodType<Grid<L>> {
  const grid: z.ZodType<Grid<L>> = z.lazy(() =>
    z.object({
      axis: z.enum(gridAxes),
      points: z
        .array(z.object({ at: z.number(), next: z.union([grid, leaf]) }))
        .min(1)
        .refine(
          (pts) => pts.every((p, i) => i === 0 || p.at > pts[i - 1]!.at),
          "points must ascend",
        ),
    }),
  );
  return grid;
}

export type DistanceAxis = GridAxis;
export type DistanceLeaf = { groundRollM: number; obstacle50ftM: number };
export type DistanceGrid = Grid<DistanceLeaf>;
export const distanceGridSchema = gridSchema<DistanceLeaf>(
  z.object({
    groundRollM: z.number().nonnegative(),
    obstacle50ftM: z.number().nonnegative(),
  }),
);

export type ClimbLeaf = { rateFpm: number; iasKt: number };
export const climbSchema = z.object({
  label: z.string(),
  grid: gridSchema<ClimbLeaf>(
    z.object({ rateFpm: z.number(), iasKt: z.number().positive() }),
  ),
  /** null: the POH data gives no climb fuel flow. */
  fuelFlowLph: z.number().positive().nullable(),
  draft: z.boolean(),
  source: z.string(),
});

/** POH corrections. Headwind/tailwind values are magnitudes: headwind shortens, tailwind lengthens. */
export const correctionsSchema = z.object({
  headwind: z
    .object({ percentPerKt: z.number() })
    .or(z.object({ metersPerKt: z.number() }))
    .nullable(),
  tailwind: z
    .object({ percentPerKt: z.number() })
    .or(z.object({ metersPerKt: z.number() }))
    .and(z.object({ maxKt: z.number().nullable() }))
    .nullable(),
  /** Added to both distances, as a percentage of the named distance. */
  grass: z
    .object({
      percentOf: z.enum(["groundRoll", "obstacle50ft"]),
      percent: z.number(),
    })
    .nullable(),
  /** Ground roll multiplier on hard surfaces when the table is for grass. */
  pavedGroundRollFactor: z.number().nullable(),
  /** Ground roll change in % per 1% slope (positive slope = uphill). */
  slopeGroundRollPercentPerPercent: z
    .object({ uphill: z.number(), downhill: z.number() })
    .nullable(),
});

export const distanceTableSchema = z.object({
  /** Surface the table is for; "any" = a single table used on every surface. */
  surface: z.enum(["paved", "grass", "any"]),
  grid: distanceGridSchema,
});

export const speedRowSchema = z.object({
  weightKg: z.number(),
  liftoffKias: z.number().nullable(),
  obstacle50ftKias: z.number().nullable(),
  approachKias: z.number().nullable(),
});

export const distanceConfigurationSchema = z.object({
  id: z.string(),
  label: z.string(),
  tables: z.array(distanceTableSchema).min(1),
  speeds: z.array(speedRowSchema),
  corrections: correctionsSchema,
  /** Values digitized from a chart and not yet verified. */
  draft: z.boolean(),
  notes: z.array(z.string()),
  source: z.string(),
});

export const distancePerformanceSchema = z.object({
  defaultConfiguration: z.string(),
  configurations: z.array(distanceConfigurationSchema).min(1),
});

export const weightBalanceSchema = z.object({
  mtowKg: z.number().positive(),
  emptyWeightKg: z.number().positive(),
  emptyArmM: z.number(),
  stations: z.array(
    z.object({
      id: z.enum([
        "pilot",
        "coPilot",
        "firstPassenger",
        "secondPassenger",
        "baggage",
      ]),
      armM: z.number(),
      defaultKg: z.number().nonnegative(),
    }),
  ),
  fuel: z.object({
    armM: z.number(),
    densityKgPerL: z.number().positive(),
    defaultL: z.number().nonnegative(),
  }),
  /** Polygon in (moment, weight) space. */
  envelope: z
    .array(z.object({ weightKg: z.number(), momentKgm: z.number() }))
    .min(3),
  source: z.string(),
});

export const checklistPhases = [
  "taxiout",
  "takeoff",
  "climb",
  "cruise",
  "descent",
  "landing",
  "taxiin",
] as const;

export const checklistSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: z.enum(checklistPhases),
  sections: z.array(
    z.object({
      title: z.string(),
      items: z.array(z.object({ action: z.string(), expected: z.string() })),
    }),
  ),
});

export const aircraftSchema = z.object({
  id: z.string(),
  type: z.string(),
  registration: z.string().nullable(),
  displayName: z.string(),
  icaoType: z.string(),
  usableFuelL: z.number().positive().nullable(),
  weightBalance: weightBalanceSchema.nullable(),
  takeoff: distancePerformanceSchema.nullable(),
  landing: distancePerformanceSchema.nullable(),
  climb: climbSchema.nullable(),
  checklists: z.array(checklistSchema),
  windLimits: z
    .object({
      maxCrosswindKt: z.number().nullable(),
      maxTailwindKt: z.number().nullable(),
    })
    .nullable(),
});

export type Aircraft = z.infer<typeof aircraftSchema>;
export type WeightBalance = z.infer<typeof weightBalanceSchema>;
export type DistancePerformance = z.infer<typeof distancePerformanceSchema>;
export type DistanceConfiguration = z.infer<typeof distanceConfigurationSchema>;
export type Climb = z.infer<typeof climbSchema>;
export type Checklist = z.infer<typeof checklistSchema>;
export type Corrections = z.infer<typeof correctionsSchema>;
