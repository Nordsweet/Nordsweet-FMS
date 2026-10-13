import fs from "node:fs";
import { expect, test } from "vitest";
import { z } from "zod";
import { positionAgeAlpha } from "~/domain/map-navigation";
import { parseOpenAir } from "~/domain/openair";
import { currentCallsignHistory } from "~/domain/traffic-history";

const sample = z.object({
  lat: z.number(),
  lon: z.number(),
  sampledAt: z.number(),
  callsign: z.string(),
});
const fixture = z
  .object({
    sourceCommit: z.string(),
    ages: z.array(z.number()),
    alpha: z.array(z.number()),
    history: z.object({
      remote: z.array(sample),
      local: z.array(sample),
      expected: z.array(sample),
    }),
    openair: z.object({
      input: z.string(),
      expected: z.array(z.object({ lat: z.number(), lon: z.number() })),
    }),
  })
  .parse(
    JSON.parse(
      fs.readFileSync("tests/fixtures/legacy-map.json", "utf8"),
    ) as unknown,
  );
test("legacy map fade, current-flight trace and OpenAir polygon outputs are preserved", () => {
  expect(fixture.ages.map(positionAgeAlpha)).toEqual(fixture.alpha);
  expect(
    currentCallsignHistory(
      fixture.history.remote,
      fixture.history.local,
      "NEW",
    ),
  ).toEqual(fixture.history.expected);
  expect(parseOpenAir(fixture.openair.input)[0]!.ring.slice(0, -1)).toEqual(
    fixture.openair.expected.map((p) => [p.lon, p.lat]),
  );
});
