import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type PointerEvent,
} from "react";
import type { DeckMap } from "./deck";
import { Button } from "~/components/ui/button";
import { DialogPanel, DialogPanelTitle } from "~/components/ui/dialog";
import { useT } from "~/i18n/use-t";

export function FloatingDetails({
  children,
  onClose,
  draggable,
  anchor,
  mapRef,
}: {
  children: ReactNode;
  onClose: () => void;
  draggable: boolean;
  anchor?: { lat: number; lon: number };
  mapRef?: RefObject<DeckMap | null>;
}) {
  const t = useT(),
    [position, setPosition] = useState({ x: 0, y: 0 }),
    start = useRef<{ x: number; y: number; left: number; top: number } | null>(
      null,
    );
  const panelRef = useRef<HTMLDivElement>(null);
  const lat = anchor?.lat,
    lon = anchor?.lon;
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const map = mapRef?.current;
    if (!panel || !map || lat === undefined || lon === undefined) return;
    const update = () => {
      const point = map.project([lon, lat]);
      const parent = panel.parentElement;
      if (!parent) return;
      const width = panel.offsetWidth,
        height = panel.offsetHeight;
      const right = point.x + 14;
      panel.style.left = `${Math.max(8, Math.min(parent.clientWidth - width - 8, right + width <= parent.clientWidth - 8 ? right : point.x - width - 14))}px`;
      panel.style.top = `${Math.max(8, Math.min(parent.clientHeight - height - 8, point.y - height / 2))}px`;
    };
    update();
    map.on("move", update);
    map.on("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => {
      map.off("move", update);
      map.off("resize", update);
      observer.disconnect();
    };
  }, [mapRef, lat, lon]);
  function begin(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      left: position.x,
      top: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  return (
    <DialogPanel
      ref={panelRef}
      onClose={onClose}
      // Opening from a map click keeps focus on the map (keyboard panning).
      onOpenAutoFocus={(event) => event.preventDefault()}
      className={`legacy-map-details absolute z-20 max-h-[65%] overflow-y-auto ${anchor ? "" : "right-2 bottom-[4.75rem] left-2 sm:left-auto"}`}
      style={{
        ...(anchor
          ? { right: "auto", bottom: "auto", maxWidth: "calc(100% - 16px)" }
          : {}),
        transform: `translate(${position.x}px,${position.y}px)`,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <DialogPanelTitle asChild>
          <div
            className={
              draggable ? "flex-1 cursor-grab touch-none select-none" : "flex-1"
            }
            onPointerDown={draggable ? begin : undefined}
            onPointerMove={(event) => {
              const drag = start.current;
              if (!drag) return;
              const panel = event.currentTarget.parentElement?.parentElement,
                parent = panel?.parentElement;
              if (!panel || !parent) return;
              const bounds = parent.getBoundingClientRect(),
                rect = panel.getBoundingClientRect();
              const dx = event.clientX - drag.x,
                dy = event.clientY - drag.y;
              setPosition({
                x: Math.min(
                  position.x + bounds.right - rect.right - 8,
                  Math.max(
                    position.x + bounds.left - rect.left + 8,
                    drag.left + dx,
                  ),
                ),
                y: Math.min(
                  position.y + bounds.bottom - rect.bottom - 8,
                  Math.max(
                    position.y + bounds.top - rect.top + 8,
                    drag.top + dy,
                  ),
                ),
              });
            }}
            onPointerUp={() => {
              start.current = null;
            }}
            onPointerCancel={() => {
              start.current = null;
            }}
          >
            {t("map.details")}
          </div>
        </DialogPanelTitle>
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("map.close")}
          onClick={onClose}
        >
          ✕
        </Button>
      </div>
      {children}
    </DialogPanel>
  );
}
