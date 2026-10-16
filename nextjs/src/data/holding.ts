import { z } from "zod";

export const holdingSchema = z.object({
  fix: z.object({
    ident: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  levelFt: z.number().min(0).max(60000),
  inboundTrueDeg: z.number().min(0).max(360),
  direction: z.enum(["right", "left"]),
  legSeconds: z.number().min(15).max(600),
  tasKt: z.number().min(30).max(600),
  approachTrueDeg: z.number().min(0).max(360),
});
export type Holding = z.infer<typeof holdingSchema>;

export const holdingRuntimeSchema = z.object({
  config: holdingSchema,
  entry: z.enum(["direct", "parallel", "teardrop"]),
  phase: z.enum(["armed", "turn", "outbound", "return"]),
  timerStartedAt: z.number().nonnegative().nullable(),
  previous: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      time: z.iso.datetime(),
      trackDeg: z.number().nullable(),
      groundSpeedKt: z.number().nullable(),
    })
    .nullable(),
  departedFix: z.boolean(),
  circuits: z.number().int().nonnegative(),
});
