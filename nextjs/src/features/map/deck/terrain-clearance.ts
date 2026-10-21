import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import { loadTerrainTile } from "~/api/terrain";
import type { TerrainTile } from "~/data/terrain";
import { terrainClearancePixels } from "~/domain/terrain-clearance";

const images = new WeakMap<
  TerrainTile,
  { altitudeFt: number; image: HTMLCanvasElement }
>();

function clearanceImage(tile: TerrainTile, altitudeFt: number) {
  const cached = images.get(tile);
  if (cached?.altitudeFt === altitudeFt) return cached.image;
  const image = document.createElement("canvas");
  image.width = image.height = 256;
  image
    .getContext("2d")!
    .putImageData(
      new ImageData(terrainClearancePixels(tile.heights, altitudeFt), 256, 256),
      0,
      0,
    );
  images.set(tile, { altitudeFt, image });
  return image;
}

/** Cached DEM tiles stay independent of altitude; only their colour overlay changes. */
export function terrainClearanceLayer(altitudeFt: number) {
  return new TileLayer<TerrainTile>({
    id: "terrain-clearance",
    tileSize: 256,
    minZoom: 0,
    maxZoom: 13,
    refinementStrategy: "no-overlap",
    getTileData: ({ index }) => loadTerrainTile(index),
    updateTriggers: { renderSubLayers: [altitudeFt] },
    renderSubLayers: (props) => {
      if (!props.data) return null;
      const { west, south, east, north } = props.tile.bbox as {
        west: number;
        south: number;
        east: number;
        north: number;
      };
      return new BitmapLayer({
        id: `${props.id}-clearance`,
        image: clearanceImage(props.data, altitudeFt),
        bounds: [west, south, east, north],
        pickable: false,
        textureParameters: { minFilter: "nearest", magFilter: "nearest" },
      });
    },
  });
}
