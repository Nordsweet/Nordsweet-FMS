// Route data exactly as the legacy planner merges it → public/data/procedures.json + airways.json.
// Legacy loads procedures only from the waypoint package (Waypoints/Poland.js), not
// procedure-data.js, and airways from navdata.js. Run from nextjs/ after extract-main.sh:
//   node scripts/legacy/import-route-data.cjs
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load } = require("./legacy-functions.cjs");

const ctx = load(
  [
    "cleanAtisValue",
    "clonePlainData",
    "getPlannerWaypointDataPackages",
    "normalizePlannerWaypointName",
    "normalizePlannerWaypointGroup",
    "normalizePlannerWaypointReference",
    "isPlannerRunwayWaypointId",
    "getPlannerGroupedWaypointKey",
    "normalizePlannerProcedureWaypointReference",
    "mergePlannerNavDataSources",
    "parseWaypointProcedureAltitude",
    "parseWaypointProcedureSpeed",
    "enrichWaypointPackageProcedureLeg",
    "normalizeWaypointPackageProcedure",
    "normalizeProcedureId",
    "getPlannerProcedureMergeKey",
    "mergePlannerProcedureList",
    "mergePlannerProcedureDataSources",
  ],
  { publicFiles: ["navdata.js", "Waypoints/Poland.js"] },
);
const { navdata, procedures } = vm.runInContext(
  `({ navdata: mergePlannerNavDataSources(window.NORDSWEET_NAVDATA, getPlannerWaypointDataPackages()),
      procedures: mergePlannerProcedureDataSources({}, getPlannerWaypointDataPackages()) })`,
  ctx,
);

const num = (v) =>
  Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null;
const altitudeTypes = {
  exact: "exact",
  atorabove: "atOrAbove",
  atorbelow: "atOrBelow",
};
const out = [];
for (const [airport, sets] of Object.entries(procedures.airports))
  for (const p of [...sets.sids, ...sets.stars, ...sets.approaches])
    out.push({
      airport,
      type: p.type,
      id: p.id,
      designator: p.designator,
      runways: p.runways,
      legs: p.legs.map((l) => ({
        ident: l.waypoint,
        // null stays null: legacy then looks the fix up by name (and skips the procedure if unknown).
        lat: l.lat == null ? null : Number(l.lat),
        lon: l.lon == null ? null : Number(l.lon),
        altitude: l.altitude
          ? {
              raw: String(l.altitude.raw ?? l.altitude.value ?? ""),
              type:
                altitudeTypes[String(l.altitude.type ?? "").toLowerCase()] ??
                "exact",
            }
          : null,
        speedKt: num(l.speedKt),
        trackMagDeg: num(l.trackMag),
        distanceNm: num(l.distanceNm),
      })),
      source: p.title ?? p.sourcePackage ?? "Waypoints",
    });

const dataDir = path.resolve(__dirname, "../../public/data");
fs.writeFileSync(path.join(dataDir, "procedures.json"), JSON.stringify(out));
fs.writeFileSync(
  path.join(dataDir, "airways.json"),
  JSON.stringify(navdata.airways),
);
const count = (t) => out.filter((p) => p.type === t).length;
console.log(
  `procedures: ${count("SID")} SID, ${count("STAR")} STAR, ${count("APPROACH")} APPROACH; airways: ${Object.keys(navdata.airways).length}`,
);
