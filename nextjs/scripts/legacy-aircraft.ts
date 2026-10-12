/**
 * Converts the legacy aircraft profiles (window.NORDSWEET_AIRCRAFT_DATA + *_PERFORMANCE globals)
 * into the shared aircraft schema. Each legacy aircraft had its own table layout and hand-written
 * lookup code; here they all become one nested distance grid plus data-driven corrections.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import {
  type Aircraft,
  type Climb,
  type Cruise,
  type ClimbLeaf,
  type Corrections,
  type DistanceConfiguration,
  type DistanceGrid,
  type DistanceLeaf,
  type DistancePerformance,
  type Grid,
  type GridAxis,
  type WeightBalance,
} from "../src/data/aircraft";
import { isaTemperatureC } from "../src/domain/atmosphere";

type Legacy = Record<string, any>;

const LB_TO_KG = 0.45359237;
/** 1000 lb·in in kg·m. */
const MOMENT_1000_LBIN_TO_KGM = 11.521246;

function loadProfiles(
  publicDir: string,
  plannerSource: string,
): Record<string, Legacy> {
  const window: Legacy = {};
  window.window = window;
  const context = vm.createContext({ window, console });
  // Same files, same order as the legacy planner loads them.
  const files = [
    ...plannerSource.matchAll(/loadScript\("\.\/(aircraft-data[^"]*)"\)/g),
  ].map((m) => decodeURIComponent(m[1]!));
  for (const file of files)
    vm.runInContext(
      fs.readFileSync(path.join(publicDir, file), "utf8"),
      context,
    );
  return window.NORDSWEET_AIRCRAFT_DATA.profiles;
}

// --- grid builders -------------------------------------------------------------------------------

const leaf = (groundRollM: number, obstacle50ftM: number): DistanceLeaf => ({
  groundRollM,
  obstacle50ftM,
});

function axis<L = DistanceLeaf>(
  name: GridAxis,
  points: { at: number; next: Grid<L> | L }[],
): Grid<L> {
  return { axis: name, points: [...points].sort((a, b) => a.at - b.at) };
}

/** Table indexed [pressureAltitude][temperature] with optional ISA column per altitude (P2006T). */
function paTempGrid(table: Legacy, withIsaColumn = false): DistanceGrid {
  return axis(
    "pressureAltitudeFt",
    (table.pressureAltitudesFt as number[]).map((pa, i) => {
      const temps = (table.temperaturesC as number[]).map((t, j) => ({
        at: t,
        next: leaf(
          table.distanceM.groundRoll[i][j],
          table.distanceM.obstacle50ft[i][j],
        ),
      }));
      if (withIsaColumn) {
        temps.push({
          at: Math.round(isaTemperatureC(pa) * 10) / 10,
          next: leaf(
            table.isaReference.groundRollM[i],
            table.isaReference.obstacle50ftM[i],
          ),
        });
      }
      return { at: pa, next: axis("temperatureC", temps) };
    }),
  );
}

function byWeight(
  tables: Legacy[],
  weightKg: (t: Legacy) => number,
  inner: (t: Legacy) => DistanceGrid,
) {
  return axis(
    "weightKg",
    tables.map((t) => ({
      at: Math.round(weightKg(t) * 10) / 10,
      next: inner(t),
    })),
  );
}

const noCorrections: Corrections = {
  headwind: null,
  tailwind: null,
  grass: null,
  pavedGroundRollFactor: null,
  slopeGroundRollPercentPerPercent: null,
};

function configuration(
  c: Partial<DistanceConfiguration> &
    Pick<DistanceConfiguration, "id" | "label" | "tables">,
) {
  return {
    speeds: [],
    corrections: noCorrections,
    draft: false,
    notes: [],
    source: "",
    ...c,
  } satisfies DistanceConfiguration;
}

const single = (c: DistanceConfiguration): DistancePerformance => ({
  defaultConfiguration: c.id,
  configurations: [c],
});

// --- per-aircraft converters ---------------------------------------------------------------------

function cessnaCorrections(c: Legacy): Corrections {
  return {
    ...noCorrections,
    headwind: { percentPerKt: c.headwindDecreasePercentPerKt },
    tailwind: {
      percentPerKt: c.tailwindIncreasePercentPerKt,
      maxKt: c.tailwindLimitKt ?? null,
    },
    grass: {
      percentOf: "groundRoll",
      percent: c.dryGrassIncreaseByGroundRollPercent,
    },
  };
}

