import { z } from "zod";

export const chartCategories = [
  "information",
  "aerodrome",
  "parking",
  "sid",
  "star",
  "approach",
  "visual",
  "obstacle",
  "terrain",
  "other",
] as const;
export type ChartCategory = (typeof chartCategories)[number];
const volume = z.enum(["IFR", "VFR", "MIL"]);
const packageSchema = z.object({
  volume,
  effective_from: z.string(),
  effective_until: z.string(),
  source_url: z.string().url(),
  downloaded_at: z.string(),
});
export const aipCatalogSchema = z.object({
  packages: z.array(packageSchema),
  airports: z.array(
    z.object({
      icao: z.string(),
      name: z.string(),
      lat: z.number(),
      lon: z.number(),
      volume,
      source_url: z.string().url(),
    }),
  ),
  charts: z.array(
    z.object({
      id: z.string().regex(/^[a-f0-9]{64}$/),
      airport: z.string(),
      title: z.string(),
      category: z.enum(chartCategories),
      volume,
      source_url: z.string().url(),
      sha256: z.string(),
      bytes: z.number(),
      effective_from: z.string(),
      effective_until: z.string(),
    }),
  ),
});
const xy = z.object({
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  intersectionId: z.string().optional(),
});
export const chartOverlaySchema = z.object({
  chart: z
    .object({
      title: z.string().optional(),
      src: z.string(),
      aspectRatio: z.number().optional(),
    })
    .optional(),
  intersections: z
    .array(xy.extend({ id: z.string(), members: z.array(z.string()) }))
    .default([]),
  taxiwayPaths: z.record(z.string(), z.array(xy)).default({}),
});
export const chartLibrarySchema = z.object({
  revision: z.number(),
  ground: z.record(
    z.string(),
    z.object({ chartOverlay: chartOverlaySchema.optional() }),
  ),
  charts: z.array(z.object({ path: z.string(), revision: z.number() })),
  revisions: z.record(z.string(), z.number()),
});
export type AipCatalog = z.infer<typeof aipCatalogSchema>;
export type ChartOverlay = z.infer<typeof chartOverlaySchema>;
export type ChartLibrary = z.infer<typeof chartLibrarySchema>;

/** One selectable document; PDFs and generated NordCharts share the same browser/sequence. */
export type BrowserChart = {
  id: string;
  airport: string;
  title: string;
  category: ChartCategory;
  source: "aip" | "nord" | "library" | "local";
  volume?: "IFR" | "VFR" | "MIL";
  effectiveFrom?: string;
  effectiveUntil?: string;
  sourceUrl?: string;
  pdf?:
    | { kind: "aip"; id: string; sha256: string }
    | { kind: "library"; path: string; revision: number }
    | { kind: "bundled"; src: string };
  procedureIds?: string[];
  runway?: string;
  overlay?: ChartOverlay;
};
