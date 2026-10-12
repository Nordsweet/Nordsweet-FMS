import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";

import { taxiRoute } from "./taxi";

const ground = datasetSchemas.ground.parse(
  JSON.parse(fs.readFileSync("public/data/ground.json", "utf8")),
);
const epkk = ground.find((g) => g.airport === "EPKK")!;

describe("taxiRoute", () => {
  it("routes EPKK stand 1 to holding point HP25 through taxiways", () => {
    const path = taxiRoute(epkk, "1", "HP25")!;
    expect(path[0]).toBe("1");
    expect(path.at(-1)).toBe("HP25");
    const types = new Map(epkk.elements.map((e) => [e.id, e.type]));
    expect(path.slice(1, -1).every((id) => types.get(id) === "taxiway")).toBe(
      true,
    );
  });

  it("returns null when the graph does not connect", () => {
    const epnt = ground.find((g) => g.airport === "EPNT")!;
    expect(taxiRoute(epnt, "1/MA", "HP30")).toBeNull();
  });

  it("finds the shortest of several routes", () => {
    const tiny = {
      airport: "TEST",
      elements: [],
      connections: { A: ["B", "C"], B: ["D"], C: ["E"], E: ["D"] },
      standExits: {},
    };
    expect(taxiRoute(tiny, "A", "D")).toEqual(["A", "B", "D"]);
  });
});
