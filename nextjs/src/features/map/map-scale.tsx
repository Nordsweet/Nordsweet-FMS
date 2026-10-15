import { useEffect, useRef, type RefObject } from "react";

import { type DeckMap } from "./deck";

const MAX_WIDTH_PX = 100;
const METERS_PER_NM = 1852;
const EQUATOR_M = 40075016.686;

/** 1, 2, 3, 5 × a power of ten, the way printed scale bars are. */
function roundNumber(value: number) {
  const pow10 = 10 ** Math.floor(Math.log10(value));
  const d = value / pow10;
  return pow10 * (d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1);
}

/** The nautical-mile scale bar, kept in step with the camera without re-rendering React. */
export function MapScale({
  mapRef,
  ready,
}: {
  mapRef: RefObject<DeckMap | null>;
  ready: boolean;
}) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const map = mapRef.current,
      element = bar.current;
    if (!ready || !map || !element) return;
    const update = () => {
      const { lat } = map.getCenter();
      // The world is 512 px at zoom 0.
      const metersPerPx =
        (EQUATOR_M * Math.cos((lat * Math.PI) / 180)) /
        (512 * 2 ** map.getZoom());
      const nm = Number(
        roundNumber((metersPerPx * MAX_WIDTH_PX) / METERS_PER_NM).toPrecision(
          1,
        ),
      );
      element.style.width = `${Math.round((nm * METERS_PER_NM) / metersPerPx)}px`;
      element.textContent = `${nm} nm`;
    };
    update();
    map.on("move", update);
    return () => map.off("move", update);
  }, [mapRef, ready]);
  return <div ref={bar} className="legacy-map-scale" aria-hidden="true" />;
}
