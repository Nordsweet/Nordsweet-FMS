import { z } from "zod";

export const emergencyPhaseSchema = z.enum([
  "runway",
  "after-takeoff",
  "flight",
]);
export type EmergencyPhase = z.infer<typeof emergencyPhaseSchema>;
export const emergencyProcedureSchema = z.object({
  key: z.string(),
  revision: z.string(),
  title: z.string(),
  family: z.enum([
    "failure",
    "fire",
    "electric",
    "hydraulic",
    "pax",
    "fuel",
    "pneumatic",
  ]),
  phase: emergencyPhaseSchema.nullable(),
  status: z.enum(["reference", "pending-review", "verified", "superseded"]),
  aircraftType: z.string(),
  registration: z.string().nullable(),
  source: z.string(),
  pages: z.string(),
  edition: z.string().nullable(),
  serialRange: z.string().nullable(),
  equipment: z.string().nullable(),
  reviewer: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  items: z.array(z.object({ id: z.string(), text: z.string() })),
  warnings: z.array(z.string()),
  notes: z.array(z.string()),
  branchKey: z.string().nullable(),
  speed: z
    .object({
      kt: z.number().positive(),
      basis: z.enum(["KIAS", "KCAS"]),
      conditions: z.string(),
    })
    .nullable(),
});
export type EmergencyProcedure = z.infer<typeof emergencyProcedureSchema>;

const reference = {
  revision: "reference-2026-10-18",
  family: "failure" as const,
  status: "reference" as const,
  aircraftType: "FR172H",
  registration: null,
  source:
    "Owner-supplied Reims Rocket Flight Manual screenshots; model assignment confirmed by owner 2026-10-18",
  pages: "First page unidentified; continuation page 3-2",
  edition: "2 (continuation page only)",
  serialRange: null,
  equipment: null,
  reviewer: null,
  reviewedAt: null,
  speed: null,
};
const items = (prefix: string, rows: [string, string][]) =>
  rows.map(([id, text]) => ({ id: `${prefix}.${id}`, text }));

/** Owner assigned to FR172H; manual applicability and airspeed basis remain unverified. */
export const fr172hEmergencyReference: EmergencyProcedure[] = [
  {
    ...reference,
    key: "engine-failure-takeoff-runway-ahead",
    title: "Engine Failure — During Take-Off (Sufficient Runway Ahead)",
    phase: "runway",
    warnings: [],
    notes: [],
    branchKey: null,
    items: items("runway", [
      ["throttle", "Throttle — Idle."],
      ["brakes", "Apply brakes."],
      [
        "flaps",
        "Flaps — Retract (if extended) during ground roll to provide more effective braking.",
      ],
      ["mixture", "Mixture — Idle cut-off."],
      ["switches", "Ignition and Master Switch — OFF."],
    ]),
  },
  {
    ...reference,
    key: "engine-failure-after-takeoff",
    title: "Engine Failure — After Take-Off",
    phase: "after-takeoff",
    branchKey: null,
    notes: [],
    warnings: [
      "IMPORTANT: Perform the landing straight ahead, making only small changes in heading to avoid obstructions. Never attempt to turn back to the landing strip because your altitude after take-off is not usually sufficient to safely turn back to the airport.",
    ],
    items: items("after-takeoff", [
      ["speed", "Glide Speed — 129 km/h - 70 kts - 80 MPH."],
      ["mixture", "Mixture — Idle cut-off."],
      ["fuel", "Fuel Shutoff Valve Knob — Pulled full out."],
      ["ignition", "Ignition Switch — OFF."],
      [
        "master",
        "Master Switch is to be left ON so that flaps may be extended.",
      ],
    ]),
  },
  {
    ...reference,
    key: "engine-failure-in-flight",
    title: "Engine Failure — During Flight",
    phase: "flight",
    warnings: [],
    branchKey: "engine-failure-in-flight-secure",
    notes: [
      "If the propeller is allowed to stop windmilling, the engine will have to be turned with the starter. If the engine will not start, select an unobstructed area to land in and secure the engine as follows:",
    ],
    items: items("flight", [
      [
        "speed",
        "Glide Speed — 137 km/h - 74 kts - 85 MPH (optimum glide angle with propeller windmilling).",
      ],
      ["shutoff", "Fuel Shutoff Valve Knob — Pushed full in."],
      ["selector", "Fuel Selector Valve Handle — BOTH."],
      ["mixture", "Mixture — Rich."],
      [
        "pump",
        "Auxiliary Fuel Pump Switch — On HIGH for 3-5 seconds with throttle 1/2 open, then switch to OFF position.",
      ],
      ["throttle", "Throttle — Opened one inch (2.5 cm)."],
      ["ignition", "Ignition Switch — BOTH."],
    ]),
  },
  {
    ...reference,
    key: "engine-failure-in-flight-secure",
    title: "Engine Failure — Unsuccessful Restart / Secure Engine",
    phase: "flight",
    warnings: [],
    branchKey: null,
    notes: [
      "NOTE: Full flaps are recommended for emergency landings on unpaved surfaces.",
    ],
    items: items("secure", [
      ["throttle", "Throttle — Closed."],
      ["mixture", "Mixture — Idle cut-off (pulled full-out)."],
      ["fuel", "Fuel Shutoff Knob — Pulled full out."],
      ["ignition", "Ignition Switch — OFF."],
      ["master", "Leave master switch ON so that flaps can be extended."],
    ]),
  },
].map((p) => emergencyProcedureSchema.parse(p));

export function emergencyReferences(type: string | undefined) {
  return type?.toUpperCase() === "FR172H" ? fr172hEmergencyReference : [];
}

/** Verification metadata is mandatory; a status flag alone cannot publish a procedure. */
export function operationalProcedure(p: EmergencyProcedure) {
  return (
    p.status === "verified" &&
    !!p.reviewer &&
    !!p.reviewedAt &&
    !!p.edition &&
    !!p.serialRange &&
    !!p.equipment
  );
}
