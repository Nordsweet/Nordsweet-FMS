import fs from "node:fs";
import { expect, test } from "vitest";
import { datasetSchemas } from "~/data/schemas";
import { searchNavpoints } from "~/api/search";

const points = datasetSchemas.navpoints.parse(
  JSON.parse(fs.readFileSync("public/data/navpoints.json", "utf8")),
);
const croatia = points.filter((p) =>
  p.source.startsWith("Croatia Control VFR Manual ENR 4.4"),
);

test("all 84 published Croatian VFR identifiers are unique, searchable and unassigned to airports", () => {
  const ids =
    `A1 A2 A3 B1 B2 B3 C1 C2 C3 D1 D2 D3 E1 E2 E3 E4 E5 E6 E7 F1 F2 G1 G2 H1 H2 H3 H4 I2 J1 K1 K2 K3 K4 K5 KONAS L1 L3 L4 L6 L7 M1 MAZEV N1 N2 N3 N4 N5 N6 O1 O2 O3 P1 P2 P3 P4 P5 PEPIM R1 RORKA S1 S2 S3 S4 S5 S7 S8 T1 U1 USELU V1 V2 V3 V4 VE VN VS VW W1 W2 W3 W4 W5 W6 Z1`.split(
      " ",
    );
  expect(croatia.map((p) => p.ident).sort()).toEqual(ids.sort());
  for (const point of croatia) {
    expect(points.filter((p) => p.ident === point.ident)).toHaveLength(1);
    expect(point.kind).toBe("vfr-reporting-point");
    expect(point.airport).toBeNull();
    expect(searchNavpoints(points, point.ident)[0]).toEqual(point);
  }
});

test("coordinates and non-NIL remarks match both columns and pages of ENR 4.4", () => {
  for (const [ident, lat, lon] of [
    ["A1", 45 + 32 / 60 + 43 / 3600, 18 + 17 / 60 + 9 / 3600],
    ["D2", 42 + 18 / 60 + 18 / 3600, 18 + 14 / 60 + 31 / 3600],
    ["K1", 45 + 1 / 60 + 34 / 3600, 14 + 34 / 60 + 32 / 3600],
    ["L7", 45 + 46 / 60 + 46 / 3600, 15 + 56 / 60 + 6 / 3600],
    ["I2", 44 + 11 / 60 + 10 / 3600, 15 + 26 / 60 + 30 / 3600],
    ["R1", 44 + 9 / 60 + 18 / 3600, 15 + 2 / 60 + 4 / 3600],
    ["VN", 46 + 22 / 60 + 35 / 3600, 16 + 23 / 60 + 6 / 3600],
    ["Z1", 43 + 55 / 60 + 46 / 3600, 15 + 48 / 60 + 8 / 3600],
  ] as const) {
    const point = croatia.find((p) => p.ident === ident)!;
    expect(point.lat).toBeCloseTo(lat, 7);
    expect(point.lon).toBeCloseTo(lon, 7);
  }
  expect(croatia.find((p) => p.ident === "I2")?.description).toBe(
    "Islam Latinski",
  );
  expect(croatia.find((p) => p.ident === "L7")?.description).toBe(
    "Islet of Love - Jarun Lake",
  );
});
