import {
  type Aircraft,
  type Grid,
  type GridAxis,
  aircraftSchema,
} from "~/data/aircraft";

import { normalizeRegistration } from "./aircraft";

/** Table rows as typed in the form: one string per cell. Blank cells = not entered. */
export type Row = string[];

export const stationIds = [
  "pilot",
  "coPilot",
  "firstPassenger",
  "secondPassenger",
  "baggage",
] as const;
export type StationId = (typeof stationIds)[number];

/** Sections of a built-in aircraft edited as JSON (the form cannot represent their full shape). */
export const rawSections = [
  "takeoff",
  "landing",
  "climb",
  "climbTables",
  "cruise",
  "checklists",
] as const;
export type RawSection = (typeof rawSections)[number];

export type DistanceDraft = {
  /** Take-off or landing; empty rows = no data for this aircraft. */
  surface: "paved" | "grass" | "any";
  /** Columns: pressure altitude ft, temperature °C, ground roll m, distance over 50 ft m. */
  rows: Row[];
  weightKg: string;
  liftoffKias: string;
  obstacle50ftKias: string;
  approachKias: string;
  headwindPercentPerKt: string;
  tailwindPercentPerKt: string;
  grassPercent: string;
};

export type AircraftDraft = {
  /** Id of the built-in aircraft this overrides; null for an aircraft of your own. */
  baseId: string | null;
  /** JSON text per section of a built-in; a section missing here is kept as bundled. */
  raw: Partial<Record<RawSection, string>>;
  type: string;
  displayName: string;
  icaoType: string;
  powerplant: Aircraft["powerplant"];
  engineCount: string;
  usableFuelL: string;
  fuelTankCapacityL: string;
  maxCrosswindKt: string;
  maxTailwindKt: string;
  patternSpeedKt: string;
  retractableGear: boolean;
  /** Columns: flap setting, then min and max IAS kt with gear down, then with gear up. */
  flapSpeeds: Row[];
  weightBalance: {
    mtowKg: string;
    emptyWeightKg: string;
    emptyArmM: string;
    stations: Record<StationId, { armM: string; defaultKg: string }>;
    fuel: { armM: string; densityKgPerL: string; defaultL: string };
    /** Columns: weight kg, moment kg·m. */
    envelope: Row[];
  };
  takeoff: DistanceDraft;
  landing: DistanceDraft;
  climb: {
    /** Columns: pressure altitude ft, temperature °C, rate of climb ft/min, IAS kt. */
    rows: Row[];
    fuelFlowLph: string;
  };
  cruise: {
    /** Columns: pressure altitude ft, ISA deviation °C, setting, KTAS, fuel flow L/h (all engines). */
    rows: Row[];
  };
};

const emptyDistance = (): DistanceDraft => ({
  surface: "paved",
  rows: [["", "", "", ""]],
  weightKg: "",
  liftoffKias: "",
  obstacle50ftKias: "",
  approachKias: "",
  headwindPercentPerKt: "",
  tailwindPercentPerKt: "",
  grassPercent: "",
});

export const emptyDraft = (): AircraftDraft => ({
  baseId: null,
  raw: {},
  type: "",
  displayName: "",
  icaoType: "",
  powerplant: "reciprocating",
  engineCount: "1",
  usableFuelL: "",
  fuelTankCapacityL: "",
  maxCrosswindKt: "",
  maxTailwindKt: "",
  patternSpeedKt: "",
  retractableGear: false,
  flapSpeeds: [["", "", "", "", ""]],
  weightBalance: {
    mtowKg: "",
    emptyWeightKg: "",
    emptyArmM: "",
    stations: Object.fromEntries(
      stationIds.map((id) => [id, { armM: "", defaultKg: "0" }]),
    ) as Record<StationId, { armM: string; defaultKg: string }>,
    fuel: { armM: "", densityKgPerL: "0.72", defaultL: "0" },
    envelope: [
      ["", ""],
      ["", ""],
      ["", ""],
    ],
  },
  takeoff: emptyDistance(),
  landing: emptyDistance(),
  climb: { rows: [["", "", "", ""]], fuelFlowLph: "" },
  cruise: { rows: [["", "", "", "", ""]] },
});