function r172k(p: Legacy) {
  const phase = (data: Legacy, kind: "takeoff" | "landing") => {
    const tables = Object.values<Legacy>(data.weightsLb);
    return single(
      configuration({
        id: `flaps-${data.flapsDeg}`,
        label: `Flaps ${data.flapsDeg}°, short field`,
        tables: [
          {
            surface: "paved",
            grid: byWeight(
              tables,
              (t) => t.weightKg,
              (t) => paTempGrid(t),
            ),
          },
        ],
        speeds: tables.map((t) => ({
          weightKg: t.weightKg,
          liftoffKias: kind === "takeoff" ? t.liftoffSpeedKias : null,
          obstacle50ftKias: kind === "takeoff" ? t.obstacle50ftSpeedKias : null,
          approachKias:
            kind === "landing" ? t.shortFinalApproachSpeedKias : null,
        })),
        corrections: cessnaCorrections(data.corrections),
        notes: data.notes ?? [],
        source: data.source,
      }),
    );
  };
  return {
    takeoff: phase(p.takeoff, "takeoff"),
    landing: phase(p.landing, "landing"),
  };
}

function p2006t(p: Legacy) {
  // The data labels these "percent per kt"; the POH (and the legacy planner) use metres per knot.
  const takeoffTables = Object.entries<Legacy>(p.weightsKg).map(
    ([kg, t]): Legacy => ({ ...t, weightKg: Number(kg) }),
  );
  const landingTables = Object.entries<Legacy>(p.landing.weightsKg).map(
    ([kg, t]): Legacy => ({ ...t, weightKg: Number(kg) }),
  );
  return {
    takeoff: single(
      configuration({
        id: "takeoff",
        label: "Flaps T/O, full throttle",
        tables: [
          {
            surface: "grass",
            grid: byWeight(
              takeoffTables,
              (t) => t.weightKg,
              (t) => paTempGrid(t, true),
            ),
          },
        ],
        speeds: takeoffTables.map((t) => ({
          weightKg: t.weightKg,
          liftoffKias: t.liftoffSpeedKias,
          obstacle50ftKias: t.obstacle50ftSpeedKias,
          approachKias: null,
        })),
        corrections: {
          headwind: {
            metersPerKt: Math.abs(p.corrections.headwind_percent_per_kt),
          },
          tailwind: {
            metersPerKt: p.corrections.tailwind_percent_per_kt,
            maxKt: null,
          },
          grass: null,
          pavedGroundRollFactor: 1 + p.corrections.paved_runway_percent / 100,
          slopeGroundRollPercentPerPercent: {
            uphill: p.corrections.uphill_percent_per_slope_percent,
            downhill: 0,
          },
        },
        source: p.source,
      }),
    ),
    landing: single(
      configuration({
        id: "landing",
        label: "Flaps LAND, idle",
        tables: [
          {
            surface: "grass",
            grid: byWeight(
              landingTables,
              (t) => t.weightKg,
              (t) => paTempGrid(t, true),
            ),
          },
        ],
        speeds: landingTables.map((t) => ({
          weightKg: t.weightKg,
          liftoffKias: null,
          obstacle50ftKias: null,
          approachKias: t.shortFinalApproachSpeedKias,
        })),
        corrections: {
          headwind: {
            metersPerKt: Math.abs(p.landing.corrections.headwind_m_per_kt),
          },
          tailwind: {
            metersPerKt: p.landing.corrections.tailwind_m_per_kt,
            maxKt: null,
          },
          grass: null,
          pavedGroundRollFactor:
            1 + p.landing.corrections.hard_runway_percent / 100,
          slopeGroundRollPercentPerPercent: {
            uphill:
              p.landing.corrections.slope_ground_roll_percent_per_slope_percent,
            downhill:
              -p.landing.corrections
                .slope_ground_roll_percent_per_slope_percent,
          },
        },
        source: p.landing.source,
      }),
    ),
  };
}

