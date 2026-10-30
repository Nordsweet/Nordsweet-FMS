import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.hoisted(() => new Map<string, string>());
vi.stubGlobal("localStorage", {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, value),
  removeItem: (key: string) => void values.delete(key),
});
vi.stubGlobal("window", {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});

import { readCustomDrafts, writeCustomDrafts } from "../aircraft";
import { customAircraft } from "./adapters";

beforeEach(() => values.clear());

const draft = (type: string, extra: object = {}) =>
  ({ baseId: null, type, ...extra }) as never;

describe("custom aircraft", () => {
  it("gives every draft the id the server stores it under, and keeps it", () => {
    writeCustomDrafts([draft("A"), draft("B")]);
    const [a, b] = readCustomDrafts();
    expect(a!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(b!.id).not.toBe(a!.id);
    writeCustomDrafts([{ ...a!, displayName: "Edited" }, b!]);
    expect(readCustomDrafts().map((d) => d.id)).toEqual([a!.id, b!.id]);
  });

  it("mints ids for drafts saved before the server had per-aircraft rows", () => {
    values.set(
      "nordsweet.customAircraft.v1",
      JSON.stringify([{ baseId: null, type: "Old" }]),
    );
    const [old] = readCustomDrafts();
    expect(old!.id).toBeTruthy();
    expect(readCustomDrafts()[0]!.id).toBe(old!.id); // stored, not re-minted
  });

  it("is one item per aircraft: put adds or replaces by id, remove deletes only that one", async () => {
    writeCustomDrafts([draft("A")]);
    const [a] = readCustomDrafts();
    expect(await customAircraft.ids()).toEqual([a!.id]);

    await customAircraft.put("11111111-1111-4111-8111-111111111111", {
      baseId: null,
      type: "From another device",
    });
    expect(await customAircraft.ids()).toHaveLength(2);

    await customAircraft.put(a!.id!, { ...a!, displayName: "Renamed" });
    expect(await customAircraft.ids()).toHaveLength(2);
    expect(await customAircraft.get(a!.id!)).toMatchObject({
      displayName: "Renamed",
      id: a!.id,
    });

    await customAircraft.remove(a!.id!);
    expect(await customAircraft.ids()).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("adopts the server's copy of an aircraft this device never synced, then merges per field", () => {
    const local = { id: "x", type: "A", displayName: "Mine", n: 1 };
    const remote = { id: "x", type: "A", displayName: "Theirs", n: 1 };
    expect(customAircraft.merge(null, local, remote)).toEqual(remote);
    const base = { id: "x", type: "A", displayName: "Old", n: 1 };
    expect(customAircraft.merge(base, local, { ...remote, n: 2 })).toEqual({
      id: "x",
      type: "A",
      displayName: "Mine",
      n: 2,
    });
  });

  it("refuses data that is not an aircraft", () => {
    expect(customAircraft.parse({ displayName: "no type" }, 1)).toBeNull();
  });
});
