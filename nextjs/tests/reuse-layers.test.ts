import { expect, test } from "vitest";
import { type Layer } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { reuseLayers } from "~/features/map/deck/reuse-layers";

const dots = (data: [number, number][], color = [1, 2, 3]) =>
  new ScatterplotLayer<[number, number]>({
    id: "dots",
    data,
    getPosition: (d) => d,
    getFillColor: color as [number, number, number],
  });

test("a rebuilt layer that draws the same thing is replaced by the one deck.gl has", () => {
  const shown = new Map<string, Layer>();
  const first = reuseLayers(shown, [dots([[1, 2]])])[0];
  // New array, new accessor, same content.
  expect(reuseLayers(shown, [dots([[1, 2]])])[0]).toBe(first);
});

test("changed data or settings give a new layer", () => {
  const shown = new Map<string, Layer>();
  const first = reuseLayers(shown, [dots([[1, 2]])])[0];
  const moved = reuseLayers(shown, [dots([[1, 3]])])[0];
  expect(moved).not.toBe(first);
  expect(reuseLayers(shown, [dots([[1, 3]], [9, 9, 9])])[0]).not.toBe(moved);
});

test("a layer that is no longer in the stack is forgotten", () => {
  const shown = new Map<string, Layer>();
  reuseLayers(shown, [dots([[1, 2]])]);
  reuseLayers(shown, []);
  expect(shown.size).toBe(0);
});
