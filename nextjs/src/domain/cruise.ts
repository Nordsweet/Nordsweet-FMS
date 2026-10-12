import { type Cruise } from "~/data/aircraft";

export type CruiseOption = {
  setting: string;
  powerPct: number | null;
  ktas: number;
  fuelFlowLph: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Power settings from the POH cruise table at the tabulated altitude nearest `pressureAltitudeFt`,
 * interpolated for the ISA deviation (clamped to the tabulated range, which is then flagged).
 * Settings change with altitude (full-throttle MAP), so altitudes are not interpolated.
 */
export function cruiseOptions(
  cruise: Cruise,
  pressureAltitudeFt: number,
  isaDeviationC: number,
) {
  const altitudes = [...new Set(cruise.rows.map((r) => r.pressureAltitudeFt))];
  const tableAltitudeFt = altitudes.reduce((best, a) =>
    Math.abs(a - pressureAltitudeFt) < Math.abs(best - pressureAltitudeFt)
      ? a
      : best,
  );
  const bySetting = new Map<string, Cruise["rows"]>();
  for (const row of cruise.rows.filter(
    (r) => r.pressureAltitudeFt === tableAltitudeFt,
  )) {
    bySetting.set(row.setting, [...(bySetting.get(row.setting) ?? []), row]);
  }
  let outsideIsaRange = false;
  const options: CruiseOption[] = [...bySetting.entries()].map(
    ([setting, rows]) => {
      const pts = [...rows].sort((a, b) => a.isaDeltaC - b.isaDeltaC);
      const lo =
        [...pts].reverse().find((p) => p.isaDeltaC <= isaDeviationC) ?? pts[0]!;
      const hi = pts.find((p) => p.isaDeltaC >= isaDeviationC) ?? pts.at(-1)!;
      if (
        isaDeviationC < pts[0]!.isaDeltaC - 5 ||
        isaDeviationC > pts.at(-1)!.isaDeltaC + 5
      )
        outsideIsaRange = true;
      const t =
        hi.isaDeltaC === lo.isaDeltaC
          ? 0
          : (isaDeviationC - lo.isaDeltaC) / (hi.isaDeltaC - lo.isaDeltaC);
      return {
        setting,
        powerPct:
          lo.powerPct === null || hi.powerPct === null
            ? null
            : lerp(lo.powerPct, hi.powerPct, t),
        ktas: lerp(lo.ktas, hi.ktas, t),
        fuelFlowLph: lerp(lo.fuelFlowLph, hi.fuelFlowLph, t),
      };
    },
  );
  options.sort((a, b) => b.fuelFlowLph - a.fuelFlowLph);
  return { tableAltitudeFt, options, outsideIsaRange };
}
