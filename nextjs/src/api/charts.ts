import type { z } from "zod";
import {
  aipCatalogSchema,
  chartLibrarySchema,
  type BrowserChart,
} from "~/data/charts";
import { env } from "~/env";
import { aviationFetch } from "./aviation/client";
import { get, set } from "idb-keyval";

async function json<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<z.infer<S>> {
  const response = await aviationFetch(
    new URL(path, env.NEXT_PUBLIC_AVIATION_API_URL),
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new Error(`Charts API (${response.status})`);
  return schema.parse(await response.json());
}

/** Official complete packages only; offline snapshots keep original AIRAC dates. */
const pending = new Map<string, Promise<unknown>>();
const pdfPending = new Map<string, Promise<Blob>>();
function snapshot<S extends z.ZodType>(
  key: string,
  maxAge: number,
  path: string,
  schema: S,
): Promise<z.infer<S>> {
  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<z.infer<S>>;
  const request = (async () => {
    const stored = await get<{ at: number; data: unknown }>(key).catch(
      () => undefined,
    );
    const previous = schema.safeParse(stored?.data);
    if (
      stored &&
      previous.success &&
      Date.now() - stored.at < maxAge &&
      (path !== "/charts/catalog" ||
        !(
          previous.data as { packages: { effective_until: string }[] }
        ).packages.some(
          (p) => Date.now() >= Date.parse(`${p.effective_until}T00:00:00Z`),
        ))
    )
      return previous.data;
    try {
      const data = await json(path, schema);
      await set(key, { at: Date.now(), data }).catch(() => undefined);
      return data;
    } catch (error) {
      if (previous.success) return previous.data;
      throw error;
    }
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
export const loadChartCatalog = () =>
  snapshot(
    "charts.pansa.v1",
    60 * 60 * 1000,
    "/charts/catalog",
    aipCatalogSchema.refine(
      (c) => c.packages.length > 0,
      "AIP import is not ready",
    ),
  );
export const loadChartLibrary = () =>
  snapshot(
    "charts.library.v1",
    5 * 60 * 1000,
    "/charts/library",
    chartLibrarySchema,
  );

/** The private API's bearer header never appears in a PDF URL or an external viewer. */
export function loadChartPdf(
  pdf: NonNullable<BrowserChart["pdf"]>,
): Promise<Blob> {
  const key =
    pdf.kind === "aip"
      ? pdf.sha256
      : pdf.kind === "library"
        ? `${pdf.path}:${pdf.revision}`
        : pdf.src;
  const cacheKey = `charts.pdf.v2:${key}`;
  const previous = pdfPending.get(cacheKey);
  if (previous) return previous;
  const request = (async () => {
    const stored = await get<Blob>(cacheKey).catch(() => undefined);
    if (stored instanceof Blob) return stored;
    let response: Response;
    if (pdf.kind === "bundled") {
      const url = new URL(pdf.src, window.location.origin);
      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith("/charts/")
      )
        throw new Error("Invalid chart source");
      response = await fetch(url);
    } else {
      const url = new URL(
        pdf.kind === "aip" ? `/charts/pdf/${pdf.id}` : "/airports/api/chart",
        env.NEXT_PUBLIC_AVIATION_API_URL,
      );
      if (pdf.kind === "library") url.searchParams.set("path", pdf.path);
      response = await aviationFetch(url);
    }
    if (!response.ok) throw new Error(`Chart PDF (${response.status})`);
    const blob = await response.blob();
    if (
      blob.size > 64 * 1024 * 1024 ||
      (await blob.slice(0, 5).text()) !== "%PDF-"
    )
      throw new Error("Invalid PDF");
    await set(cacheKey, blob).catch(() => undefined);
    return blob;
  })().finally(() => pdfPending.delete(cacheKey));
  pdfPending.set(cacheKey, request);
  return request;
}
