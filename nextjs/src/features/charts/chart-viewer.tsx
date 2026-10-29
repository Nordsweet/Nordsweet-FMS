"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
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

type Camera = { x: number; y: number; scale: number };
type ChartView = { camera: Camera; width: number; height: number };
const CHART_RENDER_MARGIN = 128;

/** Shared, pointer-capture-safe chart pan/pinch/wheel surface. Each pane keeps its own camera. */
export function ChartSurface({
  children,
  controls,
}: {
  children: ReactNode | ((view: ChartView) => ReactNode);
  controls?: ReactNode;
}) {
  const t = useT();
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchScale = useRef<number | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
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
    const resize = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    resize.observe(element);
    return () => {
      element.removeEventListener("wheel", wheel);
      resize.disconnect();
    };
  }, []);
  const zoom = (factor: number) =>
    setCamera((c) => ({
      ...c,
      scale: Math.max(0.5, Math.min(10, c.scale * factor)),
    }));
  const releasePointer = (id: number) => {
    pointers.current.delete(id);
    if (pointers.current.size < 2) pinchScale.current = null;
  };
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="bg-card/90 absolute right-2 bottom-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-1 rounded-lg border p-1 shadow backdrop-blur">
        {controls}
        <Button
          size="icon-xs"
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
          size="icon-xs"
          variant="outline"
          aria-label={t("charts.zoomIn")}
          onClick={() => zoom(1.25)}
        >
          <Plus />
        </Button>
        <Button
          size="icon-xs"
          variant="outline"
          aria-label={t("charts.fit")}
          onClick={() => {
            pointers.current.clear();
            pinchScale.current = null;
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
            if (before > 1) {
              const bounds = e.currentTarget.getBoundingClientRect();
              const centerX = bounds.left + bounds.width / 2;
              const centerY = bounds.top + bounds.height / 2;
              const oldX = (old.x + other.x) / 2 - centerX;
              const oldY = (old.y + other.y) / 2 - centerY;
              const newX = (next.x + other.x) / 2 - centerX;
              const newY = (next.y + other.y) / 2 - centerY;
              const rawScale =
                ((pinchScale.current ?? camera.scale) * after) / before;
              pinchScale.current = rawScale;
              setCamera((c) => {
                const scale = Math.max(0.5, Math.min(10, rawScale));
                const ratio = scale / c.scale;
                return {
                  scale,
                  x: newX - ratio * (oldX - c.x),
                  y: newY - ratio * (oldY - c.y),
                };
              });
            }
          } else
            setCamera((c) => ({
              ...c,
              x: c.x + next.x - old.x,
              y: c.y + next.y - old.y,
            }));
          pointers.current.set(e.pointerId, next);
        }}
        onPointerUp={(e) => releasePointer(e.pointerId)}
        onPointerCancel={(e) => releasePointer(e.pointerId)}
        onLostPointerCapture={(e) => releasePointer(e.pointerId)}
      >
        {typeof children === "function" ? (
          children({ camera, ...size })
        ) : (
          <div
            className="absolute inset-2 flex items-center justify-center [&>svg]:h-full [&>svg]:w-full"
            style={{
              transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`,
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/** Render a viewport-sized area at native density and keep enough margin for smooth dragging. */
function PdfSheet({
  pdf,
  page,
  overlay,
  calibrationAspectRatio,
  view,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  overlay?: ReactNode;
  calibrationAspectRatio?: number;
  view: ChartView;
}) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const latestView = useRef(view);
  const requestRender = useRef<(() => void) | null>(null);
  const [error, setError] = useState(false);
  const [image, setImage] = useState<
    | (ChartView & {
        frameWidth: number;
        frameHeight: number;
        renderScale: number;
        pixelRatio: number;
      })
    | null
  >(null);
  const { camera, width, height } = view;
  useEffect(() => {
    let disposed = false;
    let running = false;
    let failed = false;
    let animation = 0;
    let finished: ChartView | null = null;
    let task: RenderTask | undefined;
    const buffer = document.createElement("canvas");
    const schedule = () => {
      const next = latestView.current;
      if (
        disposed ||
        failed ||
        running ||
        animation ||
        !next.width ||
        !next.height
      )
        return;
      if (
        finished?.camera === next.camera &&
        finished.width === next.width &&
        finished.height === next.height
      )
        return;
      animation = requestAnimationFrame(() => {
        animation = 0;
        void draw(latestView.current);
      });
    };
    const draw = async ({ camera, width, height }: ChartView) => {
      running = true;
      let context: CanvasRenderingContext2D | null = null;
      try {
        const sheet = await pdf.getPage(page);
        if (disposed || !canvas.current) return;
        const original = sheet.getViewport({ scale: 1 });
        const ratio =
          calibrationAspectRatio ?? original.width / original.height;
        const frameWidth = Math.min(
          Math.max(1, width - 16),
          Math.max(1, height - 16) * ratio,
        );
        const frameHeight = frameWidth / ratio;
        const fit = Math.min(
          frameWidth / original.width,
          frameHeight / original.height,
        );
        const pixelRatio = window.devicePixelRatio || 1;
        const renderScale = fit * camera.scale * pixelRatio;
        const paperWidth = original.width * fit * camera.scale;
        const paperHeight = original.height * fit * camera.scale;
        const left = (width - paperWidth) / 2 + camera.x + CHART_RENDER_MARGIN;
        const top = (height - paperHeight) / 2 + camera.y + CHART_RENDER_MARGIN;
        const pixelWidth = Math.ceil(
          (width + 2 * CHART_RENDER_MARGIN) * pixelRatio,
        );
        const pixelHeight = Math.ceil(
          (height + 2 * CHART_RENDER_MARGIN) * pixelRatio,
        );
        if (buffer.width !== pixelWidth) buffer.width = pixelWidth;
        if (buffer.height !== pixelHeight) buffer.height = pixelHeight;
        context = buffer.getContext("2d", { alpha: true })!;
        context.clearRect(0, 0, pixelWidth, pixelHeight);
        context.save();
        context.beginPath();
        context.rect(
          left * pixelRatio,
          top * pixelRatio,
          paperWidth * pixelRatio,
          paperHeight * pixelRatio,
        );
        context.clip();
        context.fillStyle = "white";
        context.fillRect(
          left * pixelRatio,
          top * pixelRatio,
          paperWidth * pixelRatio,
          paperHeight * pixelRatio,
        );
        task = sheet.render({
          canvas: buffer,
          canvasContext: context,
          viewport: sheet.getViewport({ scale: renderScale }),
          transform: [1, 0, 0, 1, left * pixelRatio, top * pixelRatio],
          background: "rgba(0, 0, 0, 0)",
        });
        await task.promise;
        if (disposed || !canvas.current) return;
        const target = canvas.current;
        // Commit pixels and their camera together, so the previous preview transform cannot shift the new image.
        flushSync(() => {
          if (target.width !== buffer.width) target.width = buffer.width;
          if (target.height !== buffer.height) target.height = buffer.height;
          const targetContext = target.getContext("2d")!;
          targetContext.clearRect(0, 0, target.width, target.height);
          targetContext.drawImage(buffer, 0, 0);
          setImage({
            camera,
            width,
            height,
            frameWidth,
            frameHeight,
            renderScale,
            pixelRatio,
          });
        });
        finished = { camera, width, height };
      } catch (e) {
        if (!disposed && (e as Error).name !== "RenderingCancelledException") {
          failed = true;
          setError(true);
        }
      } finally {
        context?.restore();
        task = undefined;
        running = false;
        if (disposed) {
          buffer.width = 0;
          buffer.height = 0;
        } else schedule();
      }
    };
    requestRender.current = schedule;
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      task?.cancel();
      requestRender.current = null;
      if (!running) {
        buffer.width = 0;
        buffer.height = 0;
      }
    };
  }, [pdf, page, calibrationAspectRatio]);
  useEffect(() => {
    latestView.current = { camera, width, height };
    requestRender.current?.();
  }, [camera, width, height]);
  if (error) return <p role="alert">{t("charts.pdfError")}</p>;
  const ready =
    image?.camera === camera &&
    image.width === width &&
    image.height === height;
  const scale = image ? camera.scale / image.camera.scale : 1;
  const x = image
    ? width / 2 +
      camera.x -
      scale * (image.width / 2 + image.camera.x) +
      (1 - scale) * CHART_RENDER_MARGIN
    : 0;
  const y = image
    ? height / 2 +
      camera.y -
      scale * (image.height / 2 + image.camera.y) +
      (1 - scale) * CHART_RENDER_MARGIN
    : 0;
  return (
    <div
      className="absolute inset-0"
      data-testid="chart-pdf"
      data-ready={ready}
      data-render-zoom={image?.camera.scale}
      data-render-scale={image?.renderScale}
      data-pixel-ratio={image?.pixelRatio}
    >
      <canvas
        ref={canvas}
        className="absolute block"
        aria-label={t("charts.pdfPage", { page })}
        style={{
          left: -CHART_RENDER_MARGIN,
          top: -CHART_RENDER_MARGIN,
          width: (image?.width ?? width) + 2 * CHART_RENDER_MARGIN,
          height: (image?.height ?? height) + 2 * CHART_RENDER_MARGIN,
          transformOrigin: "0 0",
          transform: `translate(${x}px,${y}px) scale(${scale})`,
        }}
      />
      {page === 1 && image && (
        <div
          className="pointer-events-none absolute"
          style={{
            width: image.frameWidth,
            height: image.frameHeight,
            left: (width - image.frameWidth * camera.scale) / 2 + camera.x,
            top: (height - image.frameHeight * camera.scale) / 2 + camera.y,
            transform: `scale(${camera.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {overlay}
        </div>
      )}
      {!image && (
        <span className="absolute inset-0 grid place-items-center text-xs">
          {t("charts.loading")}
        </span>
      )}
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
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
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
  if (error) return <p role="alert">{t("charts.pdfError")}</p>;
  return (
    <ChartSurface
      controls={
        <div className="mr-auto flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon-xs"
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
            size="icon-xs"
            aria-label={t("charts.nextPage")}
            disabled={!pdf || page === pdf.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      }
    >
      {(view) =>
        pdf ? (
          <PdfSheet
            key={page}
            pdf={pdf}
            page={page}
            overlay={overlay}
            calibrationAspectRatio={calibrationAspectRatio}
            view={view}
          />
        ) : (
          <span role="status">{t("charts.loading")}</span>
        )
      }
    </ChartSurface>
  );
}
