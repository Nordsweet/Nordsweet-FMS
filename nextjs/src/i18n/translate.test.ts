import { describe, expect, it } from "vitest";

import { translate } from "./translate";

const devices = {
  one: "{count} urządzenie",
  few: "{count} urządzenia",
  many: "{count} urządzeń",
  other: "{count} urządzenia",
};

describe("translate", () => {
  it("picks the Polish plural form from count", () => {
    expect(
      [1, 2, 5, 12, 22, 25].map((count) =>
        translate("pl", devices, "k", { count }),
      ),
    ).toEqual([
      "1 urządzenie",
      "2 urządzenia",
      "5 urządzeń",
      "12 urządzeń",
      "22 urządzenia",
      "25 urządzeń",
    ]);
  });

  it("picks the English plural form and falls back to other", () => {
    const items = { one: "{count} item", other: "{count} items" };
    expect(translate("en", items, "k", { count: 1 })).toBe("1 item");
    expect(translate("en", items, "k", { count: 0 })).toBe("0 items");
    expect(translate("en", items, "k")).toBe("{count} items");
  });

  it("interpolates plain messages and shows a missing key", () => {
    expect(translate("en", "Hi {name}", "k", { name: "Ola" })).toBe("Hi Ola");
    expect(translate("en", undefined, "missing.key")).toBe("missing.key");
  });
});
