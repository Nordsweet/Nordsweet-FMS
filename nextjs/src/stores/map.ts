import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { distanceNm } from "~/domain/geo";
import { type TrackPoint } from "~/domain/track";
import { z } from "zod";

export const mapLayers = [
  "airspace",
  "airports",
  "vfr",
  "ifr",
  "navaids",
  "route",
  "traffic",
] as const;
export type LayerId = (typeof mapLayers)[number];
export type Basemap = "osm" | "dark";
export const mapPreferencesSchema = z.object({
  gpsEnabled: z.boolean().default(false),
  basemap: z.enum(["osm", "dark"]).default("osm"),
  plan: z.enum(["current", "next", "none"]).default("current"),
  layers: z
    .object({
      airspace: z.boolean().default(true),
      airports: z.boolean().default(true),
      vfr: z.boolean().default(true),
      ifr: z.boolean().default(true),
      navaids: z.boolean().default(true),
      route: z.boolean().default(true),
      traffic: z.boolean().default(true),
    })
    .default({
      airspace: true,
      airports: true,
      vfr: true,
      ifr: true,
      navaids: true,
      route: true,
      traffic: true,
    }),
  labels: z.boolean().default(true),
  hiddenClasses: z.array(z.string()).default([]),
  trackUp: z.boolean().default(false),
});
type Preferences = z.infer<typeof mapPreferencesSchema>;
type MapState = Preferences & {
  gpsTrack: TrackPoint[];
  observeGps: (point: TrackPoint) => void;
  gpsEnabled: boolean;
  following: boolean;
  command: "fit" | "reset" | null;
  update: (patch: Partial<Preferences>) => void;
  setGps: (enabled: boolean) => void;
  follow: (following: boolean) => void;
  request: (command: "fit" | "reset" | null) => void;
};

export function readLegacyMap(
  storage: Pick<Storage, "getItem">,
): Partial<Preferences> {
  const basemap = storage.getItem("nordsweet-basemap");
  return basemap === "black"
    ? { basemap: "dark" }
    : basemap === "osm"
      ? { basemap: "osm" }
      : {};
}

export const useMapSettings = create<MapState>()(
  persist(
    (set) => ({
      ...mapPreferencesSchema.parse({}),
      gpsEnabled: false,
      following: false,
      command: null,
      gpsTrack: [],
      observeGps: (point) =>
        set((state) => {
          const last = state.gpsTrack.at(-1);
          if (last && Date.parse(point.time) <= Date.parse(last.time))
            return state;
          const points =
            last && distanceNm(last, point) < 0.00001
              ? [...state.gpsTrack.slice(0, -1), point]
              : [...state.gpsTrack, point];
          return { gpsTrack: points.slice(-2400) };
        }),
      update: (patch) => set(patch),
      setGps: (gpsEnabled) => set({ gpsEnabled, following: gpsEnabled }),
      follow: (following) => set({ following }),
      request: (command) => set({ command }),
    }),
    {
      name: "nordsweet.map.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => mapPreferencesSchema.parse(state),
      merge: (persisted, current) => {
        const value = mapPreferencesSchema.safeParse(
          persisted ?? readLegacyMap(localStorage),
        );
        return value.success ? { ...current, ...value.data } : current;
      },
    },
  ),
);