/** FR172H: distances per altitude at the standard temperature only; take-off tabulated by headwind. */
function fr172h(p: Legacy) {
  const altitudeGrid = (distances: Legacy[], ground: string) =>
    axis(
      "pressureAltitudeFt",
      distances.map((d) => ({
        at: d.pressureAltitudeFt,
        next: axis("temperatureC", [
          { at: d.temperatureC, next: leaf(d[ground], d.clear15mObstacleM) },
        ]),
      })),
    );
  const rows = p.takeoff.rows as Legacy[];
  const weights = [...new Set(rows.map((r) => r.grossWeightKg as number))];
  const landing = p.landing.rows[0] as Legacy;
  return {
    takeoff: single(
      configuration({
        id: `flaps-${p.takeoff.flapsDeg}`,
        label: `Flaps ${p.takeoff.flapsDeg}°`,
        tables: [
          {
            surface: "paved",
            grid: axis(
              "weightKg",
              weights.map((w) => ({
                at: w,
                next: axis(
                  "headwindKt",
                  rows
                    .filter((r) => r.grossWeightKg === w)
                    .map((r) => ({
                      at: r.headwindKt,
                      next: altitudeGrid(r.distances, "groundRunM"),
                    })),
                ),
              })),
            ),
          },
        ],
        speeds: weights.map((w) => ({
          weightKg: w,
          liftoffKias: null,
          obstacle50ftKias: rows.find((r) => r.grossWeightKg === w)!
            .v1At15mKias,
          approachKias: null,
        })),
        notes: ["Obstacle distances are to clear 15 m."],
        source: p.takeoff.source,
      }),
    ),
    landing: single(
      configuration({
        id: `flaps-${p.landing.flapsDeg}`,
        label: `Flaps ${p.landing.flapsDeg}°, power off`,
        tables: [
          {
            surface: "paved",
            grid: axis("weightKg", [
              {
                at: landing.grossWeightKg,
                next: altitudeGrid(landing.distances, "groundRollM"),
              },
            ]),
          },
        ],
        speeds: [
          {
            weightKg: landing.grossWeightKg,
            liftoffKias: null,
            obstacle50ftKias: null,
            approachKias: landing.approachSpeedKias,
          },
        ],
        corrections: {
          ...noCorrections,
          headwind: { percentPerKt: 2 }, // "Reduce landing distance 10% for each 5 knots headwind."
          grass: { percentOf: "obstacle50ft", percent: 20 },
        },
        notes: [
          ...(p.landing.notes ?? []),
          "Obstacle distances are to clear 15 m.",
        ],
        source: p.landing.source,
      }),
    ),
  };
}

/** SD-4: one value per surface at maximum weight; altitude and temperature not tabulated. */
function sd4(p: Legacy, mtowKg: number) {
  const tables = (surfaces: Legacy) =>
    (["tarmacConcrete", "grass"] as const)
      .filter((s) => surfaces[s])
      .map((s) => ({
        surface: s === "grass" ? ("grass" as const) : ("paved" as const),
        grid: axis("weightKg", [
          {
            at: mtowKg,
            next: leaf(surfaces[s].groundRollM, surfaces[s].obstacle50ftM),
          },
        ]),
      }));
  return {
    takeoff: single(
      configuration({
        id: "takeoff",
        label: p.takeoff.flaps ?? "Take-off",
        tables: tables(p.takeoff.surfaces),
        speeds: [
          {
            weightKg: mtowKg,
            liftoffKias: null,
            obstacle50ftKias: p.takeoff.speedOver50ftKias,
            approachKias: null,
          },
        ],
        notes: p.takeoff.notes ?? [],
        source: p.takeoff.source,
      }),
    ),
    landing: {
      defaultConfiguration: p.landing.defaultVariant,
      configurations: Object.entries<Legacy>(p.landing.variants).map(
        ([id, v]) =>
          configuration({
            id,
            label: `${v.flaps}, ${v.label}`,
            tables: tables(v.surfaces),
            speeds: [
              {
                weightKg: mtowKg,
                liftoffKias: null,
                obstacle50ftKias: null,
                approachKias: v.speedOver50ftKias,
              },
            ],
            notes: p.landing.notes ?? [],
            source: p.landing.source,
          }),
      ),
    },
  };
}

