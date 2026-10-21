import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";

const favoritesSchema = z.object({ favorites: z.array(z.string()) });

/** Starred spots and routes (by API id), kept on this device. */
export const useInspiration = create<{
  favorites: string[];
  toggleFavorite: (id: string) => void;
}>()(
  persist(
    (set) => ({
      favorites: [],
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
    }),
    {
      name: "nordsweet.inspiration.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ favorites }) => ({ favorites }),
      merge: (persisted, current) => {
        const value = favoritesSchema.safeParse(persisted);
        return value.success ? { ...current, ...value.data } : current;
      },
    },
  ),
);
