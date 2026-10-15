import { describe, expect, it } from "vitest";

import { airspacePalette } from "~/domain/airspace-style";
import { cssColor } from "~/features/map/deck/color";

describe("cssColor", () => {
  it("parses hex and rgba like the CSS the palette was written in", () => {
    expect(cssColor("#126cac")).toEqual([18, 108, 172, 255]);
    expect(cssColor("rgba(255, 156, 45, 0.13)")).toEqual([255, 156, 45, 33]);
    expect(cssColor("rgba(221,54,84,.22)")).toEqual([221, 54, 84, 56]);
  });

  it("scales the alpha by an extra opacity", () => {
    expect(cssColor("rgba(18, 108, 172, 0.5)", 0.5)).toEqual([
      18, 108, 172, 64,
    ]);
    expect(cssColor("#ffffff", 0.5)[3]).toBe(128);
  });

  it("understands every colour in the airspace palette", () => {
    for (const style of Object.values(airspacePalette)) {
      expect(() => cssColor(style.stroke)).not.toThrow();
      expect(() => cssColor(style.fill)).not.toThrow();
    }
  });

  it("rejects what it cannot read instead of drawing black", () => {
    expect(() => cssColor("red")).toThrow();
  });
});