/** Husky: chart-digitized variants by flaps (and propeller), one weight each. */
function husky(p: Legacy) {
  const phase = (
    data: Legacy,
    kind: "takeoff" | "landing",
  ): DistancePerformance => ({
    defaultConfiguration: data.defaultVariant,
    configurations: Object.entries<Legacy>(data.variants).map(([id, v]) => {
      const tables = Object.entries<Legacy>(v.weightsKg).map(
        ([kg, t]): Legacy => ({ ...t, weightKg: Number(kg) }),
      );
      return configuration({
        id,
        label:
          `Flaps ${v.flaps}` +
          (v.propellerDiameterIn
            ? `, ${v.propellerDiameterIn}" propeller`
            : ""),
        tables: [
          {
            surface: "paved",
            grid: byWeight(
              tables,
              (t) => t.weightKg,
              (t) => paTempGrid(t),
            ),
          },
        ],
        speeds: tables.map((t) => ({
          weightKg: t.weightKg,
          liftoffKias: kind === "takeoff" ? (t.liftoffSpeedKias ?? null) : null,
          obstacle50ftKias:
            kind === "takeoff" ? (t.obstacle50ftSpeedKias ?? null) : null,
          approachKias:
            kind === "landing" ? (t.shortFinalApproachSpeedKias ?? null) : null,
        })),
        draft: String(v.status).startsWith("draft"),
        notes: v.notes ?? [],
        source: v.source,
      });
    }),
  });
  return {
    takeoff: phase(p.takeoff, "takeoff"),
    landing: phase(p.landing, "landing"),
  };
}

// --- weight & balance ----------------------------------------------------------------------------

/**
 * These profiles stored Cessna "moment/1000 lb·in" chart values as if they were CG inches, which put
 * their envelopes at 1.3–3.1 m. Rebuild them from the source chart pairs.
 */
const MIS_CONVERTED_ENVELOPES = new Set([
  "C172M",
  "C152",
  "C152|SPRBB",
  "FR172H",
]);

function envelopeFromCessnaChart(text: string) {
  return [...text.matchAll(/([\d.]+)\/(\d+)/g)].map((m) => ({
    weightKg: Math.round(Number(m[2]) * LB_TO_KG * 1000) / 1000,
    momentKgm: Math.round(Number(m[1]) * MOMENT_1000_LBIN_TO_KGM * 1000) / 1000,
  }));
}

function weightBalance(id: string, wb: Legacy | null): WeightBalance | null {
  if (!wb) return null;
  const defaults = wb.defaults ?? {};
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const stations = (
    [
      "pilot",
      "coPilot",
      "firstPassenger",
      "secondPassenger",
      "baggage",
    ] as const
  )
    .filter((s) => wb.armsM[s] !== 0) // arm 0 = seat does not exist (C152 rear seats)
    .map((s) => ({
      id: s,
      armM: wb.armsM[s],
      defaultKg: num(defaults[`${s}WeightKg`]),
    }));
  return {
    mtowKg: wb.mtowKg ?? wb.maxTakeoffWeightKg,
    emptyWeightKg: num(defaults.emptyWeightKg),
    emptyArmM: num(defaults.emptyArmM),
    stations,
    fuel: {
      armM: wb.fuelArmM ?? wb.armsM.fuel,
      densityKgPerL: wb.fuelDensityKgPerL,
      defaultL: num(defaults.usableFuelLiters),
    },
    envelope: MIS_CONVERTED_ENVELOPES.has(id)
      ? envelopeFromCessnaChart(wb.sourceUnits.weightBalanceEnvelope)
      : wb.envelope.points.map((pt: Legacy) => ({
          weightKg: pt.weightKg,
          momentKgm: pt.momentKgm,
        })),
    source: wb.source ?? "",
  };
}

// --- climb ----------------------------------------------------------------------------------------

