import { type Cruise } from "~/data/aircraft";

/**
 * Legacy planner cruise lookups (ported as-is so plans match it):
 * - "eco-time": lowest fuel flow (endurance; used for holding),
 * - "eco-distance": best ground distance per litre for the given wind component.
 */
export type CruiseMode = "eco-time" | "eco-distance";
/** Legacy CONFIG manual engine setting: the table blended around this RPM and MAP. */
export type ManualSetting = { rpm: number; mapInHg: number };

/** "2250 RPM / 28 inHg" → numbers. */
export function rpmMap(setting: string) {
  const m = /(\d+)\s*RPM\s*\/\s*([\d.]+)\s*inHg/i.exec(setting);
  return m ? { rpm: Number(m[1]), mapInHg: Number(m[2]) } : null;
}

/**
 * Legacy interpolateCruiseByEngineSetting: the exact table setting, else an inverse-square
 * distance blend of the 4 nearest (RPM scaled by 250, MAP by 2 inHg).
 */
function pickManual(
  entries: Entry[],
  target: ManualSetting,
): Entry | undefined {
  const withSetting = entries.flatMap((e) => {
    const s = rpmMap(e.setting);
    const fixedPitch = /^(\d+)\s*RPM$/i.exec(e.setting);
    return s
      ? [{ e, ...s }]
      : fixedPitch
        ? [{ e, rpm: Number(fixedPitch[1]), mapInHg: target.mapInHg }]
        : [];
  });
  const exact = withSetting.find(
    (x) =>
      Math.abs(x.rpm - target.rpm) < 0.01 &&
      Math.abs(x.mapInHg - target.mapInHg) < 0.01,
  );
  if (exact) return exact.e;
  // Fixed-pitch tables have RPM only; do not invent manifold pressure or extrapolate past lean-mixture settings.
  if (entries.length && entries.every((e) => /^\d+\s*RPM$/i.test(e.setting))) {
    const sorted = withSetting.sort((a, b) => a.rpm - b.rpm);
    const lo = [...sorted].reverse().find((e) => e.rpm < target.rpm);
    const hi = sorted.find((e) => e.rpm > target.rpm);
    if (!lo || !hi) return undefined;
    const ratio = (target.rpm - lo.rpm) / (hi.rpm - lo.rpm);
    return {
      setting: `${target.rpm} RPM`,
      ktas: lerp(lo.e.ktas, hi.e.ktas, ratio),
      fuelFlowLph: lerp(lo.e.fuelFlowLph, hi.e.fuelFlowLph, ratio),
      powerPct: lerpOptional(lo.e.powerPct, hi.e.powerPct, ratio),
    };
  }
  const nearest = withSetting
    .map((x) => ({
      x,
      d: Math.hypot(
        (x.rpm - target.rpm) / 250,
        (x.mapInHg - target.mapInHg) / 2,
      ),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
  if (!nearest.length) return undefined;
  let w = 0;
  const sum = { ktas: 0, fuelFlowLph: 0, powerPct: 0, powerW: 0 };
  for (const { x, d } of nearest) {
    const weight = 1 / Math.max(d * d, 0.0001);
    w += weight;
    sum.ktas += x.e.ktas * weight;
    sum.fuelFlowLph += x.e.fuelFlowLph * weight;
    if (x.e.powerPct !== null) {
      sum.powerPct += x.e.powerPct * weight;
      sum.powerW += weight;
    }
  }
  return {
    setting: `${target.rpm} RPM / ${target.mapInHg} inHg`,
    ktas: sum.ktas / w,
    fuelFlowLph: sum.fuelFlowLph / w,
    powerPct: sum.powerW ? sum.powerPct / sum.powerW : null,
  };
}

export type CruisePerformance = {
  setting: string;
  ktas: number;
  fuelFlowLph: number;
  powerPct: number | null;
  groundSpeedKt: number;
};

type Entry = Omit<CruisePerformance, "groundSpeedKt">;

/** The legacy planner's rounded ISA (2 °C/1000 ft) for table ISA deviations, so plans match it. */
const isaTemperatureC = (pressureAltitudeFt: number) =>
  15 - 0.002 * pressureAltitudeFt;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpOptional = (a: number | null, b: number | null, t: number) =>
  a !== null && b !== null ? lerp(a, b, t) : (a ?? b);

/** Bracketing table values, clamped to the ends (the legacy getBracket). */
export function bracket(values: readonly number[], target: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  if (target <= first) return { lower: first, upper: first, ratio: 0 };
  if (target >= last) return { lower: last, upper: last, ratio: 0 };
  const i = sorted.findIndex((v, j) => target >= v && target <= sorted[j + 1]!);
  const lower = sorted[i]!;
  const upper = sorted[i + 1]!;
  return { lower, upper, ratio: (target - lower) / (upper - lower) };
}

const altitudes = (cruise: Cruise) => [
  ...new Set(cruise.rows.map((r) => r.pressureAltitudeFt)),
];

/** Every setting at a tabulated altitude, interpolated for the ISA deviation; settings missing a bracketing column are dropped. */
function entriesAt(cruise: Cruise, altitudeFt: number, isaDeltaC: number) {
  const isa = bracket(
    [...new Set(cruise.rows.map((r) => r.isaDeltaC))],
    isaDeltaC,
  );
  const settings = new Map<string, Cruise["rows"]>();
  for (const row of cruise.rows) {
    if (row.pressureAltitudeFt !== altitudeFt) continue;
    settings.set(row.setting, [...(settings.get(row.setting) ?? []), row]);
  }
  const entries: Entry[] = [];
  for (const [setting, rows] of settings) {
    const lo = rows.find((r) => r.isaDeltaC === isa.lower);
    const hi = rows.find((r) => r.isaDeltaC === isa.upper);
    if (!lo || !hi) continue;
    const powerPct = lerpOptional(lo.powerPct, hi.powerPct, isa.ratio);
    entries.push({
      setting,
      ktas: lerp(lo.ktas, hi.ktas, isa.ratio),
      fuelFlowLph: lerp(lo.fuelFlowLph, hi.fuelFlowLph, isa.ratio),
      powerPct,
    });
  }
  return entries;
}

function pick(
  entries: Entry[],
  mode: CruiseMode | ManualSetting,
  windKt: number,
  maximumLeanPowerPct?: number,
) {
  if (typeof mode === "object") {
    const selected = pickManual(entries, mode);
    return selected &&
      (maximumLeanPowerPct === undefined ||
        selected.powerPct === null ||
        selected.powerPct <= maximumLeanPowerPct)
      ? selected
      : undefined;
  }
  const operating = entries.filter(
    (e) =>
      maximumLeanPowerPct === undefined ||
      e.powerPct === null ||
      e.powerPct <= maximumLeanPowerPct,
  );
  if (mode === "eco-distance") {
    const range = (e: Entry) =>
      Math.max(0, e.ktas + windKt) / Math.max(e.fuelFlowLph, 0.001);
    return [...operating].sort((a, b) =>
      Math.abs(range(b) - range(a)) > 0.0001
        ? range(b) - range(a)
        : a.fuelFlowLph - b.fuelFlowLph,
    )[0];
  }
  return [...operating].sort((a, b) =>
    Math.abs(a.fuelFlowLph - b.fuelFlowLph) > 0.001
      ? a.fuelFlowLph - b.fuelFlowLph
      : b.ktas - a.ktas,
  )[0];
}

/** Chosen setting at `pressureAltitudeFt`, interpolated between the bracketing table altitudes. */
export function cruisePerformance(
  cruise: Cruise,
  pressureAltitudeFt: number,
  oatC: number,
  windComponentKt: number,
  mode: CruiseMode | ManualSetting,
): CruisePerformance | null {
  const observed = cruise.observations?.find(
    (point) =>
      Math.abs(point.pressureAltitudeFt - pressureAltitudeFt) < 0.01 &&
      Math.abs(point.oatC - oatC) < 0.01 &&
      (typeof mode === "string" || Math.abs(point.rpm - mode.rpm) < 0.01),
  );
  if (observed) {
    return {
      setting: `${observed.rpm} RPM`,
      ktas: observed.ktas,
      fuelFlowLph: observed.fuelFlowLph,
      powerPct: null,
      groundSpeedKt: observed.ktas + windComponentKt,
    };
  }
  const isaDeltaC = oatC - isaTemperatureC(pressureAltitudeFt);
  const alt = bracket(altitudes(cruise), pressureAltitudeFt);
  const lower = pick(
    entriesAt(cruise, alt.lower, isaDeltaC),
    mode,
    windComponentKt,
    cruise.maximumLeanPowerPct,
  );
  const upper = pick(
    entriesAt(cruise, alt.upper, isaDeltaC),
    mode,
    windComponentKt,
    cruise.maximumLeanPowerPct,
  );
  if (!lower || !upper) return null;
  const ktas = lerp(lower.ktas, upper.ktas, alt.ratio);
  return {
    setting: alt.ratio < 0.5 ? lower.setting : upper.setting,
    ktas,
    fuelFlowLph: lerp(lower.fuelFlowLph, upper.fuelFlowLph, alt.ratio),
    powerPct: lerpOptional(lower.powerPct, upper.powerPct, alt.ratio),
    groundSpeedKt: ktas + windComponentKt,
  };
}

/** Fuel flow at a power setting (e.g. 95% for climbs), from the table's power column. */
function flowAtPowerAt(entries: Entry[], powerPct: number) {
  const withPower = entries
    .filter((e): e is Entry & { powerPct: number } => e.powerPct !== null)
    .sort((a, b) => a.powerPct - b.powerPct);
  if (!withPower.length) {
    const lowest = [...entries].sort(
      (a, b) => a.fuelFlowLph - b.fuelFlowLph,
    )[0];
    return lowest?.fuelFlowLph ?? null;
  }
  if (withPower.length === 1 || powerPct <= withPower[0]!.powerPct)
    return withPower[0]!.fuelFlowLph;
  for (let i = 0; i < withPower.length - 1; i++) {
    const lo = withPower[i]!;
    const hi = withPower[i + 1]!;
    if (powerPct >= lo.powerPct && powerPct <= hi.powerPct) {
      const t =
        hi.powerPct === lo.powerPct
          ? 0
          : (powerPct - lo.powerPct) / (hi.powerPct - lo.powerPct);
      return lerp(lo.fuelFlowLph, hi.fuelFlowLph, t);
    }
  }
  // Above the table: extrapolate the top slope (never downwards).
  const last = withPower.at(-1)!;
  const previous = withPower.at(-2)!;
  const slope =
    last.powerPct === previous.powerPct
      ? 0
      : (last.fuelFlowLph - previous.fuelFlowLph) /
        (last.powerPct - previous.powerPct);
  return last.fuelFlowLph + Math.max(0, slope) * (powerPct - last.powerPct);
}

/** Temperature at another altitude with the planner's 2 °C/1000 ft lapse (never warmer above). */
export const lapseTemperatureC = (
  surfaceC: number,
  surfaceFt: number,
  altitudeFt: number,
) => surfaceC - Math.max(0, altitudeFt - surfaceFt) * 0.002;

export function fuelFlowAtPower(
  cruise: Cruise,
  pressureAltitudeFt: number,
  oatC: number,
  powerPct: number,
): number | null {
  if (
    cruise.maximumLeanPowerPct !== undefined &&
    powerPct > cruise.maximumLeanPowerPct
  )
    return null;
  const alt = bracket(altitudes(cruise), pressureAltitudeFt);
  const at = (altitudeFt: number) => {
    const t = lapseTemperatureC(oatC, pressureAltitudeFt, altitudeFt);
    return flowAtPowerAt(
      entriesAt(cruise, altitudeFt, t - isaTemperatureC(altitudeFt)),
      powerPct,
    );
  };
  const lower = at(alt.lower);
  const upper = at(alt.upper);
  return lower === null || upper === null
    ? null
    : lerp(lower, upper, alt.ratio);
}

const nearest = (values: number[], target: number) =>
  values.reduce((best, v) =>
    Math.abs(v - target) < Math.abs(best - target) ? v : best,
  );

/**
 * Legacy getCruiseTableReadForTable ("table data" / "for table"): the nearest tabulated altitude
 * and ISA deviation, no interpolation.
 */
export function cruiseTableRead(
  cruise: Cruise,
  pressureAltitudeFt: number,
  oatC: number,
  windComponentKt: number,
  mode: CruiseMode | ManualSetting,
) {
  if (!cruise.rows.length) return null;
  const altitude = nearest(altitudes(cruise), pressureAltitudeFt);
  const isaDeltaC = nearest(
    [...new Set(cruise.rows.map((r) => r.isaDeltaC))],
    oatC - isaTemperatureC(altitude),
  );
  const entry = pick(
    cruise.rows
      .filter(
        (r) => r.pressureAltitudeFt === altitude && r.isaDeltaC === isaDeltaC,
      )
      .map((r) => ({
        setting: r.setting,
        ktas: r.ktas,
        fuelFlowLph: r.fuelFlowLph,
        powerPct: r.powerPct,
      })),
    mode,
    windComponentKt,
    cruise.maximumLeanPowerPct,
  );
  return entry
    ? {
        ...entry,
        groundSpeedKt: entry.ktas + windComponentKt,
        pressureAltitudeFt: altitude,
        isaDeltaC,
      }
    : null;
}
