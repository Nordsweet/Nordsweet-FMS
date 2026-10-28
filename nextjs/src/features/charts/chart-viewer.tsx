"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";

/** Shared, pointer-capture-safe chart pan/pinch/wheel surface. Each pane keeps its own camera. */
export function ChartSurface({
  children,
  controls,
}: {
  children: ReactNode;
  controls?: ReactNode;
}) {
  const t = useT();
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCamera((c) => ({
        ...c,
        scale: Math.max(
          0.5,
          Math.min(10, c.scale * Math.exp(-e.deltaY * 0.0015)),
        ),
      }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const zoom = (factor: number) =>
    setCamera((c) => ({
      ...c,
      scale: Math.max(0.5, Math.min(10, c.scale * factor)),
    }));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        {controls}
        <Button
          size="icon"
          variant="outline"
          aria-label={t("charts.zoomOut")}
          onClick={() => zoom(1 / 1.25)}
        >
          <Minus />
        </Button>
        <span className="min-w-12 text-center font-mono text-xs">
          {Math.round(camera.scale * 100)}%
        </span>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("charts.zoomIn")}
          onClick={() => zoom(1.25)}
        >
          <Plus />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("charts.fit")}
          onClick={() => {
            pointers.current.clear();
            setCamera({ x: 0, y: 0, scale: 1 });
          }}
        >
          <RotateCcw />
        </Button>
      </div>
      <div
        className="relative min-h-32 flex-1 touch-none overflow-hidden rounded-xl border bg-slate-950"
        data-testid="chart-surface"
        ref={surface}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          const old = pointers.current.get(e.pointerId);
          if (!old) return;
          const other = [...pointers.current].find(
            ([id]) => id !== e.pointerId,
          )?.[1];
          const next = { x: e.clientX, y: e.clientY };
          if (other) {
            const before = Math.hypot(old.x - other.x, old.y - other.y);
            const after = Math.hypot(next.x - other.x, next.y - other.y);
            if (before > 1) zoom(after / before);
          } else
            setCamera((c) => ({
              ...c,
              x: c.x + next.x - old.x,
              y: c.y + next.y - old.y,
            }));
          pointers.current.set(e.pointerId, next);
        }}
        onPointerUp={(e) => pointers.current.delete(e.pointerId)}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
      >
        <div
          className="absolute inset-2 flex items-center justify-center [&>svg]:h-full [&>svg]:w-full"
          style={{
            transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** PDF.js renders authenticated bytes locally, including on iPad; page turns never launch another tab. */
export function ChartPdf({
  blob,
  overlay,
  calibrationAspectRatio,
}: {
  blob: Blob;
  overlay?: ReactNode;
  calibrationAspectRatio?: number;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const parent = frame.current?.parentElement;
    if (!parent) return;
    const resize = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    resize.observe(parent);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let document: PDFDocumentProxy | undefined;
    let loading: PDFDocumentLoadingTask | undefined;
    void (async () => {
      const engine = await import("pdfjs-dist");
      engine.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (cancelled) return;
      loading = engine.getDocument({
        data: bytes,
        useSystemFonts: true,
        cMapUrl: "/pdfjs/cmaps/",
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        wasmUrl: "/pdfjs/wasm/",
        iccUrl: "/pdfjs/iccs/",
      });
      document = await loading.promise;
      if (cancelled) {
        await loading.destroy();
        return;
      }
      setPdf(document);
    })().catch(() => {
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
      void loading?.destroy();
    };
  }, [blob]);
  useEffect(() => {
    if (!pdf || !size.width || !size.height) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (cancelled || !canvas.current || !frame.current) return;
      const original = sheet.getViewport({ scale: 1 });
      const ratio = calibrationAspectRatio ?? original.width / original.height;
      const frameWidth = Math.min(size.width, size.height * ratio);
      const frameHeight = frameWidth / ratio;
      const fit = Math.min(
        frameWidth / original.width,
        frameHeight / original.height,
      );
      const resolution = Math.min(
        2,
        window.devicePixelRatio || 1,
        Math.sqrt(8_000_000 / (original.width * original.height * fit * fit)),
      );
      const viewport = sheet.getViewport({ scale: fit * resolution });
      const target = canvas.current;
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      frame.current.style.width = `${frameWidth}px`;
      frame.current.style.height = `${frameHeight}px`;
      target.style.width = `${original.width * fit}px`;
      target.style.height = `${original.height * fit}px`;
      target.style.left = `${(frameWidth - original.width * fit) / 2}px`;
      target.style.top = `${(frameHeight - original.height * fit) / 2}px`;
      setRendered(false);
      task = sheet.render({ canvas: target, viewport });
      await task.promise;
      if (!cancelled) setRendered(true);
    })().catch((e) => {
      if (!cancelled && (e as Error).name !== "RenderingCancelledException")
        setError(true);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, size, calibrationAspectRatio]);
  if (error) return <p role="alert">{t("charts.pdfError")}</p>;
  return (
    <ChartSurface
      controls={
        <div className="mr-auto flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("charts.previousPage")}
            disabled={!pdf || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="font-mono text-xs">
            {t("charts.page", { page, total: pdf?.numPages ?? "—" })}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("charts.nextPage")}
            disabled={!pdf || page === pdf.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div
        ref={frame}
        className="relative shrink-0"
        data-testid="chart-pdf"
        data-ready={rendered}
      >
        <canvas
          ref={canvas}
          className="absolute block"
          aria-label={t("charts.pdfPage", { page })}
        />
        {page === 1 && overlay}
        {!rendered && (
          <span className="absolute inset-0 grid place-items-center text-xs">
            {t("charts.loading")}
          </span>
        )}
      </div>
    </ChartSurface>
  );
}