/** Rate-of-climb table [pressureAltitude][temperature] with per-altitude Vy and optional ISA column. */
function climbGrid(
  table: Legacy,
  ias: (i: number) => number,
  withIsaColumn: boolean,
): Grid<ClimbLeaf> {
  return axis<ClimbLeaf>(
    "pressureAltitudeFt",
    (table.pressureAltitudesFt as number[]).map((pa, i) => {
      const temps = (table.temperaturesC as number[])
        .map((t, j) => ({
          at: t,
          next: { rateFpm: table.rateOfClimbFpm[i][j], iasKt: ias(i) },
        }))
        .filter((pt) => pt.next.rateFpm !== null); // blank POH cells (R172K: hottest column up high)
      if (withIsaColumn) {
        temps.push({
          at: Math.round(isaTemperatureC(pa) * 10) / 10,
          next: {
            rateFpm: table.isaReference.rateOfClimbFpm[i],
            iasKt: ias(i),
          },
        });
      }
      return { at: pa, next: axis<ClimbLeaf>("temperatureC", temps) };
    }),
  );
}

const climbByWeight = (
  tables: Legacy[],
  inner: (t: Legacy) => Grid<ClimbLeaf>,
) =>
  axis<ClimbLeaf>(
    "weightKg",
    tables.map((t) => ({
      at: Math.round(t.weightKg * 10) / 10,
      next: inner(t),
    })),
  );

function climb(id: string, p: Legacy): Climb | null {
  if (id === "P2006T") {
    const tables = Object.entries<Legacy>(p.climb.weightsKg).map(
      ([kg, t]): Legacy => ({ ...t, weightKg: Number(kg) }),
    );
    return {
      label: `${p.climb.powerSetting}, Vy`,
      grid: climbByWeight(tables, (t) =>
        climbGrid({ ...p.climb, ...t }, (i) => t.climbSpeedVyKias[i], true),
      ),
      fuelFlowLph: null,
      draft: false,
      source: p.climb.source,
    };
  }
  if (id === "R172K") {
    const tables = Object.values<Legacy>(p.climb.weightsLb);
    return {
      label: `${p.climb.powerSetting}, ${p.climb.speedLabel}`,
      grid: climbByWeight(tables, (t) =>
        climbGrid(t, (i) => t.climbSpeedKias[i], false),
      ),
      fuelFlowLph: p.climb.fuelFlowLph,
      draft: false,
      source: p.climb.source,
    };
  }
  if (id === "FR172H") {
    // Standard-day rows: one temperature per altitude.
    return {
      label: "Full throttle, best rate",
      grid: axis<ClimbLeaf>(
        "weightKg",
        (p.climb.rows as Legacy[]).map((row) => ({
          at: row.grossWeightKg,
          next: axis<ClimbLeaf>(
            "pressureAltitudeFt",
            (row.data as Legacy[]).map((d) => ({
              at: d.pressureAltitudeFt,
              next: axis<ClimbLeaf>("temperatureC", [
                {
                  at: d.temperatureC,
                  next: { rateFpm: d.rateOfClimbFpm, iasKt: d.viKias },
                },
              ]),
            })),
          ),
        })),
      ),
      fuelFlowLph: null,
      draft: false,
      source: p.climb.source,
    };
  }
  if (id === "SD-4") {
    const vy = p.climb.profiles.cleanVy;
    // Average flow of the 70 KIAS fuel/time-to-climb chart (closest to Vy) to its top altitude.
    const chart = p.climbToAltitude.profiles["70"];
    const last = chart.timeMinutes.length - 1;
    return {
      label: `${p.climb.powerSetting}, Vy`,
      grid: axis<ClimbLeaf>("weightKg", [
        {
          at: p.climb.weightKg,
          next: axis<ClimbLeaf>(
            "densityAltitudeFt",
            (p.climb.densityAltitudesFt as number[]).map((da, i) => ({
              at: da,
              next: { rateFpm: vy.rateOfClimbFpm[i], iasKt: vy.speedKias[i] },
            })),
          ),
        },
      ]),
      fuelFlowLph:
        Math.round(
          (chart.fuelLiters[last] / chart.timeMinutes[last]) * 60 * 10,
        ) / 10,
      draft: Boolean(p.climb.digitizedFromChart),
      source: p.climb.source,
    };
  }
  if (id === "A-1A HUSKY") {
    const variant = p.climb.variants[p.climb.defaultVariant];
    const tables = Object.entries<Legacy>(variant.weightsKg).map(
      ([kg, t]): Legacy => ({ ...t, weightKg: Number(kg) }),
    );
    return {
      label: `${variant.powerSetting}, Vy, flaps ${variant.flaps}`,
      grid: climbByWeight(tables, (t) =>
        climbGrid(t, (i) => t.climbSpeedVyKias[i], true),
      ),
      fuelFlowLph: null,
      draft: String(variant.status).startsWith("draft"),
      source: variant.source,
    };
  }
  return null;
}

