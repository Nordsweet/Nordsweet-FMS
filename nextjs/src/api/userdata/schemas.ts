import { z } from "zod";

/**
 * Envelopes of the Aviation API user-data routes (docs/API.md, "User data"). The flight and aircraft
 * `document`s are opaque here: their schemas stay in src/data and src/domain.
 */

/** Postgres `numeric` may arrive as a string; the app works with numbers. */
const decimal = z
  .union([z.number(), z.string().transform(Number)])
  .pipe(z.number().finite())
  .nullable();
const time = z.string();

export const documentSchema = z.record(z.string(), z.unknown());
export const documentRowSchema = z.looseObject({
  id: z.string(),
  version: z.number().int(),
  schema_version: z.number().int(),
  updated_at: time,
  deleted_at: time.nullish(),
  document: documentSchema.nullable(),
});
export type DocumentRow = z.infer<typeof documentRowSchema>;

export const documentPageSchema = z.object({
  items: z.array(documentRowSchema),
  has_more: z.boolean(),
  /**
   * Opaque: kept and sent back exactly as received (it is a microsecond timestamp). `null` when
   * nothing has changed and no cursor was sent: a brand-new user's first pull.
   */
  cursor: z.string().nullable(),
});

export const conflictSchema = z.object({
  detail: z.object({
    message: z.string(),
    current: documentRowSchema.nullable(),
  }),
});

export const meSchema = z.looseObject({
  id: z.string(),
  username: z.string(),
  role: z.string(),
});

/** Body of `PUT /me/settings` (snake_case, `null` = none). */
export type SettingsBody = {
  language: "pl" | "en";
  home_airport_icao: string | null;
  pilot_weight_kg: number | null;
  atis_autoscroll: boolean;
  checklist_autoscroll: boolean;
  checklist_voice_gender: "female" | "male";
};
export const settingsSchema = z.looseObject({
  language: z.enum(["pl", "en"]),
  home_airport_icao: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  pilot_weight_kg: decimal.optional().transform((v) => v ?? null),
  atis_autoscroll: z.boolean(),
  checklist_autoscroll: z.boolean(),
  checklist_voice_gender: z.enum(["female", "male"]),
});

export const favoritesPageSchema = z.object({
  items: z.array(z.object({ item_id: z.string(), created_at: time })),
  has_more: z.boolean(),
});

export const fuelIndicationModeSchema = z.enum(["exact", "estimated"]);
export const airframeStateSchema = z.looseObject({
  reading_id: z.string(),
  recorded_at: time,
  mth: decimal,
  fuel_remaining_l: decimal,
  fuel_added_l: decimal,
  fuel_used_l: decimal,
});
export const airframeSchema = z.looseObject({
  id: z.string(),
  type: z.string(),
  registration: z.string(),
  fuel_indication_mode: fuelIndicationModeSchema.nullable(),
  state: airframeStateSchema.nullish().transform((v) => v ?? null),
});
export type Airframe = z.infer<typeof airframeSchema>;
export const airframePageSchema = z.object({
  items: z.array(airframeSchema),
  has_more: z.boolean(),
});

export const warningsSchema = z.array(
  z.looseObject({
    code: z.string(),
    previous_mth: decimal.optional(),
    previous_recorded_at: time.nullish(),
  }),
);
export type Warning = z.infer<typeof warningsSchema>[number];
export const readingResultSchema = z.object({
  reading: z.looseObject({ id: z.string() }),
  warnings: warningsSchema.default([]),
});

const nullableTime = time.nullish().transform((v) => v ?? null);
const nullableNumber = decimal.optional().transform((v) => v ?? null);
export const flightLogSummarySchema = z.looseObject({
  id: z.string(),
  flight_id: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  aircraft_type: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  registration: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  started_at: time,
  ended_at: time,
  off_block_at: nullableTime,
  takeoff_at: nullableTime,
  landing_at: nullableTime,
  on_block_at: nullableTime,
  mth_before: nullableNumber,
  mth_after: nullableNumber,
  fuel_before_l: nullableNumber,
  fuel_after_l: nullableNumber,
  track_points: z
    .number()
    .int()
    .nullish()
    .transform((v) => v ?? null),
});
export type FlightLogSummary = z.infer<typeof flightLogSummarySchema>;
export const flightLogSchema = flightLogSummarySchema.extend({
  debrief: z.unknown().optional(),
  pattern_reports: z.unknown().optional(),
  route: z.unknown().optional(),
  emergency_sessions: z.array(z.unknown()).optional(),
});
export type FlightLog = z.infer<typeof flightLogSchema>;
export const flightLogsPageSchema = z.object({
  items: z.array(flightLogSummarySchema),
  has_more: z.boolean(),
});
export const flightLogResultSchema = z.object({
  log: flightLogSummarySchema,
  created: z.boolean(),
  warnings: warningsSchema.default([]),
});
export const flightLogTrackSchema = z.object({
  log_id: z.string(),
  point_count: z.number().int(),
  // Read back through the server's own date handling: any spelling of the time is fine here.
  points: z.array(
    z.looseObject({
      lat: z.number(),
      lon: z.number(),
      altitudeFt: z.number().nullable(),
      time: z.string(),
    }),
  ),
});

const importPart = z.object({
  imported: z.number().int(),
  skipped: z.number().int(),
  rejected: z
    .array(
      z.looseObject({
        id: z.union([z.string(), z.number()]).nullish(),
        error: z.unknown(),
      }),
    )
    .default([]),
});
export type ImportPart = z.infer<typeof importPart>;
export const importResultSchema = z.object({
  flights: importPart.optional(),
  custom_aircraft: importPart.optional(),
  airframe_states: importPart.optional(),
  favorites: importPart.optional(),
  settings: z.union([z.string(), z.array(z.unknown())]).optional(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export const deletedSchema = z.object({
  deleted: z.record(z.string(), z.number()),
});
