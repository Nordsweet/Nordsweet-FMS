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

type Camera = { x: number; y: number; scale: number };
type ChartView = { camera: Camera; width: number; height: number };

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

/** Rasterize only visible pixels, at the real zoom and device density, rather than enlarging a fitted bitmap. */
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
    if (!width || !height) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    let buffer: HTMLCanvasElement | undefined;
    void (async () => {
      const sheet = await pdf.getPage(page);
      if (cancelled || !canvas.current) return;
      const original = sheet.getViewport({ scale: 1 });
      const ratio = calibrationAspectRatio ?? original.width / original.height;
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
      const left = (width - paperWidth) / 2 + camera.x;
      const top = (height - paperHeight) / 2 + camera.y;
      buffer = document.createElement("canvas");
      buffer.width = Math.ceil(width * pixelRatio);
      buffer.height = Math.ceil(height * pixelRatio);
      const context = buffer.getContext("2d", { alpha: true })!;
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
      if (cancelled || !canvas.current) return;
      const target = canvas.current;
      target.width = buffer.width;
      target.height = buffer.height;
      target.getContext("2d")!.drawImage(buffer, 0, 0);
      setImage({
        camera,
        width,
        height,
        frameWidth,
        frameHeight,
        renderScale,
        pixelRatio,
      });
    })()
      .catch((e) => {
        if (!cancelled && (e as Error).name !== "RenderingCancelledException")
          setError(true);
      })
      .finally(() => {
        if (buffer) {
          buffer.width = 0;
          buffer.height = 0;
        }
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, camera, width, height, calibrationAspectRatio]);
  if (error) return <p role="alert">{t("charts.pdfError")}</p>;
  const ready =
    image?.camera === camera &&
    image.width === width &&
    image.height === height;
  const scale = image ? camera.scale / image.camera.scale : 1;
  const x = image
    ? width / 2 + camera.x - scale * (image.width / 2 + image.camera.x)
    : 0;
  const y = image
    ? height / 2 + camera.y - scale * (image.height / 2 + image.camera.y)
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
        className="absolute top-0 left-0 block"
        aria-label={t("charts.pdfPage", { page })}
        style={{
          width: image?.width ?? width,
          height: image?.height ?? height,
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
