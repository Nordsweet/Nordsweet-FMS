// Legacy P2006T climb tables (flaps × Vx/Vy × engines) → public/data/aircraft.json `climbTables`.
// Same grid as `climb`: weight → pressure altitude → temperature, with the POH ISA column as a point.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { legacyDir } = require("./legacy-functions.cjs");

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(
    path.join(legacyDir, "nextjs/public/aircraft-data/p2006t-performance.js"),
    "utf8",
  ),
  ctx,
);
const perf = ctx.P2006T_PERFORMANCE;

function convert(table, flaps, profile, engines) {
  const weights = Object.keys(table.weightsKg)
    .map(Number)
    .sort((a, b) => a - b);
  return {
    flaps,
    profile,
    engines,
    speedLabel: table.speedLabel,
    powerSetting: table.powerSetting,
    flapsLabel: table.flaps,
    landingGear: table.landingGear,
    source: `Legacy p2006t-performance.js: ${table.source}`,
    grid: {
      axis: "weightKg",
      points: weights.map((w) => {
        const t = table.weightsKg[w];
        return {
          at: w,
          next: {
            axis: "pressureAltitudeFt",
            points: table.pressureAltitudesFt.map((alt, i) => {
              const iasKt = t[table.speedKey][i];
              const temps = table.temperaturesC.map((c, j) => ({
                at: c,
                next: { rateFpm: t.rateOfClimbFpm[i][j], iasKt },
              }));
              const isa = t.isaReference?.rateOfClimbFpm?.[i];
              if (Number.isFinite(isa))
                temps.push({
                  at: 15 - (2 * alt) / 1000,
                  next: { rateFpm: isa, iasKt },
                });
              return {
                at: alt,
                next: {
                  axis: "temperatureC",
                  points: temps.sort((a, b) => a.at - b.at),
                },
              };
            }),
          },
        };
      }),
    },
  };
}

const file = path.join(__dirname, "../../public/data/aircraft.json");
const aircraft = JSON.parse(fs.readFileSync(file, "utf8"));
const p2006t = aircraft.find((a) => a.id === "P2006T");
delete p2006t.emergencyClimb;
p2006t.climbTables = [
  convert(perf.climb, "takeoff", "vy", "both"),
  convert(perf.climbVx, "takeoff", "vx", "both"),
  convert(perf.climbFlapsUpVy, "up", "vy", "both"),
  convert(perf.climbFlapsUpVx, "up", "vx", "both"),
  convert(perf.climbOneEngineInopVy, "up", "vy", "one-inop"),
  convert(perf.climbOneEngineInopVx, "up", "vx", "one-inop"),
];
fs.writeFileSync(file, JSON.stringify(aircraft));
console.log("P2006T climbTables:", p2006t.climbTables.length);
