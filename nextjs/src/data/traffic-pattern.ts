import { z } from "zod";
const position = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export const trafficPatternSchema = z.object({
  id: z.string().min(1),
  operation: z.enum(["join", "leave"]).optional(),
  runwayAutomatic: z.boolean().optional(),
  airport: position.extend({ ident: z.string(), elevationFt: z.number() }),
  runway: z.object({
    designator: z.string(),
    trueHeadingDeg: z.number(),
    threshold: position.extend({ elevationFt: z.number() }),
    departureEnd: position,
  }),
  direction: z.enum(["left", "right"]),
  join: z.enum(["overhead", "crosswind", "downwind", "base", "final"]),
  altitudeAalFt: z.number().positive().max(10000),
  finalDistanceNm: z.number().positive().max(100),
  speedKias: z.number().positive().max(600).optional(),
  turnPerformance: z
    .object({
      tasKt: z.number().positive(),
      windDirectionDeg: z.number().optional(),
      windSpeedKt: z.number().nonnegative().optional(),
    })
    .optional(),
});
export type TrafficPattern = z.infer<typeof trafficPatternSchema>;
