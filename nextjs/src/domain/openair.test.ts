import { expect, test } from "vitest";
import { parseOpenAir } from "./openair";
import { distanceNm } from "./geo";

test("OpenAir polygon and circles keep labels and limits", () => {
  const [polygon, circle] = parseOpenAir(
    "AC D\nAN TEST CTR\nAL GND\nAH FL095\nDP 50:00:00 N 019:00:00 E\nDP 50:30:00 N 019:00:00 E\nDP 50:00:00 N 019:30:00 E\nAC R\nAN CIRCLE\nAL SFC\nAH 3000 FT\nV X=50:00:00 N 019:00:00 E\nDC 3",
  );
  expect(polygon?.ring).toEqual([
    [19, 50],
    [19, 50.5],
    [19.5, 50],
    [19, 50],
  ]);
  expect(polygon?.upper).toBe("FL095");
  for (const [lon, lat] of circle!.ring)
    expect(distanceNm({ lat: 50, lon: 19 }, { lat, lon })).toBeCloseTo(3, 5);
});

test("bad geometry fails rather than importing a partial restriction", () => {
  expect(() => parseOpenAir("AC R\nDP 99:00:00 N 019:00:00 E")).toThrow();
  expect(() =>
    parseOpenAir("AC R\nV X=50:00:00 N 019:00:00 E\nDB bad"),
  ).toThrow();
});

test("CUP coordinates remain supported in local OpenAir files", () => {
  const [zone] = parseOpenAir(
    "AC R\nAN CUP\nDP 5000.000N 01900.000E\nDP 5030.000N 01900.000E\nDP 5000.000N 01930.000E",
  );
  expect(zone?.ring[0]).toEqual([19, 50]);
  expect(zone?.ring[1]).toEqual([19, 50.5]);
});
