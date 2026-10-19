import { routeOutline, tilePreview } from "~/domain/inspiration";

/** The shared caching proxy in front of tile.openstreetmap.org (deploy/nginx.conf; rewritten in `next dev`). */
const tileUrl = (z: number, x: number, y: number) =>
  `/tiles/${z}/${x}/${y}.png`;

/** A 2x2 block of OSM tiles with the spot's marker in the middle of the frame. */
export function MapPreview({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  label: string;
}) {
  const { zoom, tiles, offsetPx } = tilePreview({ lat, lon });
  return (
    <div
      role="img"
      aria-label={label}
      className="bg-muted relative h-36 overflow-hidden"
    >
      <div
        className="absolute grid grid-cols-2"
        style={{
          width: 512,
          height: 512,
          left: `calc(50% - ${offsetPx.x}px)`,
          top: `calc(50% - ${offsetPx.y}px)`,
        }}
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element -- raster map tiles, cached by the service worker
          <img
            key={`${tile.x}/${tile.y}`}
            src={tileUrl(zoom, tile.x, tile.y)}
            alt=""
            width={256}
            height={256}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>
      <span className="bg-primary absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full ring-2 ring-white" />
    </div>
  );
}

/** The route as a line between its stops. No basemap: a route spans too many tiles for a preview. */
export function RoutePreview({
  stops,
  label,
}: {
  stops: { lat: number; lon: number }[];
  label: string;
}) {
  const points = routeOutline(stops);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 100 100"
      className="bg-muted h-36 w-full"
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-primary" />
      ))}
    </svg>
  );
}
