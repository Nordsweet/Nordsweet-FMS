import { MVTLoader } from "@loaders.gl/mvt";
import { bakeTile, type TileIndex } from "./bake";
import { type Feature } from "./fjord";
import { vectorStyles, type VectorStyle } from "./vector-styles";

/** What the map asks for: tile `tile` painted from the vector tile at `url` (index `data`, `data.z <= tile.z`). */
export type BakeRequest = {
  id: number;
  style: VectorStyle["id"];
  url: string;
  tile: TileIndex;
  data: TileIndex;
  /** Canvas pixels per CSS pixel. */
  scale: number;
};
export type BakeResponse =
  | {
      id: number;
      image: ImageBitmap;
      /** Place points of the data tile, as lon/lat, for the labels deck.gl draws on top. */
      places: Feature[];
      dataKey: string;
    }
  | { id: number; error: string };
export type WorkerMessage = BakeRequest | { cancel: number };

const SIZE = 512;
type Parsed = { layers: Map<string, Feature[]>; places: Feature[] };
/** Parsed vector tiles, newest last: one tile feeds the 4 to 64 overzoomed tiles painted from it. */
const parsed = new Map<string, Promise<Parsed>>();
const MAX_PARSED = 24;
const cancelled = new Set<number>();

function load(request: BakeRequest) {
  const { url, data } = request;
  let tile = parsed.get(url);
  if (tile) {
    parsed.delete(url);
    parsed.set(url, tile);
    return tile;
  }
  tile = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Tile ${response.status}`);
    const features = (await MVTLoader.parse(await response.arrayBuffer(), {
      worker: false,
      mvt: {
        coordinates: "local",
        shape: "geojson",
        layerProperty: "layerName",
      },
    })) as unknown as Feature[];
    const layers = new Map<string, Feature[]>();
    for (const feature of features) {
      const name = String(feature.properties.layerName);
      (layers.get(name) ?? layers.set(name, []).get(name)!).push(feature);
    }
    const n = 2 ** data.z;
    const places = (layers.get("place") ?? []).map((feature) => {
      const [u, v] = feature.geometry.coordinates as [number, number];
      const mercator = Math.PI * (1 - (2 * (data.y + v)) / n);
      return {
        ...feature,
        geometry: {
          type: "Point",
          coordinates: [
            ((data.x + u) / n) * 360 - 180,
            (Math.atan(Math.sinh(mercator)) * 180) / Math.PI,
          ],
        },
      };
    });
    return { layers, places };
  })();
  tile.catch(() => parsed.delete(url));
  parsed.set(url, tile);
  for (const key of parsed.keys()) {
    if (parsed.size <= MAX_PARSED) break;
    parsed.delete(key);
  }
  return tile;
}

async function bake(request: BakeRequest): Promise<BakeResponse> {
  const { id, tile, data, scale } = request;
  const { layers, places } = await load(request);
  if (cancelled.delete(id)) return { id, error: "cancelled" };
  const size = Math.round(SIZE * scale);
  const canvas = new OffscreenCanvas(size, size);
  bakeTile(
    canvas.getContext("2d")!,
    size,
    scale,
    vectorStyles[request.style],
    layers,
    tile,
    data,
  );
  return {
    id,
    image: canvas.transferToImageBitmap(),
    places,
    dataKey: `${data.z}/${data.x}/${data.y}`,
  };
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if ("cancel" in event.data) {
    cancelled.add(event.data.cancel);
    return;
  }
  const { id } = event.data;
  bake(event.data).then(
    (response) =>
      self.postMessage(response, {
        transfer: "image" in response ? [response.image] : [],
      }),
    (error: unknown) => {
      cancelled.delete(id);
      self.postMessage({ id, error: String(error) } satisfies BakeResponse);
    },
  );
};
