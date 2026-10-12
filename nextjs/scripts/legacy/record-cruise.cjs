// Example golden recorder: legacy cruise lookups → tests/fixtures/legacy-cruise.json.
// Copy this pattern for other calculations (fuel rows, W&B, procedures...).
const fs = require("fs");
const { load } = require("./legacy-functions.cjs");

const ctx = load(
  [
    "toNumber",
    "roundTo",
    "lerp",
    "getBracket",
    "getIsaTemperature",
    "getCruiseEngineCount",
    "getCruiseTotalFuelLphFromEntry",
    "lerpOptionalNumber",
    "interpolateCruiseSettingByTemperature",
    "getCruiseEntriesAtAltitude",
    "getCruiseRangeScore",
    "pickCruisePerformance",
    "getCruisePerformanceAtAltitude",
    "getCruiseSettingLabel",
    "getCruisePerformanceForTable",
    "interpolateCruiseFuelFlowByPower",
    "getCruiseFuelFlowAtPowerForTableAltitude",
    "getCruiseFuelFlowAtPower",
    "getFuelPlanningTemperatureAtAltitude",
    "getFr172hConvertedCruiseTable",
    "cleanAtisValue",
  ],
  {
    perfFiles: ["p2006t", "r172k", "fr172h", "husk", "sd4"],
    // Stubs for the globals those functions reach for.
    prelude: `var P2006T_CRUISE = window.P2006T_PERFORMANCE.cruise;
      var __perf = null; function getSelectedAircraftPerformanceData() { return __perf; }
      function interpolateCruiseByEngineSetting() { return null; }
      function getCruiseManualTarget() { return { rpm: 0, mapInHg: 0 }; }`,
  },
);
const vm = require("vm");
const tables = vm.runInContext(
  `({
  "P2006T": P2006T_PERFORMANCE.cruise,
  "R172K": R172K_PERFORMANCE.cruise,
  "FR172H": (__perf = FR172H_PERFORMANCE, getFr172hConvertedCruiseTable()),
  "A-1A-HUSKY": HUSK_PERFORMANCE.cruise,
  "SD-4": SD4_PERFORMANCE.cruise,
})`,
  ctx,
);
const cases = [];
for (const [id, table] of Object.entries(tables)) {
  for (let alt = -500; alt <= 13000; alt += 1100)
    for (const oat of [-15, 0, 15, 27, 40])
      for (const wind of [-25, 0, 18])
        for (const mode of ["eco-time", "eco-distance"]) {
          const r = ctx.getCruisePerformanceForTable(
            table,
            alt,
            oat,
            wind,
            mode,
            null,
          );
          cases.push({
            id,
            alt,
            oat,
            wind,
            mode,
            ktas: r ? r.ktas : null,
            fuel: r ? r.fuelTotalLph : null,
            pwr: r && Number.isFinite(r.pwrPct) ? r.pwrPct : null,
          });
        }
  for (let alt = 0; alt <= 12000; alt += 1300)
    for (const oat of [-5, 15, 30])
      for (const pct of [55, 75, 95]) {
        const r = ctx.getCruiseFuelFlowAtPower(table, alt, oat, pct);
        cases.push({ id, alt, oat, pct, flow: r ? r.fuelTotalLph : null });
      }
}
fs.writeFileSync("tests/fixtures/legacy-cruise.json", JSON.stringify(cases));
console.log(cases.length, "cases recorded");
