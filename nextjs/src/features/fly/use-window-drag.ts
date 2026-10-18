import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent,
  type KeyboardEvent,
} from "react";

/** Move a dialog by its title, clamped to its current map container; pointer and keyboard share bounds. */
export function useWindowDrag() {
  const lastPanel = useRef<HTMLElement | null>(null);
  const drag = useRef<{
    panel: HTMLElement;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const move = useCallback((panel: HTMLElement, left: number, top: number) => {
    const parent = panel.offsetParent as HTMLElement | null;
    if (!parent) return;
    panel.style.left = `${Math.max(8, Math.min(parent.clientWidth - panel.offsetWidth - 8, left))}px`;
    panel.style.top = `${Math.max(8, Math.min(parent.clientHeight - panel.offsetHeight - 8, top))}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }, []);
  useEffect(() => {
    const resize = () => {
      const panel = lastPanel.current;
      if (panel?.isConnected) move(panel, panel.offsetLeft, panel.offsetTop);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [move]);
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const panel = event.currentTarget.closest<HTMLElement>("[role='dialog']");
      if (!panel) return;
      lastPanel.current = panel;
      drag.current = {
        panel,
        x: event.clientX,
        y: event.clientY,
        left: panel.offsetLeft,
        top: panel.offsetTop,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const start = drag.current;
      if (start)
        move(
          start.panel,
          start.left + event.clientX - start.x,
          start.top + event.clientY - start.y,
        );
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const panel = event.currentTarget.closest<HTMLElement>("[role='dialog']");
      if (
        !panel ||
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      )
        return;
      event.preventDefault();
      lastPanel.current = panel;
      move(
        panel,
        panel.offsetLeft +
          (event.key === "ArrowLeft"
            ? -10
            : event.key === "ArrowRight"
              ? 10
              : 0),
        panel.offsetTop +
          (event.key === "ArrowUp" ? -10 : event.key === "ArrowDown" ? 10 : 0),
      );
    },
  };
}
