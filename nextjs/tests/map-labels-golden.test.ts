import fs from "node:fs";
import { z } from "zod";
import { expect, test } from "vitest";
import { airportSchema } from "~/data/schemas";
import { airportChartLabel, mapLabelVisibility } from "~/domain/map-labels";

const fixture = z
  .object({
    sourceCommit: z.string(),
    cases: z.array(
      z.object({
        zoom: z.number(),
        enabled: z.boolean(),
        pointNames: z.boolean(),
        airport: airportSchema.pick({
          ident: true,
          name: true,
          isIcao: true,
          elevationFt: true,
          runways: true,
        }),
        expected: z
          .object({ title: z.string(), details: z.string() })
          .nullable(),
      }),
    ),
    traffic: z.array(
      z.object({ span: z.number(), enabled: z.boolean(), shown: z.boolean() }),
    ),
  })
  .parse(
    JSON.parse(
      fs.readFileSync("tests/fixtures/legacy-map-labels.json", "utf8"),
    ) as unknown,
  );

test("airport and point labels match legacy canvas output around both zoom thresholds", () => {
  for (const row of fixture.cases) {
    const visibility = mapLabelVisibility(row.zoom - 1, row.enabled);
    expect(
      airportChartLabel(row.airport, visibility),
      JSON.stringify({
        zoom: row.zoom,
        enabled: row.enabled,
        airport: row.airport.ident,
        name: row.airport.name,
      }),
    ).toEqual(row.expected);
    expect(visibility.pointNames).toBe(row.pointNames);
    expect(visibility.airspaceNames).toBe(row.enabled && row.zoom >= 9);
    expect(visibility.airspaceFullNames).toBe(row.enabled && row.zoom >= 10);
  }
});

test("traffic labels use the point-name zoom threshold and keep their independent Labels preference", () => {
  for (const zoom of [5, 7.999, 8, 8.001, 9]) {
    const visible = mapLabelVisibility(zoom, true);
    expect(visible.trafficNames).toBe(visible.pointNames);
    expect(visible.trafficNames).toBe(zoom >= 8);
    expect(mapLabelVisibility(zoom, false).trafficNames).toBe(zoom >= 8);
  }
});
