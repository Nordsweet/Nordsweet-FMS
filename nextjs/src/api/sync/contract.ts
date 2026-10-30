import { z } from "zod";

/** Collections of the Aviation API `/sync` store (docs/API.md, "Sync"). */
export const COLLECTIONS = [
  "settings",
  "aircraft-state",
  "custom-aircraft",
  "draft",
  "flights",
  "live-flight",
] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const MAX_ITEM_BYTES = 1024 * 1024;

export const syncItemSchema = z.object({
  collection: z.string(),
  id: z.string(),
  rev: z.number().int(),
  schema_version: z.number().int(),
  deleted: z.boolean(),
  updated_at: z.string(),
  device_id: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  seq: z.number().int(),
});
export type SyncItem = z.infer<typeof syncItemSchema>;

export const changesSchema = z.object({
  items: z.array(syncItemSchema),
  cursor: z.number().int(),
  has_more: z.boolean(),
});
export const putResultSchema = z.object({
  rev: z.number().int(),
  updated_at: z.string(),
  seq: z.number().int(),
});
export const conflictSchema = z.object({
  detail: z.object({
    message: z.string(),
    current: syncItemSchema.nullable(),
  }),
});
export const hintSchema = z.object({
  collection: z.string(),
  id: z.string(),
  rev: z.number().int(),
  seq: z.number().int(),
  device_id: z.string(),
});
export type SyncHint = z.infer<typeof hintSchema>;

/** A sync call that the server (or the network) refused; `status` 0 means no response. */
export class SyncError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterS: number | null = null,
    /** 409 only: the server's current item, `null` when it does not exist. */
    readonly current: SyncItem | null = null,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

/** `/sync` cursors are numbers; the typed user-data routes hand out opaque strings that are only echoed back. */
export type Cursor = number | string;

/** The calls the engine needs; the real one talks HTTP, tests use an in-memory server. */
export type SyncApi = {
  changes: (
    since: Cursor,
    limit?: number,
  ) => Promise<{ items: SyncItem[]; cursor: Cursor; has_more: boolean }>;
  put: (
    collection: string,
    id: string,
    body: {
      data: Record<string, unknown>;
      schemaVersion: number;
      baseRev: number;
    },
  ) => Promise<z.infer<typeof putResultSchema>>;
  remove: (collection: string, id: string, baseRev: number) => Promise<void>;
  /** Resolves when the stream ends; throws SyncError or a network error. */
  stream: (
    signal: AbortSignal,
    onHint: (hint: SyncHint) => void,
  ) => Promise<void>;
};
