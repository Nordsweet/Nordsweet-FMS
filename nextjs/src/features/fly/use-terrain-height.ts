import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { cachedTerrainElevation } from "~/api/terrain";
import { geoidSeparationM } from "~/domain/terrain";
import type { GpsFix } from "./use-gps";

/** Share the instrument/DEM/geoid datum rules between the height tile and low-level notification gating. */
export function useTerrainHeight(current: GpsFix | null) {
  const terrain = useQuery({
    ...api.terrain.region.queryOptions({
      lat: Math.round((current?.lat ?? 0) * 100) / 100,
      lon: Math.round((current?.lon ?? 0) * 100) / 100,
      radiusNm: 1,
    }),
    enabled:
      !!current &&
      current.altitudeAglFt === undefined &&
      current.source !== "replay",
    retry: false,
  });
  const geoid = useQuery({
    ...api.terrain.geoid.queryOptions(undefined),
    enabled:
      !!current &&
      current.source !== "connector" &&
      current.source !== "demo" &&
      current.source !== "replay",
  });
  const groundM =
    current && terrain.data ? cachedTerrainElevation(current) : null;
  const separationM =
    current && geoid.data ? geoidSeparationM(geoid.data, current) : null;
  const mslFt =
    current?.altitudeFt == null
      ? null
      : current.source === "connector" || current.source === "demo"
        ? current.altitudeFt
        : separationM === null
          ? null
          : current.altitudeFt - separationM / 0.3048;
  const aglFt =
    current?.altitudeAglFt ??
    (mslFt !== null && groundM !== null
      ? Math.max(0, mslFt - groundM / 0.3048)
      : null);
  return { mslFt, aglFt };
}
