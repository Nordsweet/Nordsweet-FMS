import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PositionSettings = {
  source: "device" | "connector";
  url: string;
  token: string;
  enabled: boolean;
  update: (patch: Partial<Omit<PositionSettings, "update">>) => void;
};

// Keep the credential in this browser session, including reloads, never in saved flights.
export const usePositionSource = create<PositionSettings>()(
  persist(
    (set) => ({
      source: "device",
      url: "",
      token: "",
      enabled: false,
      update: (patch) => set(patch),
    }),
    {
      name: "nordsweet.position-source.v1",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
