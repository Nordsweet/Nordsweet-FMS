import { z } from "zod";

export const emergencyPhaseSchema = z.enum([
  "ground",
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
  introduction: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      notes: z.array(z.string()).optional(),
    }),
  ),
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

/** Owner-supplied fire excerpts; no page, edition or airspeed basis is visible. */
export const fr172hEngineFireReference: EmergencyProcedure[] = [
  {
    ...reference,
    family: "fire",
    key: "engine-fire-start-ground",
    title: "Engine Fire During Start on Ground",
    phase: "ground",
    source:
      "Owner-supplied Engine Fire screenshot; FR172H owner-assigned reference collection",
    pages: "Unidentified ground-fire excerpt",
    edition: null,
    introduction:
      "Improper starting procedures involving the excessive use of auxiliary fuel pump operation can cause engine flooding and subsequent collection of fuel on the parking ramp. This is sometimes experienced in difficult starts in cold weather when engine preheat service is not available. If this occurs, the airplane should be pushed away from the fuel puddle before another engine start is attempted. In the rare event that the fuel puddle is ignited by exhaust from the tailpipe, proceed as follows:",
    warnings: [],
    notes: [],
    branchKey: null,
    items: [
      ...items("fire-ground", [
        ["pump", "Turn auxiliary fuel pump “OFF.”"],
        ["mixture", "Move mixture control to idle cut-off."],
        ["brakes", "Release parking brake."],
        ["extinguisher", "Obtain fire extinguisher."],
      ]),
      {
        id: "fire-ground.extinguish",
        text: "Extinguish fire with fire extinguisher.",
        notes: [
          "NOTE: If fire extinguisher is not available, move aircraft away from the fire by pushing rearward on the leading edge of the horizontal tail.",
        ],
      },
      ...items("fire-ground", [
        [
          "inspection",
          "Make a thorough inspection of fire damage, and repair or replace damaged components before conducting another flight.",
        ],
      ]),
    ],
  },
  {
    ...reference,
    family: "fire",
    key: "engine-fire-in-flight",
    title: "Engine Fire in Flight",
    phase: "flight",
    source:
      "Owner-supplied Engine Fire screenshot; FR172H owner-assigned reference collection",
    pages: "Unidentified in-flight fire excerpt",
    edition: null,
    introduction:
      "Although engine fires are extremely rare in flight, the following steps should be taken if one is encountered:",
    warnings: [],
    notes: [],
    branchKey: null,
    items: items("fire-flight", [
      ["mixture", "Pull mixture control to idle cut-off."],
      ["fuel", "Pull fuel shutoff valve knob full out."],
      ["master", "Turn master switch “OFF.”"],
      ["speed", "Establish a 193 km/h - 104 kts - 120 MPH glide."],
      ["cabin", "Close cabin heat control and cabin air control."],
      ["field", "Select a field suitable for a forced landing."],
      [
        "extinguish",
        "If fire is not extinguished, increase glide speed in an attempt to find an airspeed that will provide an incombustible mixture.",
      ],
      [
        "landing",
        "Execute a forced landing as described in paragraph Emergency Landing Without Engine Power. Do not attempt to restart the engine.",
      ],
    ]),
  },
].map((p) => emergencyProcedureSchema.parse(p));

export function emergencyReferences(type: string | undefined) {
  return type?.toUpperCase() === "FR172H"
    ? [...fr172hEmergencyReference, ...fr172hEngineFireReference]
    : [];
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