// --- cruise ---------------------------------------------------------------------------------------

const settingLabel = (
  rpm: number | null | undefined,
  map: number | null | undefined,
) =>
  [rpm ? `${rpm} RPM` : null, map ? `${map} inHg` : null]
    .filter(Boolean)
    .join(" / ");

/** P2006T, R172K, Husky, SD-4: tables[altitude] = rows of { rpm, map, values[] per ISA deviation }. */
function cruise(id: string, p: Legacy): Cruise | null {
  const c = p.cruise;
  if (!c) return null;
  if (id === "FR172H") {
    return {
      source: "FR172H POH cruise performance (standard temperature)",
      draft: false,
      rows: (c.rows as Legacy[]).map((r) => ({
        pressureAltitudeFt: r.altitudeFt,
        isaDeltaC: 0,
        setting: settingLabel(r.rpm, r.mpInHg),
        powerPct: r.powerPercent ?? null,
        ktas: r.ktas,
        fuelFlowLph: r.fuelLph,
      })),
    };
  }
  const engines = c.engineCount ?? (id === "P2006T" ? 2 : 1);
  const rows: Cruise["rows"] = [];
  for (const [altitude, settings] of Object.entries<Legacy[]>(c.tables)) {
    for (const row of settings) {
      (row.values as (Legacy | null)[]).forEach((v, i) => {
        if (!v) return; // blank POH cell
        const flow = v.fuelTotalLph ?? v.fuelPerEngineLph * engines;
        rows.push({
          pressureAltitudeFt: Number(altitude),
          isaDeltaC: c.isaDeltaC?.[i] ?? 0,
          setting: settingLabel(row.rpm, row.mapInHg),
          powerPct: v.pwrPct ?? null,
          ktas: v.ktas,
          fuelFlowLph: Math.round(flow * 10) / 10,
        });
      });
    }
  }
  return {
    source: c.source ?? `${id} cruise performance`,
    draft:
      Boolean(c.digitizedFromChart) ||
      String(c.status ?? "").startsWith("partial"),
    rows,
  };
}

// --- entry point -----------------------------------------------------------------------------------

export function importAircraft(
  publicDir: string,
  plannerSource: string,
): Aircraft[] {
  const profiles = loadProfiles(publicDir, plannerSource);
  return Object.entries(profiles)
    .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99))
    .map(([id, p]) => {
      const wb = weightBalance(id, p.weightBalance);
      const perf =
        id === "R172K"
          ? r172k(p.performance)
          : id === "P2006T"
            ? p2006t(p.performance)
            : id === "FR172H"
              ? fr172h(p.performance)
              : id === "SD-4"
                ? sd4(p.performance, wb!.mtowKg)
                : id === "A-1A HUSKY"
                  ? husky(p.performance)
                  : { takeoff: null, landing: null };
      const wind = p.limitations?.wind;
      return {
        id: id.replace(/[|\s]+/g, "-"),
        type: p.type,
        registration: p.registration ? String(p.registration) : null,
        displayName: p.displayName,
        icaoType: p.icaoType,
        usableFuelL: p.usableFuelCapacityLiters ?? null,
        weightBalance: wb,
        climb: climb(id, p.performance ?? {}),
        cruise: cruise(id, p.performance ?? {}),
        checklists: ((p.checklists ?? []) as Legacy[]).map((c) => ({
          id: String(c.id),
          name: String(c.name).trim(),
          phase: c.phase,
          sections: (c.sections as Legacy[]).map((section) => ({
            title: String(section.title ?? "").trim(),
            items: (section.items as Legacy[]).map((item) => ({
              action: String(item.action ?? "").trim(),
              expected: String(item.expected ?? "").trim(),
            })),
          })),
        })),
        ...perf,
        windLimits: wind
          ? {
              maxCrosswindKt: wind.maxDemonstratedCrosswindKt ?? null,
              maxTailwindKt: wind.maxTailwindKt ?? null,
            }
          : null,
      };
    });
}
