import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";

export function FloatingDetails({
  children,
  onClose,
  draggable,
}: {
  children: ReactNode;
  onClose: () => void;
  draggable: boolean;
}) {
  const t = useT(),
    [position, setPosition] = useState({ x: 0, y: 0 }),
    start = useRef<{ x: number; y: number; left: number; top: number } | null>(
      null,
    );
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
    <div
      className="legacy-map-details absolute right-2 bottom-8 left-2 z-20 max-h-[65%] overflow-y-auto sm:left-auto"
      role="dialog"
      aria-label={t("map.details")}
      style={{ transform: `translate(${position.x}px,${position.y}px)` }}
    >
      <div className="mb-2 flex items-center justify-between">
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
                Math.max(position.y + bounds.top - rect.top + 8, drag.top + dy),
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
    </div>
  );
}
