import { z } from "zod";
import { flightSchema } from "./flight";
import { debriefSchema } from "./debrief";
import { holdingRuntimeSchema } from "./holding";
import { trafficPatternSchema } from "./traffic-pattern";
import { FLIGHT_PHASES } from "~/domain/flight-phase";

const number = z.number();
const nullable = number.nullable();
const position = z.object({
  lat: number.min(-90).max(90),
  lon: number.min(-180).max(180),
});
const performance = z.object({
  tasKt: number.positive(),
  windDirectionDeg: number.optional(),
  windSpeedKt: number.nonnegative().optional(),
});
const navpoint = position.extend({
  ident: z.string(),
  altitudeFt: number.optional(),
  patternId: z.string().optional(),
  patternOperation: z.enum(["join", "leave"]).optional(),
  flyOver: z.boolean().optional(),
  turnPerformance: performance.optional(),
  initialCourseDeg: number.optional(),
  initialTurnDirection: z.enum(["left", "right"]).optional(),
});
export const trackPointSchema = position.extend({
  altitudeFt: nullable,
  time: z.iso.datetime(),
});
const timer = z.object({
  startedAt: nullable,
  stoppedAt: nullable,
  source: z.enum(["auto", "manual"]).nullable(),
  autoArmed: z.boolean(),
  candidateAt: nullable,
});
const sample = position.extend({
  at: number,
  altitudeFt: nullable,
  speedKt: nullable,
  headingDeg: nullable,
  onGround: z.boolean().optional(),
});
const utility = z.object({
  mode: z.enum(["idle", "stopwatch", "countdown", "stopped", "complete"]),
  startedAt: nullable,
  stoppedAt: nullable,
  durationMs: number,
});
const timers = z.object({
  offBlock: timer,
  airTime: timer,
  last: sample.nullable(),
  groundSamples: z.array(number),
  groundReferenceFt: nullable,
  rollHeadingDeg: nullable,
  rollStartedAt: nullable,
  landingCandidateAt: nullable,
  onBlockCandidateAt: nullable,
  todCandidateAt: nullable,
  events: z.array(
    z.object({
      name: z.string(),
      at: number,
      notedAt: number.optional(),
      source: z.enum(["auto", "manual"]),
      lat: nullable,
      lon: nullable,
      altitudeFt: nullable,
    }),
  ),
  pendingPhase: z
    .object({ phase: z.enum(["climb", "taxiin"]), dueAt: number })
    .nullable(),
  utility: z.tuple([utility, utility]),
});
/** Only durable flight state crosses the server boundary; no functions, GPS credentials or device settings. */
export const inFlightSnapshotSchema = z.object({
  debrief: debriefSchema.nullable(),
  holding: holdingRuntimeSchema.nullable(),
  startedAt: z.iso.datetime().nullable(),
  trafficPattern: trafficPatternSchema.nullable(),
  departurePattern: trafficPatternSchema.nullable(),
  patternReports: z.array(
    z.enum(["downwind", "base", "longFinal", "final", "shortFinal"]),
  ),
  patternNotice: z
    .object({
      report: z.enum(["downwind", "base", "longFinal", "final", "shortFinal"]),
      expiresAt: number,
    })
    .nullable()
    .default(null),
  divertAirport: z.string().nullable(),
  route: z.array(navpoint),
  routeHistory: z
    .object({
      paths: z.array(z.array(navpoint.partial({ ident: true }))),
      lastPassed: navpoint,
    })
    .nullable(),
  activeLeg: number.int().nonnegative(),
  fredaDueAt: nullable,
  fredaOpen: z.boolean(),
  fredaFuel: z
    .object({ fuelL: number.nonnegative(), airElapsedMs: number.nonnegative() })
    .nullable()
    .default(null),
  replayEnabled: z.boolean(),
  phase: z.enum(FLIGHT_PHASES),
  config: z.object({
    climb: z.object({
      flaps: z.enum(["takeoff", "up"]),
      profile: z.enum(["vy", "vx"]),
      engines: z.enum(["both", "one-inop"]),
    }),
    takeoffFlaps: z.enum(["takeoff", "up"]),
    landingFlaps: z.enum(["UP", "APP", "LDG"]),
    cruiseMode: z.enum(["eco-time", "eco-distance", "manual"]),
    manual: z.object({ rpm: number, mapInHg: number }),
  }),
  timers,
});
export const flightSnapshotSchema = z.object({
  flight: flightSchema,
  inflight: inFlightSnapshotSchema,
});
export const serverFlightSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  startedAt: z.iso.datetime(),
  registration: z.string(),
  revision: number.int().nonnegative(),
  ended: z.boolean(),
  updatedAt: z.string(),
  snapshot: flightSnapshotSchema,
  track: z.array(trackPointSchema),
});
export type ServerFlight = z.infer<typeof serverFlightSchema>;
export type FlightSnapshot = z.infer<typeof flightSnapshotSchema>;
export type PendingFlight = {
  id: string;
  name: string;
  startedAt: string;
  registration: string;
  revision: number;
  trackCount: number;
  snapshot: FlightSnapshot;
  track: z.infer<typeof trackPointSchema>[];
};
