import { expect, test } from "vitest";
import {
  airspaceCaption,
  airspaceCaptionFits,
  airspaceCaptionPlacement,
} from "./airspace-labels";
const square = [
  [
    [0, 0],
    [200, 0],
    [200, 100],
    [0, 100],
    [0, 0],
  ],
];
test("separates the published class/number from the full name", () => {
  expect(airspaceCaption("R 11 Gorczański Park Narodowy", "R")).toEqual({
    title: "R 11",
    name: "Gorczański Park Narodowy",
  });
  expect(airspaceCaption("P 23", "P")).toEqual({ title: "P 23", name: "" });
  expect(airspaceCaption("EPTR0165 Trening", "G")).toEqual({
    title: "TR 165",
    name: "Trening",
  });
  expect(airspaceCaption("TMA EPKK B", "C")).toEqual({
    title: "TMA EPKK B",
    name: "",
  });
  expect(airspaceCaption("FIS KRAKOW W", "G")).toEqual({
    title: "FIS",
    name: "KRAKOW W",
  });
});
test("centers the two-line caption when it fits and falls back to the designator otherwise", () => {
  expect(airspaceCaptionPlacement(square, 100, true)).toEqual({
    x: 100,
    y: 50,
    fullName: true,
  });
  expect(airspaceCaptionPlacement(square, 220, true)).toEqual({
    x: 100,
    y: 50,
    fullName: false,
  });
  expect(airspaceCaptionPlacement(square, 100, false)).toEqual({
    x: 100,
    y: 50,
    fullName: false,
  });
});
test("rejects text that crosses a hole even if all rectangle corners are inside", () => {
  const hole = [
    [90, 45],
    [110, 45],
    [110, 55],
    [90, 55],
    [90, 45],
  ];
  expect(
    airspaceCaptionFits([...square, hole], { x: 100, y: 50 }, 100, 30),
  ).toBe(false);
});
test("rejects concave boundaries through the text rectangle", () => {
  const notch = [
    [
      [0, 0],
      [200, 0],
      [200, 100],
      [110, 100],
      [110, 40],
      [90, 40],
      [90, 100],
      [0, 100],
      [0, 0],
    ],
  ];
  expect(airspaceCaptionFits(notch, { x: 100, y: 35 }, 100, 30)).toBe(false);
  const placement = airspaceCaptionPlacement(notch, 50, true)!;
  expect(placement.fullName).toBe(true);
  expect(airspaceCaptionFits(notch, placement, 50, 26)).toBe(true);
});
