export type Obj = Record<string, unknown>;

/** Key-order independent JSON (the server stores jsonb, which does not keep key order). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/**
 * Three-way merge of one value: a side that still equals `base` yields to the other; when both
 * changed it, `onConflict` decides. Without a base (never synced) every difference is a conflict.
 */
export function merge3<T>(
  base: T | undefined,
  local: T | undefined,
  remote: T | undefined,
  hasBase: boolean,
  onConflict: (local: T | undefined, remote: T | undefined) => T | undefined,
): T | undefined {
  if (same(local, remote)) return local;
  if (hasBase && same(base, local)) return remote;
  if (hasBase && same(base, remote)) return local;
  return onConflict(local, remote);
}

/** Per top-level field. Conflicts go to `prefer`; with no base the remote wins when `adopt` is set. */
export function mergeFields(
  base: Obj | null,
  local: Obj,
  remote: Obj,
  prefer: "local" | "remote",
  adopt = false,
): Obj {
  if (!base && adopt) return remote;
  const merged: Obj = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const value = merge3(
      base?.[key],
      local[key],
      remote[key],
      base !== null,
      // A field only one side has is kept: a conflict never drops data.
      (l, r) => {
        const [first, second] = prefer === "local" ? [l, r] : [r, l];
        return first === undefined ? second : first; // null is a value, not a gap
      },
    );
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/** Per entry of a keyed record, with `resolve` for an entry both sides changed. */
export function mergeRecords<T>(
  base: Record<string, T> | null,
  local: Record<string, T>,
  remote: Record<string, T>,
  resolve: (local: T, remote: T) => T,
): Record<string, T> {
  const merged: Record<string, T> = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const value = merge3(
      base?.[key],
      local[key],
      remote[key],
      base !== null,
      (l, r) => (l === undefined ? r : r === undefined ? l : resolve(l, r)),
    );
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}