export type BuildError = {
  code: "required" | "incomplete" | "duplicate" | "invalid";
  /** Draft section (a key of `aircraft.section.*`, or a schema field for "invalid"). */
  section: string;
};
export type BuildResult =
  { ok: true; aircraft: Aircraft } | { ok: false; error: BuildError };

class DraftError extends Error {
  constructor(readonly detail: BuildError) {
    super(detail.code);
  }
}
const fail = (code: BuildError["code"], section: string): never => {
  throw new DraftError({ code, section });
};

const blank = (s: string) => s.trim() === "";
const parse = (s: string) =>
  blank(s) ? NaN : Number(s.trim().replace(",", "."));

/** A required number: blank or non-numeric is an error in `section`. */
function need(s: string, section: string) {
  const n = parse(s);
  return Number.isFinite(n) ? n : fail("incomplete", section);
}
/** An optional number: blank = null. */
const optional = (s: string, section: string) =>
  blank(s) ? null : need(s, section);

/** Drops untouched rows; a half-filled row is an error. */
function filled(rows: Row[], section: string, textColumns: number[] = []) {
  const used = rows.filter((r) => r.some((c) => !blank(c)));
  for (const r of used) if (r.some(blank)) fail("incomplete", section);
  return used.map((r) =>
    r.map((c, i) => (textColumns.includes(i) ? c.trim() : need(c, section))),
  );
}

/** Nests flat rows into a POH grid: the first `axes.length` cells of a row are its axis values. */
function nest<L>(
  rows: number[][],
  axes: GridAxis[],
  leaf: (rest: number[]) => L,
  section: string,
): Grid<L> {
  const [axis, ...deeper] = axes;
  const groups = new Map<number, number[][]>();
  for (const [at, ...rest] of rows)
    groups.set(at!, [...(groups.get(at!) ?? []), rest]);
  return {
    axis: axis!,
    points: [...groups]
      .sort(([a], [b]) => a - b)
      .map(([at, group]) => {
        if (deeper.length)
          return { at, next: nest(group, deeper, leaf, section) };
        if (group.length > 1) fail("duplicate", section);
        return { at, next: leaf(group[0]!) };
      }),
  };
}

const USER_SOURCE = "Entered by the user";

function distance(d: DistanceDraft, section: "takeoff" | "landing") {
  const rows = filled(d.rows, section) as number[][];
  if (!rows.length) return null;
  const weightKg = need(d.weightKg, section);
  const grid = nest(
    rows,
    ["pressureAltitudeFt", "temperatureC"],
    ([groundRollM, obstacle50ftM]) => ({
      groundRollM: groundRollM!,
      obstacle50ftM: obstacle50ftM!,
    }),
    section,
  );
  const headwind = optional(d.headwindPercentPerKt, section);
  const tailwind = optional(d.tailwindPercentPerKt, section);
  const grass = optional(d.grassPercent, section);
  return {
    defaultConfiguration: "standard",
    configurations: [
      {
        id: "standard",
        label: "Standard",
        tables: [
          {
            surface: d.surface,
            grid: {
              axis: "weightKg" as const,
              points: [{ at: weightKg, next: grid }],
            },
          },
        ],
        speeds: [
          {
            weightKg,
            liftoffKias: optional(d.liftoffKias, section),
            obstacle50ftKias: optional(d.obstacle50ftKias, section),
            approachKias: optional(d.approachKias, section),
          },
        ],
        corrections: {
          headwind: headwind === null ? null : { percentPerKt: headwind },
          tailwind:
            tailwind === null ? null : { percentPerKt: tailwind, maxKt: null },
          grass:
            grass === null
              ? null
              : { percentOf: "groundRoll" as const, percent: grass },
          pavedGroundRollFactor: null,
          slopeGroundRollPercentPerPercent: null,
        },
        // Unverified data: the planner shows its draft-data warning.
        draft: true,
        notes: [],
        source: USER_SOURCE,
      },
    ],
  };
}

