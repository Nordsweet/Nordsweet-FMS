import { type GlideInput, type TerrainRegion } from "~/data/terrain";
import { buildGlideGrid } from "~/domain/terrain";
import { solveGlideReach } from "~/domain/glide-reach";

self.onmessage = (
  event: MessageEvent<{ id: string; input: GlideInput; region: TerrainRegion }>,
) => {
  try {
    const { id, input, region } = event.data;
    const reach = solveGlideReach(
      buildGlideGrid(input, region.tiles, region.zoom),
    );
    self.postMessage({ id, reach });
  } catch {
    self.postMessage({ id: event.data.id, error: true });
  }
};
