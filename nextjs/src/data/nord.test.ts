import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { flightSchema } from "./flight";
import { parseNordFile, toNordFile } from "./nord";

const ids = ["P2006T", "R172K", "C152-SPRBB", "A-1A-HUSKY"];
const files = ["tests/fixtures/nord"].flatMap((dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".nord"))
    .map((f) => path.join(dir, f)),
);

describe(".nord files", () => {
  it.each(files)("imports %s", (file) => {
    const { flight } = parseNordFile(fs.readFileSync(file, "utf8"), ids);
    expect(() => flightSchema.parse(flight)).not.toThrow();
    expect(
      flight.waypoints.some((p) => p.ident === "TOC" || p.ident === "TOD"),
    ).toBe(false);
  });

  it("maps fields of a saved flight", () => {
    const { flight } = parseNordFile(
      fs.readFileSync("tests/fixtures/nord/P2006T0508261012.nord", "utf8"),
      ids,
    );
    expect(flight).toMatchObject({
      aircraftId: "P2006T",
      departure: { ident: "EPNT" },
      destination: { ident: "EPML" },
      cruiseAltitudeFt: 5000,
      cruiseTasKt: 86,
    });
    // The legacy route is its text; the map-inserted waypoints list is empty.
    expect(flight.routeText).toBe("epnta epmlr epmls");
    expect(flight.waypoints).toEqual([]);
  });

  it("imports a local flight stored as one point", () => {
    const { flight } = parseNordFile(
      fs.readFileSync("tests/fixtures/nord/R172K2706261444.nord", "utf8"),
      ids,
    );
    expect(flight.departure).toEqual(flight.destination);
    expect(flight.waypoints).toEqual([]);
  });

  it("round-trips through export", () => {
    const { flight } = parseNordFile(
      fs.readFileSync("tests/fixtures/nord/P2006T0508261012.nord", "utf8"),
      ids,
    );
    const again = parseNordFile(toNordFile(flight, "P2006T"), ids).flight;
    expect(again).toMatchObject({
      ...flight,
      fuel: again.fuel,
      stationsKg: again.stationsKg,
    });
  });

  it("rejects files without route points", () => {
    expect(() =>
      parseNordFile(
        JSON.stringify({ format: "nordsweet.flight", version: 1, route: {} }),
        ids,
      ),
    ).toThrow();
  });
});