/** The aircraft id: stable for a type name, so editing keeps saved flights pointing at it. */
export const customAircraftId = (type: string) =>
  `custom-${type
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

/**
 * Turns the form into an aircraft profile. Sections left empty become null, which the planner
 * already handles for the bundled aircraft with partial data.
 */
export function buildAircraft(
  draft: AircraftDraft,
  /** Types that already exist (other than the one being edited). */
  takenTypes: readonly string[],
  /** The built-in aircraft a `baseId` draft overrides. */
  base?: Aircraft,
): BuildResult {
  try {
    const type = base ? base.type : draft.type.trim().toUpperCase();
    if (!type) fail("required", "type");
    if (blank(draft.icaoType)) fail("required", "icaoType");
    if (
      takenTypes.some(
        (t) => normalizeRegistration(t) === normalizeRegistration(type),
      )
    )
      fail("duplicate", "type");

    const wb = draft.weightBalance;
    const wbUsed = [wb.mtowKg, wb.emptyWeightKg, wb.emptyArmM].some(
      (s) => !blank(s),
    );
    const envelope = filled(wb.envelope, "envelope") as number[][];
    const crosswind = optional(draft.maxCrosswindKt, "windLimits");
    const tailwind = optional(draft.maxTailwindKt, "windLimits");

    const parameters = {
      displayName: draft.displayName.trim() || type,
      icaoType: draft.icaoType.trim().toUpperCase(),
      powerplant: draft.powerplant,
      engineCount: optional(draft.engineCount, "engineCount"),
      usableFuelL: optional(draft.usableFuelL, "usableFuelL"),
      fuelTankCapacityL: optional(draft.fuelTankCapacityL, "fuelTankCapacityL"),
      patternSpeedKt: optional(draft.patternSpeedKt, "patternSpeedKt"),
      retractableGear: draft.retractableGear,
      flapSpeeds: flapSpeeds(draft.flapSpeeds, draft.retractableGear),
      weightBalance: wbUsed
        ? {
            // chartBounds and the source note stay with a built-in's data.
            ...base?.weightBalance,
            mtowKg: need(wb.mtowKg, "weightBalance"),
            emptyWeightKg: need(wb.emptyWeightKg, "weightBalance"),
            emptyArmM: need(wb.emptyArmM, "weightBalance"),
            // A station with no arm is not on this aircraft (the C152 has three).
            stations: stationIds
              .filter((id) => !blank(wb.stations[id].armM))
              .map((id) => ({
                id,
                armM: need(wb.stations[id].armM, "weightBalance"),
                defaultKg: need(wb.stations[id].defaultKg, "weightBalance"),
              })),
            fuel: {
              armM: need(wb.fuel.armM, "weightBalance"),
              densityKgPerL: need(wb.fuel.densityKgPerL, "weightBalance"),
              defaultL: need(wb.fuel.defaultL, "weightBalance"),
            },
            envelope: envelope.map(([weightKg, momentKgm]) => ({
              weightKg: weightKg!,
              momentKgm: momentKgm!,
            })),
            source: base?.weightBalance?.source ?? USER_SOURCE,
          }
        : null,
      windLimits:
        crosswind === null && tailwind === null
          ? null
          : { maxCrosswindKt: crosswind, maxTailwindKt: tailwind },
    };

    const edited = Object.fromEntries(
      rawSections.flatMap((k) => {
        const text = draft.raw[k];
        if (text === undefined) return [];
        try {
          return [[k, JSON.parse(text) as unknown]];
        } catch {
          return fail("invalid", k);
        }
      }),
    );

    const candidate = base
      ? { ...base, ...parameters, ...edited }
      : {
          id: customAircraftId(type),
          type,
          registration: null,
          // After every legacy type; the type list sorts on this.
          order: 1000,
          ...parameters,
          takeoff: distance(draft.takeoff, "takeoff"),
          landing: distance(draft.landing, "landing"),
          climb: climb(draft),
          cruise: cruise(draft),
          checklists: [],
        };
    const parsed = aircraftSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      return {
        ok: false,
        error: { code: "invalid", section: String(issue.path[0]) },
      };
    }
    return { ok: true, aircraft: parsed.data };
  } catch (error) {
    if (error instanceof DraftError) return { ok: false, error: error.detail };
    throw error;
  }
}

function flapSpeeds(rows: Row[], retractable: boolean) {
  // The gear-up columns are hidden on fixed gear, so they are not checked.
  const used = filled(
    rows.map((r) => r.slice(0, retractable ? 5 : 3)),
    "flapSpeeds",
    [0],
  ) as [string, ...number[]][];
  return used.map(([setting, downMin, downMax, upMin, upMax]) => ({
    setting,
    gearDown: { minKias: downMin!, maxKias: downMax! },
    gearUp: retractable ? { minKias: upMin!, maxKias: upMax! } : null,
  }));
}

function climb(draft: AircraftDraft) {
  const rows = filled(draft.climb.rows, "climb") as number[][];
  if (!rows.length) return null;
  return {
    label: "Climb",
    grid: nest(
      rows,
      ["pressureAltitudeFt", "temperatureC"],
      ([rateFpm, iasKt]) => ({ rateFpm: rateFpm!, iasKt: iasKt! }),
      "climb",
    ),
    fuelFlowLph: optional(draft.climb.fuelFlowLph, "climb"),
    draft: true,
    source: USER_SOURCE,
  };
}

function cruise(draft: AircraftDraft) {
  const rows = filled(draft.cruise.rows, "cruise", [2]);
  if (!rows.length) return null;
  return {
    source: USER_SOURCE,
    draft: true,
    rows: rows.map(
      ([pressureAltitudeFt, isaDeltaC, setting, ktas, fuelFlowLph]) => ({
        pressureAltitudeFt,
        isaDeltaC,
        setting,
        powerPct: null,
        ktas,
        fuelFlowLph,
      }),
    ),
  };
}

const text = (n: number | null) => (n === null ? "" : String(n));

const rawText = (a: Aircraft, k: RawSection) => JSON.stringify(a[k], null, 2);
export const rawFromAircraft = (a: Aircraft) =>
  Object.fromEntries(rawSections.map((k) => [k, rawText(a, k)]));

/** Drops sections still equal to the bundled data, so only real edits are stored. */
export const withoutUnchangedRaw = (
  draft: AircraftDraft,
  base: Aircraft,
): AircraftDraft => ({
  ...draft,
  raw: Object.fromEntries(
    Object.entries(draft.raw).filter(
      ([k, text]) => text !== rawText(base, k as RawSection),
    ),
  ),
});

const flapSpeedRows = (list: Aircraft["flapSpeeds"]): Row[] =>
  list.length
    ? list.map((f) => [
        f.setting,
        text(f.gearDown.minKias),
        text(f.gearDown.maxKias),
        text(f.gearUp?.minKias ?? null),
        text(f.gearUp?.maxKias ?? null),
      ])
    : [["", "", "", "", ""]];

/** The editable parameters of a built-in aircraft, as form text. */
export function draftFromAircraft(a: Aircraft): AircraftDraft {
  const draft = emptyDraft();
  const wb = a.weightBalance;
  return {
    ...draft,
    baseId: a.id,
    raw: rawFromAircraft(a),
    type: a.type,
    displayName: a.displayName,
    icaoType: a.icaoType,
    powerplant: a.powerplant,
    engineCount: text(a.engineCount),
    usableFuelL: text(a.usableFuelL),
    fuelTankCapacityL: text(a.fuelTankCapacityL),
    maxCrosswindKt: text(a.windLimits?.maxCrosswindKt ?? null),
    maxTailwindKt: text(a.windLimits?.maxTailwindKt ?? null),
    patternSpeedKt: text(a.patternSpeedKt),
    retractableGear: a.retractableGear,
    flapSpeeds: flapSpeedRows(a.flapSpeeds),
    weightBalance: wb
      ? {
          mtowKg: text(wb.mtowKg),
          emptyWeightKg: text(wb.emptyWeightKg),
          emptyArmM: text(wb.emptyArmM),
          stations: Object.fromEntries(
            stationIds.map((id) => {
              const station = wb.stations.find((s) => s.id === id);
              return [
                id,
                {
                  armM: text(station?.armM ?? null),
                  defaultKg: text(station?.defaultKg ?? 0),
                },
              ];
            }),
          ) as AircraftDraft["weightBalance"]["stations"],
          fuel: {
            armM: text(wb.fuel.armM),
            densityKgPerL: text(wb.fuel.densityKgPerL),
            defaultL: text(wb.fuel.defaultL),
          },
          envelope: wb.envelope.map((p) => [
            text(p.weightKg),
            text(p.momentKgm),
          ]),
        }
      : draft.weightBalance,
  };
}

/** Key a draft is stored and replaced by: the built-in's id, or the id derived from its type. */
export const draftId = (d: Pick<AircraftDraft, "baseId" | "type">) =>
  d.baseId ?? customAircraftId(d.type);
