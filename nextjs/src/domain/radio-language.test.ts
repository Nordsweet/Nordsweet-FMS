import { expect, test } from "vitest";
import { radioLanguage } from "./radio-language";

test.each([
  ["LZCTR TATRY", "sk"],
  ["Bratislava Information / East", "sk"],
  ["Tatry-Tower", "sk"],
  ["LZTT", "sk"],
  ["Žilina RDO", "sk"],
  ["LKMT", "cs"],
  ["Prague Information", "cs"],
  ["EDAH", "de"],
  ["LOVV", "de"],
  ["Langen Information", "de"],
  ["München Information", "de"],
  ["EYVI", "lt"],
  ["Vilnius Information", "lt"],
  ["Nowy Targ Radio", null],
  ["Kraków Information", null],
  ["EPKK", null],
  ["Loading frequencies", null],
  ["Tower", null],
])(
  "recognizes local guide for %s without guessing from generic service names",
  (name, expected) => {
    expect(radioLanguage(name)).toBe(expected);
  },
);

test("airport context identifies a generic foreign callsign and keeps Polish aerodromes Polish", () => {
  expect(radioLanguage("EDAH", "Tower")).toBe("de");
  expect(radioLanguage("EPKK", "Bratislava Information")).toBeNull();
});
