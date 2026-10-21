import { expect, it } from "vitest";

import { canonical, mergeFields, mergeRecords } from "./merge";

it("compares independent of key order, as the server's jsonb does not keep it", () => {
  expect(canonical({ a: 1, b: { c: [1, 2], d: null } })).toBe(
    canonical({ b: { d: null, c: [1, 2] }, a: 1 }),
  );
  expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
});

it("takes the side that changed, and the preferred side when both did", () => {
  const base = { a: 1, b: 1, c: 1 };
  const local = { a: 2, b: 1, c: 5 };
  const remote = { a: 1, b: 3, c: 6 };
  expect(mergeFields(base, local, remote, "local")).toEqual({
    a: 2,
    b: 3,
    c: 5,
  });
  expect(mergeFields(base, local, remote, "remote")).toEqual({
    a: 2,
    b: 3,
    c: 6,
  });
});

it("without a base the remote is adopted, or every difference goes to the preferred side", () => {
  expect(mergeFields(null, { a: 1, x: 1 }, { a: 2 }, "local", true)).toEqual({
    a: 2,
  });
  expect(mergeFields(null, { a: 1, x: 1 }, { a: 2, y: 2 }, "local")).toEqual({
    a: 1,
    x: 1,
    y: 2,
  });
});

it("a conflicting null is a value: the preferred side keeps it", () => {
  expect(mergeFields({ w: 80 }, { w: null }, { w: 90 }, "local")).toEqual({
    w: null,
  });
  expect(mergeFields({ w: 80 }, { w: null }, { w: 90 }, "remote")).toEqual({
    w: 90,
  });
});

it("a field removed on one side is gone unless the other side edited it", () => {
  expect(
    mergeFields({ a: 1, b: 1 }, { a: 1 }, { a: 1, b: 1 }, "local"),
  ).toEqual({ a: 1 });
  expect(
    mergeFields({ a: 1, b: 1 }, { a: 1 }, { a: 1, b: 2 }, "local"),
  ).toEqual({ a: 1, b: 2 });
  expect(
    mergeFields({ a: 1, b: 1 }, { a: 1, b: 2 }, { a: 1 }, "remote"),
  ).toEqual({ a: 1, b: 2 });
});

it("merges records entry by entry with a resolver for entries both sides changed", () => {
  const base = { x: 1, y: 1 };
  const merged = mergeRecords(
    base,
    { x: 2, y: 1, z: 9 },
    { x: 3, y: 4 },
    (l, r) => Math.max(l, r),
  );
  expect(merged).toEqual({ x: 3, y: 4, z: 9 });
});
